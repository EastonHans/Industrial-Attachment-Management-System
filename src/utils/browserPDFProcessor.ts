/**
 * Browser-based PDF processing fallback using pdfjs-dist
 * For use when backend OCR fails or as a client-side alternative
 */

import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.js';

interface BrowserExtractionResult {
  text: string;
  method: string;
  confidence: number;
  processingTime: number;
  pageCount: number;
  errors: string[];
  metadata: {
    hasImages: boolean;
    hasEmbeddedFonts: boolean;
    isDigital: boolean;
    textCoverage: number;
  };
}

interface PDFPageAnalysis {
  pageNumber: number;
  textContent: string;
  hasImages: boolean;
  textItems: number;
  confidence: number;
}

export class BrowserPDFProcessor {
  private academicPatterns = {
    courseCode: /[A-Z]{2,4}\s*\d{3,4}[A-Z]?/g,
    grade: /[A-F][+-]?|Pass|Fail|Credit|Distinction|HD|D|CR|P|F|W|WD|WF/g,
    units: /\d+\.?\d*\s*(?:units?|credits?|hrs?|hours?)/gi,
    gpa: /(?:GPA|CGPA|WAM)[\s:]*\d+\.?\d*/gi,
    academicTerms: /(?:Semester|Term|Quarter|Year|Session)\s*\d+/gi,
    transcriptHeaders: /(?:Academic\s+)?(?:Transcript|Record|Statement)/gi
  };

  async extractText(file: File): Promise<BrowserExtractionResult> {
    const startTime = performance.now();
    const errors: string[] = [];
    
    try {
      console.log('Starting browser-based PDF extraction...');
      
      // Convert file to array buffer
      const arrayBuffer = await file.arrayBuffer();
      
      // Load PDF document
      const pdf = await pdfjsLib.getDocument({
        data: arrayBuffer,
        standardFontDataUrl: '/standard_fonts/',
        cMapUrl: '/cmaps/',
        cMapPacked: true
      }).promise;
      
      const pageCount = pdf.numPages;
      const pageAnalyses: PDFPageAnalysis[] = [];
      let combinedText = '';
      let hasImages = false;
      let hasEmbeddedFonts = false;
      let totalTextItems = 0;
      
      // Process each page (limit to first 20 for performance)
      const pagesToProcess = Math.min(pageCount, 20);
      
      for (let pageNum = 1; pageNum <= pagesToProcess; pageNum++) {
        try {
          const pageAnalysis = await this.extractPageText(pdf, pageNum);
          pageAnalyses.push(pageAnalysis);
          
          combinedText += `\n--- Page ${pageNum} ---\n${pageAnalysis.textContent}`;
          hasImages = hasImages || pageAnalysis.hasImages;
          totalTextItems += pageAnalysis.textItems;
          
          console.log(`Page ${pageNum}: ${pageAnalysis.textContent.length} chars, ${pageAnalysis.textItems} items`);
        } catch (pageError) {
          const errorMsg = `Failed to extract page ${pageNum}: ${pageError}`;
          errors.push(errorMsg);
          console.warn(errorMsg);
        }
      }
      
      // Analyze document characteristics
      const isDigital = totalTextItems > pageCount * 5; // Rough heuristic
      const textCoverage = this.calculateTextCoverage(combinedText, pageCount);
      const confidence = this.calculateTextQuality(combinedText);
      
      // Check for embedded fonts (indicates digital document)
      try {
        const page1 = await pdf.getPage(1);
        const commonObjs = page1.commonObjs;
        // This is a simplified check - in practice you'd examine the font objects
        hasEmbeddedFonts = true; // Assume true for now
      } catch {
        hasEmbeddedFonts = false;
      }
      
      const processingTime = performance.now() - startTime;
      
      console.log(`Browser extraction complete: ${combinedText.length} chars, ${confidence.toFixed(2)} confidence`);
      
      return {
        text: combinedText,
        method: 'browser_pdfjs',
        confidence,
        processingTime,
        pageCount,
        errors,
        metadata: {
          hasImages,
          hasEmbeddedFonts,
          isDigital,
          textCoverage
        }
      };
      
    } catch (error) {
      const errorMsg = `Browser PDF extraction failed: ${error}`;
      errors.push(errorMsg);
      console.error(errorMsg);
      
      return {
        text: '',
        method: 'browser_pdfjs_failed',
        confidence: 0,
        processingTime: performance.now() - startTime,
        pageCount: 0,
        errors,
        metadata: {
          hasImages: false,
          hasEmbeddedFonts: false,
          isDigital: false,
          textCoverage: 0
        }
      };
    }
  }
  
  private async extractPageText(pdf: any, pageNum: number): Promise<PDFPageAnalysis> {
    const page = await pdf.getPage(pageNum);
    
    // Get text content
    const textContent = await page.getTextContent();
    const textItems = textContent.items || [];
    
    // Combine text items with proper spacing
    let pageText = '';
    let lastY = -1;
    let lastX = -1;
    
    for (const item of textItems) {
      if ('str' in item && 'transform' in item) {
        const currentY = item.transform[5];
        const currentX = item.transform[4];
        
        // Add line breaks for new lines (different Y coordinates)
        if (lastY !== -1 && Math.abs(currentY - lastY) > 5) {
          pageText += '\n';
        }
        // Add spaces for horizontal gaps
        else if (lastX !== -1 && currentX - lastX > 10) {
          pageText += ' ';
        }
        
        pageText += item.str;
        lastY = currentY;
        lastX = currentX + (item.width || 0);
      }
    }
    
    // Check for images on this page
    const operators = await page.getOperatorList();
    const hasImages = operators.fnArray.includes(pdfjsLib.OPS.paintImageXObject) ||
                      operators.fnArray.includes(pdfjsLib.OPS.paintInlineImageXObject);
    
    // Calculate page confidence based on text quality
    const confidence = this.calculateTextQuality(pageText);
    
    return {
      pageNumber: pageNum,
      textContent: pageText,
      hasImages,
      textItems: textItems.length,
      confidence
    };
  }
  
  private calculateTextCoverage(text: string, pageCount: number): number {
    // Estimate text coverage based on text length per page
    const avgCharsPerPage = text.length / pageCount;
    // Normalize to 0-100 scale (500+ chars per page = 100%)
    return Math.min((avgCharsPerPage / 500) * 100, 100);
  }
  
  private calculateTextQuality(text: string): number {
    if (!text || text.trim().length < 20) {
      return 0;
    }
    
    let score = 0;
    const textLower = text.toLowerCase();
    
    // Check for academic patterns
    let totalPatternMatches = 0;
    for (const [patternName, pattern] of Object.entries(this.academicPatterns)) {
      const matches = text.match(pattern) || [];
      totalPatternMatches += matches.length;
      
      // Weight different patterns
      switch (patternName) {
        case 'courseCode':
          score += Math.min(matches.length * 0.1, 0.3);
          break;
        case 'grade':
          score += Math.min(matches.length * 0.05, 0.2);
          break;
        case 'transcriptHeaders':
          score += Math.min(matches.length * 0.2, 0.3);
          break;
        default:
          score += Math.min(matches.length * 0.03, 0.1);
      }
    }
    
    // Text structure quality
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    if (lines.length > 10) {
      score += 0.1;
    }
    
    // Word diversity
    const words = textLower.match(/\b\w+\b/g) || [];
    const uniqueWords = new Set(words);
    if (words.length > 0) {
      const diversity = uniqueWords.size / words.length;
      score += Math.min(diversity * 0.3, 0.3);
    }
    
    // Penalty for very short text
    if (text.length < 100) {
      score *= 0.5;
    }
    
    // Bonus for academic content density
    if (totalPatternMatches > 10) {
      score += 0.1;
    }
    
    return Math.min(score, 1.0);
  }
  
  extractStructuredData(text: string): Record<string, any> {
    const structured: Record<string, any> = {
      courseCodes: [],
      grades: [],
      units: [],
      gpaInfo: [],
      academicTerms: [],
      transcriptHeaders: []
    };
    
    // Extract each pattern type
    for (const [patternName, pattern] of Object.entries(this.academicPatterns)) {
      const matches = text.match(pattern) || [];
      const key = patternName === 'courseCode' ? 'courseCodes' :
                  patternName === 'grade' ? 'grades' :
                  patternName === 'units' ? 'units' :
                  patternName === 'gpa' ? 'gpaInfo' :
                  patternName === 'academicTerms' ? 'academicTerms' :
                  'transcriptHeaders';
      
      structured[key] = [...new Set(matches)]; // Remove duplicates
    }
    
    return structured;
  }
  
  async analyzeDocument(file: File): Promise<{
    isDigital: boolean;
    hasImages: boolean;
    hasEmbeddedFonts: boolean;
    pageCount: number;
    estimatedSize: number;
    recommendedMethod: string;
  }> {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      
      const pageCount = pdf.numPages;
      const estimatedSize = arrayBuffer.byteLength;
      
      // Quick analysis of first page
      const page1 = await pdf.getPage(1);
      const textContent = await page1.getTextContent();
      const operators = await page1.getOperatorList();
      
      const hasImages = operators.fnArray.includes(pdfjsLib.OPS.paintImageXObject) ||
                        operators.fnArray.includes(pdfjsLib.OPS.paintInlineImageXObject);
      
      const textItems = textContent.items?.length || 0;
      const isDigital = textItems > 5; // Simple heuristic
      
      // Determine recommended processing method
      let recommendedMethod = 'backend_comprehensive';
      if (estimatedSize > 10 * 1024 * 1024) { // > 10MB
        recommendedMethod = 'backend_lightweight';
      } else if (pageCount > 50) {
        recommendedMethod = 'backend_sampling';
      } else if (!isDigital && hasImages) {
        recommendedMethod = 'backend_ocr_focused';
      }
      
      return {
        isDigital,
        hasImages,
        hasEmbeddedFonts: true, // Simplified - assume true
        pageCount,
        estimatedSize,
        recommendedMethod
      };
      
    } catch (error) {
      console.error('Document analysis failed:', error);
      return {
        isDigital: false,
        hasImages: true,
        hasEmbeddedFonts: false,
        pageCount: 1,
        estimatedSize: file.size,
        recommendedMethod: 'backend_comprehensive'
      };
    }
  }
}

// Singleton instance
export const browserPDFProcessor = new BrowserPDFProcessor();

// Utility function for easy use
export async function extractTextFromPDF(file: File): Promise<BrowserExtractionResult> {
  return browserPDFProcessor.extractText(file);
}

export async function analyzePDFDocument(file: File) {
  return browserPDFProcessor.analyzeDocument(file);
}