/**
 * Template processor for handling various document formats
 * Supports .docx, .txt, and preserves formatting where possible
 * Includes header and footer extraction for .docx files
 */

import mammoth from 'mammoth';
import JSZip from 'jszip';

export interface ProcessedTemplate {
  content: string;
  htmlContent?: string;
  header?: string;
  footer?: string;
  fullTemplate?: string;
  success: boolean;
  error?: string;
}

/**
 * Process uploaded template file and extract content
 */
export const processTemplateFile = async (file: File): Promise<ProcessedTemplate> => {
  try {
    const fileExtension = file.name.toLowerCase().split('.').pop();

    switch (fileExtension) {
      case 'docx':
        return await processDocxFile(file);
      case 'txt':
        return await processTextFile(file);
      case 'doc':
        // For .doc files, we'll try to read as text but warn the user
        return await processLegacyDocFile(file);
      default:
        return {
          content: '',
          success: false,
          error: `Unsupported file format: ${fileExtension}. Please use .docx, .txt, or .doc files.`
        };
    }
  } catch (error) {
    return {
      content: '',
      success: false,
      error: `Failed to process file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Process .docx files with header and footer extraction
 */
const processDocxFile = async (file: File): Promise<ProcessedTemplate> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Use mammoth for main content
    const result = await mammoth.convertToHtml({ arrayBuffer });
    const textResult = await mammoth.extractRawText({ arrayBuffer });
    
    // Extract headers and footers using JSZip
    const { header, footer } = await extractHeadersAndFooters(arrayBuffer);
    
    // Combine all parts into a full template
    const fullTemplate = combineDocumentParts(header, result.value, footer);
    
    return {
      content: textResult.value,
      htmlContent: result.value,
      header,
      footer,
      fullTemplate,
      success: true,
      error: result.messages.length > 0 ? 
        `Conversion warnings: ${result.messages.map(m => m.message).join(', ')}` : 
        undefined
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: `Failed to process .docx file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Process plain text files
 */
const processTextFile = async (file: File): Promise<ProcessedTemplate> => {
  try {
    const content = await file.text();
    return {
      content,
      success: true
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: `Failed to read text file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Process legacy .doc files (limited support)
 */
const processLegacyDocFile = async (file: File): Promise<ProcessedTemplate> => {
  try {
    // .doc files are binary format, we can't properly read them without specialized libraries
    // We'll return an error message suggesting to convert to .docx
    return {
      content: '',
      success: false,
      error: 'Legacy .doc files are not fully supported. Please save your document as .docx format for best results, or use .txt format for plain text templates.'
    };
  } catch (error) {
    return {
      content: '',
      success: false,
      error: `Failed to process .doc file: ${error instanceof Error ? error.message : 'Unknown error'}`
    };
  }
};

/**
 * Replace placeholders in template content
 */
export const replacePlaceholders = (
  template: string,
  placeholders: Record<string, string>
): string => {
  let result = template;
  
  // Replace each placeholder
  Object.entries(placeholders).forEach(([key, value]) => {
    // Handle different placeholder formats
    const patterns = [
      new RegExp(`\\{\\{${key}\\}\\}`, 'gi'), // {{key}}
      new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi'), // {{ key }}
      new RegExp(`\\[\\[${key}\\]\\]`, 'gi'), // [[key]]
      new RegExp(`\\$\\{${key}\\}`, 'gi'), // ${key}
    ];
    
    patterns.forEach(pattern => {
      result = result.replace(pattern, value || '');
    });
  });
  
  return result;
};

/**
 * Get default placeholders for CUEA letters
 */
export const getDefaultPlaceholders = () => {
  return {
    name: '{{name}}',
    admno: '{{admno}}', 
    registration_number: '{{registration_number}}',
    program: '{{program}}',
    year: '{{year}}',
    attachment_period: '{{attachment_period}}',
    date: '{{date}}',
    student_name: '{{student_name}}',
    reg_no: '{{reg_no}}',
    course: '{{course}}',
    academic_year: '{{academic_year}}'
  };
};

/**
 * Validate template has required placeholders
 */
export const validateTemplate = (content: string): { isValid: boolean; missingPlaceholders: string[] } => {
  const requiredPlaceholders = ['name', 'admno'];
  const missingPlaceholders: string[] = [];
  
  requiredPlaceholders.forEach(placeholder => {
    const patterns = [
      `{{${placeholder}}}`,
      `{{ ${placeholder} }}`,
      `[[${placeholder}]]`,
      `\${${placeholder}}`
    ];
    
    const hasPlaceholder = patterns.some(pattern => 
      content.toLowerCase().includes(pattern.toLowerCase())
    );
    
    if (!hasPlaceholder) {
      missingPlaceholders.push(placeholder);
    }
  });
  
  return {
    isValid: missingPlaceholders.length === 0,
    missingPlaceholders
  };
};

/**
 * Extract headers and footers from .docx file structure
 */
const extractHeadersAndFooters = async (arrayBuffer: ArrayBuffer): Promise<{ header: string; footer: string }> => {
  try {
    const zip = await JSZip.loadAsync(arrayBuffer);
    let header = '';
    let footer = '';

    // Debug: List all files in the zip
    console.log('Files in docx:', Object.keys(zip.files));

    // Extract headers
    const headerFiles = Object.keys(zip.files).filter(filename => 
      filename.startsWith('word/header') && filename.endsWith('.xml')
    );
    
    console.log('Found header files:', headerFiles);
    
    for (const headerFile of headerFiles) {
      const headerXml = await zip.files[headerFile].async('text');
      const headerText = parseWordXml(headerXml);
      console.log(`Header ${headerFile} content:`, headerText);
      if (headerText.trim()) {
        header += headerText + '\n';
      }
    }

    // Extract footers
    const footerFiles = Object.keys(zip.files).filter(filename => 
      filename.startsWith('word/footer') && filename.endsWith('.xml')
    );
    
    console.log('Found footer files:', footerFiles);
    
    for (const footerFile of footerFiles) {
      const footerXml = await zip.files[footerFile].async('text');
      const footerText = parseWordXml(footerXml);
      console.log(`Footer ${footerFile} content:`, footerText);
      if (footerText.trim()) {
        footer += footerText + '\n';
      }
    }

    console.log('Final header:', header);
    console.log('Final footer:', footer);

    return { header: header.trim(), footer: footer.trim() };
  } catch (error) {
    console.warn('Failed to extract headers/footers:', error);
    return { header: '', footer: '' };
  }
};

/**
 * Parse Word XML content to extract text using browser-compatible DOMParser
 */
const parseWordXml = (xmlContent: string): string => {
  try {
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlContent, 'text/xml');
    
    // Check for parser errors
    const parseError = xmlDoc.querySelector('parsererror');
    if (parseError) {
      console.warn('XML parsing error:', parseError.textContent);
      return '';
    }
    
    let text = '';
    
    // Extract text from Word XML text nodes (w:t elements)
    const textNodes = xmlDoc.querySelectorAll('w\\:t, t');
    textNodes.forEach(node => {
      const nodeText = node.textContent || '';
      if (nodeText.trim()) {
        text += nodeText + ' ';
      }
    });
    
    // Also try to extract from any text content in the document
    if (!text.trim()) {
      // Fallback: extract all text content, but filter out common XML noise
      const allText = xmlDoc.documentElement?.textContent || '';
      text = allText
        .replace(/\s+/g, ' ') // Normalize whitespace
        .replace(/[<>]/g, '') // Remove any stray XML brackets
        .trim();
    }
    
    return text.trim();
  } catch (error) {
    console.warn('Failed to parse XML:', error);
    return '';
  }
};

/**
 * Combine document parts into a full template
 */
const combineDocumentParts = (header: string, content: string, footer: string): string => {
  let fullTemplate = '';
  
  // Add header if it exists
  if (header.trim()) {
    fullTemplate += `<div class="document-header" style="margin-bottom: 20px; border-bottom: 1px solid #ddd; padding-bottom: 10px;">\n${header}\n</div>\n\n`;
  }
  
  // Add main content
  fullTemplate += `<div class="document-content">\n${content}\n</div>\n\n`;
  
  // Add footer if it exists
  if (footer.trim()) {
    fullTemplate += `<div class="document-footer" style="margin-top: 20px; border-top: 1px solid #ddd; padding-top: 10px;">\n${footer}\n</div>`;
  }
  
  return fullTemplate;
};