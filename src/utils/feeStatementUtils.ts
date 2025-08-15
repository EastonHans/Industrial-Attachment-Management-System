import { ComprehensiveOCR } from './comprehensiveOCR';

// Enhanced text extraction using comprehensive OCR
export async function extractTextFromFile(file: File): Promise<string> {
  try {
    console.log(`Starting fee statement extraction for: ${file.name} (${file.type})`);
    
    const result = await ComprehensiveOCR.processDocument(file, {
      language: 'eng',
      pdfScale: 2.5, // Higher scale for fee statements
      maxPages: 5,   // Fee statements are usually short
      minConfidence: 25, // Lower threshold for financial documents
      enablePreprocessing: true
    });
    
    console.log(`Fee statement OCR result:`, {
      method: result.method,
      confidence: result.confidence,
      textLength: result.text.length,
      processingTime: result.processingTime,
      errors: result.errors
    });
    
    if (result.errors.length > 0) {
      console.warn('Fee statement OCR warnings:', result.errors);
    }
    
    if (!result.text || result.text.trim().length < 10) {
      throw new Error('Could not extract meaningful text from fee statement. Please ensure the document is clear and readable.');
    }
    
    return result.text;
    
  } catch (error) {
    console.error('Fee statement extraction failed:', error);
    throw new Error(`Failed to process fee statement: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Enhanced balance parsing with multiple detection methods
export function parseBalanceFromText(text: string): number | null {
  console.log('Parsing balance from text:', text.substring(0, 500) + '...');
  
  // Normalize text for better matching
  const normalizedText = text.toLowerCase().replace(/\s+/g, ' ').trim();
  
  // Multiple balance detection patterns
  const balancePatterns = [
    // Standard patterns
    /(?:outstanding\s+)?balance[:\s]*([+-]?[\d,]+\.?\d*)/gi,
    /(?:current\s+)?balance[:\s]*([+-]?[\d,]+\.?\d*)/gi,
    /(?:total\s+)?balance[:\s]*([+-]?[\d,]+\.?\d*)/gi,
    
    // Amount patterns
    /(?:amount\s+due|due\s+amount)[:\s]*([+-]?[\d,]+\.?\d*)/gi,
    /(?:total\s+due)[:\s]*([+-]?[\d,]+\.?\d*)/gi,
    
    // Zero balance indicators
    /balance[:\s]*(?:nil|zero|\-|0+\.?0*)/gi,
    /outstanding[:\s]*(?:nil|zero|\-|0+\.?0*)/gi,
    
    // Currency formats
    /(?:ksh|kshs|sh|shs)[:\s]*([+-]?[\d,]+\.?\d*)/gi,
    /([+-]?[\d,]+\.?\d*)\s*(?:ksh|kshs|sh|shs)/gi,
    
    // General number patterns near balance keywords
    /(?:balance|outstanding|due|total)[\s\w]*?([+-]?[\d,]+\.?\d*)/gi
  ];
  
  const foundBalances: number[] = [];
  
  // Try each pattern
  for (const pattern of balancePatterns) {
    const matches = [...normalizedText.matchAll(pattern)];
    
    for (const match of matches) {
      const balanceStr = match[1];
      if (balanceStr) {
        // Clean and parse the number
        const cleanNumber = balanceStr.replace(/[,\s]/g, '').replace(/^[+-]/, '');
        
        // Handle zero indicators
        if (/^(nil|zero|0+\.?0*)$/i.test(cleanNumber) || cleanNumber === '-' || cleanNumber === '') {
          foundBalances.push(0);
          continue;
        }
        
        const parsed = parseFloat(cleanNumber);
        if (!isNaN(parsed) && parsed >= 0) {
          foundBalances.push(parsed);
          console.log(`Found balance candidate: ${balanceStr} -> ${parsed}`);
        }
      }
    }
  }
  
  // If we found zero, that's definitive
  if (foundBalances.includes(0)) {
    console.log('Zero balance detected');
    return 0;
  }
  
  // Return the most common balance found, or the smallest non-zero
  if (foundBalances.length > 0) {
    const finalBalance = Math.min(...foundBalances);
    console.log(`Final balance: ${finalBalance}`);
    return finalBalance;
  }
  
  // Additional fallback: look for any number patterns in lines containing balance keywords
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (/balance|outstanding|due|total/i.test(line)) {
      console.log('Checking line for balance:', line);
      
      // Extract all numbers from the line
      const numbers = line.match(/[\d,]+\.?\d*/g);
      if (numbers) {
        for (const numStr of numbers) {
          const num = parseFloat(numStr.replace(/,/g, ''));
          if (!isNaN(num) && num >= 0) {
            console.log(`Fallback balance found: ${num}`);
            return num;
          }
        }
      }
      
      // Check for zero indicators in this line
      if (/\b(nil|zero|0+\.?0*|\-)\b/i.test(line)) {
        console.log('Zero balance found in line:', line);
        return 0;
      }
    }
  }
  
  console.log('No balance found in text');
  return null;
} 