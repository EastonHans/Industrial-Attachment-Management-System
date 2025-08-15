/**
 * Advanced OCR System for Academic Transcript Processing
 * Handles any PDF type: native text, image-based, or mixed
 * Eliminates version mismatches and provides robust fallbacks
 */

import { createWorker, Worker } from 'tesseract.js';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Fix PDF.js worker version compatibility
GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@5.3.31/build/pdf.worker.min.mjs`;

export interface OCRResult {
  text: string;
  confidence: number;
  method: 'native-pdf' | 'image-ocr' | 'hybrid' | 'canvas-ocr';
  processingTime: number;
  pages: number;
  errors: string[];
  debug: {
    hasNativeText: boolean;
    imageProcessed: boolean;
    tesseractVersion: string;
    pagesAnalyzed: number[];
  };
}

export interface TranscriptData {
  studentName: string;
  program: string;
  year: number;
  semester: number;
  units: Array<{
    code: string;
    title: string;
    grade: string;
    units: number;
    status: 'complete' | 'incomplete' | 'failed';
  }>;
  totalUnits: number;
  completedUnits: number;
  eligibility: {
    nameMatch: boolean;
    hasRequiredUnits: boolean;
    noIncompletes: boolean;
    correctYear: boolean;
    overall: boolean;
  };
}

class AdvancedOCRProcessor {
  constructor() {
    throw new Error("Frontend OCR is disabled. Use backend API endpoints for document verification.");
  }
  private static instance: AdvancedOCRProcessor;
  private worker: Worker | null = null;
  private isInitialized = false;
  private initializationPromise: Promise<void> | null = null;

  static getInstance(): AdvancedOCRProcessor {
    if (!AdvancedOCRProcessor.instance) {
      AdvancedOCRProcessor.instance = new AdvancedOCRProcessor();
    }
    return AdvancedOCRProcessor.instance;
  }

  /**
   * Initialize Tesseract worker once with proper error handling
   */
  private async initializeWorker(): Promise<void> {
    if (this.isInitialized) return;
    
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.doInitialize();
    return this.initializationPromise;
  }

  private async doInitialize(): Promise<void> {
    try {
      console.log('🔧 Initializing advanced OCR worker...');
      
      // Create worker with specific language and options
      this.worker = await createWorker('eng', 1, {
        logger: (m) => {
          if (m.status === 'recognizing text') {
            console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
          }
        },
        errorHandler: (err) => console.warn('OCR Worker Warning:', err)
      });

      // Set parameters ONLY during initialization to avoid version conflicts
      await this.worker.setParameters({
        tessedit_pageseg_mode: '1', // Automatic page segmentation
        tessedit_ocr_engine_mode: '2', // LSTM + Legacy for better compatibility
        preserve_interword_spaces: '1',
        tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:()[]{}/-+*=@#$%&',
      });

      this.isInitialized = true;
      console.log('✅ Advanced OCR worker initialized successfully');
      
    } catch (error) {
      console.error('❌ OCR initialization failed:', error);
      this.worker = null;
      this.isInitialized = false;
      throw new Error(`OCR initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Main entry point for processing any type of document
   */
  async processDocument(file: File): Promise<OCRResult> {
    const startTime = Date.now();
    const errors: string[] = [];
    
    try {
      await this.initializeWorker();

      console.log(`📄 Processing document: ${file.name} (${file.type}, ${(file.size / 1024 / 1024).toFixed(2)}MB)`);

      if (file.type === 'application/pdf') {
        return await this.processPDF(file, startTime, errors);
      } else if (file.type.startsWith('image/')) {
        return await this.processImage(file, startTime, errors);
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }
    } catch (error) {
      console.error('❌ Document processing failed:', error);
      return {
        text: '',
        confidence: 0,
        method: 'hybrid',
        processingTime: Date.now() - startTime,
        pages: 0,
        errors: [...errors, `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`],
        debug: {
          hasNativeText: false,
          imageProcessed: false,
          tesseractVersion: 'unknown',
          pagesAnalyzed: []
        }
      };
    }
  }

  /**
   * Smart PDF processing with automatic fallback
   */
  private async processPDF(file: File, startTime: number, errors: string[]): Promise<OCRResult> {
    console.log('📖 Analyzing PDF structure...');
    
    try {
      // Step 1: Try to extract native text
      const nativeResult = await this.extractNativePDFText(file);
      
      if (this.isTextMeaningful(nativeResult.text)) {
        console.log('✅ Native PDF text extraction successful');
        return {
          text: nativeResult.text,
          confidence: 0.95, // High confidence for native text
          method: 'native-pdf',
          processingTime: Date.now() - startTime,
          pages: nativeResult.pages,
          errors,
          debug: {
            hasNativeText: true,
            imageProcessed: false,
            tesseractVersion: 'n/a',
            pagesAnalyzed: Array.from({length: nativeResult.pages}, (_, i) => i + 1)
          }
        };
      }

      console.log('⚠️ Native text insufficient, switching to image OCR...');
      errors.push('Native text extraction insufficient, using OCR');

      // Step 2: Convert PDF pages to images and run OCR
      return await this.processPDFAsImages(file, startTime, errors);

    } catch (error) {
      console.error('❌ PDF processing failed:', error);
      errors.push(`PDF processing error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Final fallback: try image OCR
      try {
        return await this.processPDFAsImages(file, startTime, errors);
      } catch (fallbackError) {
        throw new Error(`All PDF processing methods failed: ${fallbackError instanceof Error ? fallbackError.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Extract native text from PDF using PDF.js
   */
  private async extractNativePDFText(file: File): Promise<{ text: string; pages: number }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    const numPages = pdf.numPages;
    
    console.log(`📄 Extracting text from ${numPages} PDF pages...`);
    
    for (let pageNum = 1; pageNum <= Math.min(numPages, 20); pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const textContent = await page.getTextContent();
        
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(' ')
          .trim();
          
        if (pageText) {
          fullText += `\n--- Page ${pageNum} ---\n${pageText}`;
        }
        
        console.log(`📄 Page ${pageNum}: extracted ${pageText.length} characters`);
      } catch (error) {
        console.warn(`⚠️ Failed to extract text from page ${pageNum}:`, error);
      }
    }
    
    return { text: fullText.trim(), pages: numPages };
  }

  /**
   * Convert PDF pages to images and process with OCR
   */
  private async processPDFAsImages(file: File, startTime: number, errors: string[]): Promise<OCRResult> {
    console.log('🖼️ Converting PDF to images for OCR...');
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    
    let fullText = '';
    let totalConfidence = 0;
    let processedPages = 0;
    const pagesAnalyzed: number[] = [];
    
    const maxPages = Math.min(pdf.numPages, 10); // Limit to 10 pages for performance
    
    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        console.log(`🔍 OCR processing page ${pageNum}/${maxPages}...`);
        
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 2.0 }); // High DPI for better OCR
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d')!;
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render page to canvas
        await page.render({ canvasContext: context, viewport }).promise;
        
        // Convert canvas to image blob
        const imageBlob = await new Promise<Blob>((resolve) => {
          canvas.toBlob((blob) => resolve(blob!), 'image/png', 0.95);
        });
        
        // Process with Tesseract
        if (this.worker) {
          const result = await this.worker.recognize(imageBlob);
          
          if (result.data.text && result.data.text.trim().length > 10) {
            fullText += `\n--- Page ${pageNum} ---\n${result.data.text.trim()}`;
            totalConfidence += result.data.confidence;
            processedPages++;
            pagesAnalyzed.push(pageNum);
            
            console.log(`✅ Page ${pageNum}: ${result.data.text.length} chars, ${result.data.confidence.toFixed(1)}% confidence`);
          }
        }
        
      } catch (error) {
        console.error(`❌ OCR failed for page ${pageNum}:`, error);
        errors.push(`Page ${pageNum} OCR error: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    
    const avgConfidence = processedPages > 0 ? totalConfidence / processedPages : 0;
    
    return {
      text: fullText.trim(),
      confidence: avgConfidence / 100, // Convert to 0-1 scale
      method: 'image-ocr',
      processingTime: Date.now() - startTime,
      pages: pdf.numPages,
      errors,
      debug: {
        hasNativeText: false,
        imageProcessed: true,
        tesseractVersion: 'tesseract.js v6',
        pagesAnalyzed
      }
    };
  }

  /**
   * Process image files directly
   */
  private async processImage(file: File, startTime: number, errors: string[]): Promise<OCRResult> {
    console.log('🖼️ Processing image file with OCR...');
    
    if (!this.worker) {
      throw new Error('OCR worker not initialized');
    }
    
    try {
      const result = await this.worker.recognize(file);
      
      return {
        text: result.data.text || '',
        confidence: (result.data.confidence || 0) / 100,
        method: 'image-ocr',
        processingTime: Date.now() - startTime,
        pages: 1,
        errors,
        debug: {
          hasNativeText: false,
          imageProcessed: true,
          tesseractVersion: 'tesseract.js v6',
          pagesAnalyzed: [1]
        }
      };
    } catch (error) {
      throw new Error(`Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Check if extracted text is meaningful
   */
  private isTextMeaningful(text: string): boolean {
    if (!text || text.trim().length < 50) return false;
    
    // Check for common academic terms
    const academicTerms = /(?:student|name|course|unit|grade|semester|year|credit|program|transcript|university|college)/gi;
    const matches = text.match(academicTerms);
    
    // Must have at least 3 academic terms and reasonable length
    return (matches?.length || 0) >= 3 && text.trim().length > 100;
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
        console.log('🧹 OCR worker terminated');
      } catch (error) {
        console.warn('Warning during OCR cleanup:', error);
      } finally {
        this.worker = null;
        this.isInitialized = false;
        this.initializationPromise = null;
      }
    }
  }
}

export default AdvancedOCRProcessor;