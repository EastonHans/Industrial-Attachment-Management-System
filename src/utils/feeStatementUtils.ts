import Tesseract from 'tesseract.js';
// @ts-ignore
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';

// Set the workerSrc for pdfjs-dist (required for browser usage)
GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

// Extract text from a PDF file using pdfjs-dist
async function extractTextFromPDF(file: File): Promise<string> {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map((item: any) => item.str).join(' ') + '\n';
  }
  return text;
}

// Extract text from an image file using tesseract.js
async function extractTextFromImage(file: File): Promise<string> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const result = await Tesseract.recognize(dataUrl, 'eng');
  return result.data.text;
}

// Main function to extract text from a file (PDF or image)
export async function extractTextFromFile(file: File): Promise<string> {
  if (file.type === 'application/pdf') {
    return extractTextFromPDF(file);
  } else if (file.type.startsWith('image/')) {
    return extractTextFromImage(file);
  } else {
    throw new Error('Unsupported file type');
  }
}

// Parse the balance from extracted text
export function parseBalanceFromText(text: string): number | null {
  // Look for lines with 'Balance' or 'Outstanding Balance'
  const lines = text.split(/\r?\n/);
  for (const line of lines) {
    if (/balance/i.test(line)) {
      // Find the last number in the line
      const matches = line.match(/([\d,]+\.\d{2}|-)/g);
      if (matches && matches.length > 0) {
        // Use the last match (most likely the balance)
        let num = matches[matches.length - 1].replace(/,/g, '');
        if (num === '-' || num.trim() === '') {
          return 0; // Treat '-' or empty as zero balance
        }
        const parsed = parseFloat(num);
        if (!isNaN(parsed)) {
          return parsed;
        }
      }
    }
  }
  return null;
} 