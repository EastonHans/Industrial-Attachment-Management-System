/**
 * Comprehensive OCR System for Document Processing
 * Handles PDF and image files with multiple fallback methods
 */

import Tesseract, { createWorker } from 'tesseract.js';
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set the workerSrc for pdfjs-dist with version compatibility
try {
  // Try to use the exact version-matched worker
  GlobalWorkerOptions.workerSrc = `//unpkg.com/pdfjs-dist@${__PDFJS_VERSION__ || '5.3.31'}/build/pdf.worker.min.mjs`;
} catch {
  // Fallback to local worker
  GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';
}

export interface OCRResult {
  text: string;
  confidence: number;
  method: 'pdf-native' | 'pdf-ocr' | 'image-ocr' | 'hybrid';
  processingTime: number;
  errors: string[];
}

export interface ProcessingOptions {
  language: string;
  pdfScale: number;
  maxPages: number;
  minConfidence: number;
  enablePreprocessing: boolean;
}

const DEFAULT_OPTIONS: ProcessingOptions = {
  language: 'eng',
  pdfScale: 2.0,
  maxPages: 20,
  minConfidence: 30,
  enablePreprocessing: true
};

export class ComprehensiveOCR {
  private static worker: Tesseract.Worker | null = null;
  private static isInitializing = false;

  /**
   * Initialize OCR worker for better performance with fallback handling
   */
  static async initializeWorker(): Promise<void> {
    if (!this.worker && !this.isInitializing) {
      this.isInitializing = true;
      try {
        console.log('🔧 Initializing Tesseract.js worker...');
        
        // Try to create worker with specific configuration
        this.worker = await createWorker('eng', 1, {
          logger: m => {
            if (m.status === 'recognizing text') {
              console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
            } else {
              console.log('OCR Worker:', m);
            }
          },
          errorHandler: err => console.error('OCR Worker Error:', err)
        });
        
        // Configure OCR parameters for better accuracy
        await this.worker.setParameters({
          tessedit_pageseg_mode: '1', // Automatic page segmentation with OSD
          tessedit_ocr_engine_mode: '1', // LSTM OCR Engine (most accurate)
          tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:()[]{}/-+*=@#$%&',
          preserve_interword_spaces: '1', // Preserve spacing
        });
        
        console.log('✅ Tesseract.js worker initialized successfully');
        
      } catch (error) {
        console.error('❌ Failed to initialize Tesseract worker:', error);
        
        // Fallback: Try simpler initialization
        try {
          console.log('🔄 Trying fallback worker initialization...');
          this.worker = await createWorker('eng');
          console.log('✅ Fallback Tesseract worker initialized');
        } catch (fallbackError) {
          console.error('❌ Fallback worker initialization failed:', fallbackError);
          this.worker = null;
          throw new Error(`OCR initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      } finally {
        this.isInitializing = false;
      }
    }
  }

  /**
   * Cleanup OCR worker resources
   */
  static async cleanup(): Promise<void> {
    if (this.worker) {
      try {
        await this.worker.terminate();
        console.log('🧹 OCR worker terminated successfully');
      } catch (error) {
        console.error('❌ Error terminating OCR worker:', error);
      } finally {
        this.worker = null;
        this.isInitializing = false;
      }
    }
  }

  /**
   * Process any document type with comprehensive OCR
   */
  static async processDocument(file: File, options: Partial<ProcessingOptions> = {}): Promise<OCRResult> {
    const startTime = Date.now();
    const opts = { ...DEFAULT_OPTIONS, ...options };
    const errors: string[] = [];

    try {
      await this.initializeWorker();

      if (file.type === 'application/pdf') {
        return await this.processPDF(file, opts, startTime, errors);
      } else if (file.type.startsWith('image/')) {
        return await this.processImage(file, opts, startTime, errors);
      } else {
        throw new Error(`Unsupported file type: ${file.type}`);
      }
    } catch (error) {
      console.error('OCR processing failed:', error);
      return {
        text: '',
        confidence: 0,
        method: 'hybrid',
        processingTime: Date.now() - startTime,
        errors: [...errors, `Processing failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Process PDF with multiple extraction methods
   */
  private static async processPDF(
    file: File, 
    options: ProcessingOptions, 
    startTime: number, 
    errors: string[]
  ): Promise<OCRResult> {
    // Method 1: Try native PDF text extraction first
    try {
      const nativeText = await this.extractNativePDFText(file);
      if (this.isTextMeaningful(nativeText)) {
        console.log('✓ Native PDF extraction successful');
        return {
          text: nativeText,
          confidence: 0.95,
          method: 'pdf-native',
          processingTime: Date.now() - startTime,
          errors
        };
      } else {
        errors.push('Native PDF extraction yielded insufficient text');
      }
    } catch (error) {
      errors.push(`Native PDF extraction failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Method 2: Fallback to PDF-to-Image OCR
    try {
      console.log('→ Falling back to PDF-to-Image OCR...');
      const ocrResult = await this.extractPDFViaOCR(file, options);
      return {
        ...ocrResult,
        method: 'pdf-ocr',
        processingTime: Date.now() - startTime,
        errors
      };
    } catch (error) {
      errors.push(`PDF OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
      
      // Method 3: Last resort - attempt to read as binary and extract any readable text
      try {
        console.log('→ Attempting binary text extraction...');
        const binaryText = await this.extractBinaryText(file);
        return {
          text: binaryText,
          confidence: 0.3,
          method: 'hybrid',
          processingTime: Date.now() - startTime,
          errors: [...errors, 'Used binary extraction as last resort']
        };
      } catch (binaryError) {
        errors.push(`Binary extraction failed: ${binaryError instanceof Error ? binaryError.message : 'Unknown error'}`);
      }
    }

    return {
      text: '',
      confidence: 0,
      method: 'pdf-ocr',
      processingTime: Date.now() - startTime,
      errors: [...errors, 'All PDF processing methods failed']
    };
  }

  /**
   * Process image files with OCR
   */
  private static async processImage(
    file: File, 
    options: ProcessingOptions, 
    startTime: number, 
    errors: string[]
  ): Promise<OCRResult> {
    try {
      console.log('→ Processing image with OCR...');
      
      let imageToProcess = file;
      
      // Preprocess image if enabled
      if (options.enablePreprocessing) {
        try {
          imageToProcess = await this.preprocessImage(file);
        } catch (preprocessError) {
          errors.push(`Image preprocessing failed: ${preprocessError instanceof Error ? preprocessError.message : 'Unknown error'}`);
        }
      }

      if (!this.worker) {
        throw new Error('OCR worker not initialized');
      }

      const result = await this.worker.recognize(imageToProcess);
      
      return {
        text: result.data.text,
        confidence: result.data.confidence / 100,
        method: 'image-ocr',
        processingTime: Date.now() - startTime,
        errors
      };
    } catch (error) {
      return {
        text: '',
        confidence: 0,
        method: 'image-ocr',
        processingTime: Date.now() - startTime,
        errors: [...errors, `Image OCR failed: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Extract text natively from PDF using PDF.js
   */
  private static async extractNativePDFText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    let fullText = '';

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item: any) => {
          if ('str' in item) {
            return item.str;
          }
          return '';
        })
        .join(' ');
      
      fullText += pageText + '\n';
    }

    return fullText.trim();
  }

  /**
   * Convert PDF pages to images and process with OCR
   */
  private static async extractPDFViaOCR(file: File, options: ProcessingOptions): Promise<{ text: string; confidence: number }> {
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await getDocument({ data: arrayBuffer }).promise;
    const maxPages = Math.min(pdf.numPages, options.maxPages);
    
    let allText = '';
    let totalConfidence = 0;
    let pageCount = 0;

    for (let pageNum = 1; pageNum <= maxPages; pageNum++) {
      try {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: options.pdfScale });
        
        // Create canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (!context) throw new Error('Could not get canvas context');
        
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        
        // Render page to canvas
        await page.render({ canvasContext: context, viewport }).promise;
        
        // Convert canvas to blob
        const blob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Failed to convert canvas to blob'));
          }, 'image/png');
        });
        
        // OCR the page
        if (!this.worker) throw new Error('OCR worker not initialized');
        
        const result = await this.worker.recognize(blob);
        const pageText = result.data.text;
        const confidence = result.data.confidence;
        
        if (confidence > options.minConfidence) {
          allText += `\n--- Page ${pageNum} ---\n${pageText}\n`;
          totalConfidence += confidence;
          pageCount++;
        }
        
        console.log(`Page ${pageNum}: ${confidence.toFixed(1)}% confidence, ${pageText.length} chars`);
        
      } catch (pageError) {
        console.warn(`Failed to process page ${pageNum}:`, pageError);
      }
    }

    return {
      text: allText.trim(),
      confidence: pageCount > 0 ? (totalConfidence / pageCount) / 100 : 0
    };
  }

  /**
   * Preprocess image to improve OCR accuracy
   */
  private static async preprocessImage(file: File): Promise<File> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          if (!ctx) throw new Error('Could not get canvas context');
          
          canvas.width = img.width;
          canvas.height = img.height;
          
          // Draw original image
          ctx.drawImage(img, 0, 0);
          
          // Get image data
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Apply preprocessing filters
          for (let i = 0; i < data.length; i += 4) {
            // Convert to grayscale
            const gray = Math.round(0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]);
            
            // Apply threshold for better contrast
            const threshold = gray > 128 ? 255 : 0;
            
            data[i] = threshold;     // Red
            data[i + 1] = threshold; // Green
            data[i + 2] = threshold; // Blue
            // Alpha channel stays the same
          }
          
          // Put processed image data back
          ctx.putImageData(imageData, 0, 0);
          
          // Convert back to blob
          canvas.toBlob((blob) => {
            if (blob) {
              const processedFile = new File([blob], file.name, { type: 'image/png' });
              resolve(processedFile);
            } else {
              reject(new Error('Image preprocessing failed'));
            }
          }, 'image/png');
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Extract text from binary PDF data (last resort)
   */
  private static async extractBinaryText(file: File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);
    const decoder = new TextDecoder('utf-8', { fatal: false });
    const text = decoder.decode(uint8Array);
    
    // Extract potential text patterns from binary data
    const textMatches = text.match(/[A-Za-z0-9\s.,;:()[\]{}/-]{10,}/g) || [];
    return textMatches
      .filter(match => match.trim().length > 10)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Check if extracted text is meaningful
   */
  private static isTextMeaningful(text: string): boolean {
    if (!text || text.trim().length < 50) return false;
    
    const cleanText = text.replace(/\s+/g, ' ').trim();
    const wordCount = cleanText.split(' ').length;
    const hasLetters = /[a-zA-Z]{3,}/.test(cleanText);
    const hasReasonableLength = cleanText.length > 100;
    const hasEnoughWords = wordCount > 20;
    
    return hasLetters && hasReasonableLength && hasEnoughWords;
  }

  /**
   * Clean up worker resources
   */
  static async cleanup(): Promise<void> {
    if (this.worker) {
      await this.worker.terminate();
      this.worker = null;
    }
  }
}

export default ComprehensiveOCR;