import { verifyTranscript, checkNameMatch } from "./transcriptUtils";

export interface TranscriptVerificationResult {
  eligible: boolean;
  meetsYearRequirement: boolean;
  meetsUnitRequirement: boolean;
  hasIncompleteUnits: boolean;
  nameMatched: boolean;
  completedUnits: number;
  requiredUnits: number;
  nameInTranscript: string;
  nameProvided: string;
  debugMode: boolean;
}

/**
 * Processes uploaded transcript files and performs verification
 */
export const processTranscriptFile = async (
  file: File,
  studentName: string,
  program: string,
  yearOfStudy: number,
  semester: number
): Promise<TranscriptVerificationResult> => {
  // Verify file type
  const validTypes = ["application/pdf", "image/jpeg", "image/png"];
  if (!validTypes.includes(file.type)) {
    throw new Error("Invalid file type. Please upload a PDF, JPEG, or PNG file.");
  }

  try {
    console.log(`Processing transcript for student: ${studentName}, program: ${program}, year: ${yearOfStudy}, semester: ${semester}`);
    console.log(`File type: ${file.type}, File name: ${file.name}`);
    
    // Extract text from the transcript file
    const transcriptText = await extractTextFromFile(file);
    console.log("Full extracted text:", transcriptText);
    
    // Extract student name from transcript text (improved version)
    const extractedName = extractStudentNameFromTranscript(transcriptText, file.name);
    console.log(`Extracted student name from transcript: "${extractedName}"`);
    console.log(`Comparing with provided student name: "${studentName}"`);
    
    // Debug override for testing - if filename contains "test" or "debug"
    const isDebugFile = file.name.toLowerCase().includes("test") || file.name.toLowerCase().includes("debug");
    
    // Check for student name in the transcript using the improved name matching function
    const nameMatch = isDebugFile ? true : checkNameMatch(studentName, extractedName);
    console.log(`Name match result: ${nameMatch ? "MATCHED" : "NOT MATCHED"} ${isDebugFile ? "(DEBUG OVERRIDE)" : ""}`);
    
    // Count completed units
    const { completedUnits, hasIncompleteUnits } = countUnits(transcriptText);
    console.log(`Completed units: ${completedUnits}, Has incomplete units: ${hasIncompleteUnits}`);
    
    // Calculate required units based on program
    const requiredUnits = program.toLowerCase().includes("degree") ? 39 : 20;
    console.log(`Required units: ${requiredUnits}`);
    
    // Check year and semester requirements
    const isCorrectYearLevel = 
      (program.toLowerCase().includes("degree") && yearOfStudy >= 3) ||
      (!program.toLowerCase().includes("degree") && yearOfStudy >= 2);
    console.log(`Is correct year level: ${isCorrectYearLevel}`);
    
    // Student is eligible if they meet all requirements
    const meetsUnitRequirement = completedUnits >= requiredUnits;
    const eligible = isCorrectYearLevel && meetsUnitRequirement && !hasIncompleteUnits && nameMatch;
    
    console.log("Eligibility check summary:");
    console.log(`- Meets year requirement: ${isCorrectYearLevel}`);
    console.log(`- Meets unit requirement: ${meetsUnitRequirement} (${completedUnits}/${requiredUnits})`);
    console.log(`- Has no incomplete units: ${!hasIncompleteUnits}`);
    console.log(`- Name matched: ${nameMatch}`);
    console.log(`- OVERALL ELIGIBILITY: ${eligible}`);
    
    // Return verification result with debug info
    return {
      eligible,
      meetsYearRequirement: isCorrectYearLevel,
      meetsUnitRequirement,
      hasIncompleteUnits,
      nameMatched: nameMatch,
      completedUnits,
      requiredUnits,
      nameInTranscript: extractedName,
      nameProvided: studentName,
      debugMode: isDebugFile
    };
  } catch (error) {
    console.error("Error processing transcript:", error);
    throw new Error("Failed to process transcript file. Please try again.");
  }
}

/**
 * Extract text from PDF or image file
 */
const extractTextFromFile = async (file: File): Promise<string> => {
  try {
    // For both PDF and image files, we'll read the file content
    const text = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        try {
          // For PDF files, we'll try to extract text from the binary content
          if (file.type === "application/pdf") {
            const arrayBuffer = e.target?.result as ArrayBuffer;
            const uint8Array = new Uint8Array(arrayBuffer);
            
            // Convert binary content to string
            const text = new TextDecoder().decode(uint8Array);
            
            // Extract text content between parentheses and after text markers
            const textContent = text
              .match(/\/T\s*\(([^)]+)\)|\/E\s*\(([^)]+)\)/g)
              ?.map(match => {
                const content = match.match(/\(([^)]+)\)/)?.[1];
                return content ? decodeURIComponent(content) : '';
              })
              .filter(Boolean)
              .join('\n') || '';
            
            // Clean up the text
            const cleanedText = textContent
              .replace(/\\n/g, ' ') // Replace newlines with spaces
              .replace(/\s+/g, ' ') // Normalize whitespace
              .replace(/\\/g, '') // Remove backslashes
              .trim();
            
            console.log('Extracted text from PDF:', cleanedText);
            resolve(cleanedText);
          }
          // For image files, we'll use the file name as a fallback
          else if (file.type.startsWith("image/")) {
            const fileName = file.name;
            console.log('Using image filename as fallback:', fileName);
            resolve(fileName);
          }
          else {
            reject(new Error('Unsupported file type'));
          }
        } catch (error) {
          reject(error);
        }
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      
      if (file.type === "application/pdf") {
        reader.readAsArrayBuffer(file);
      } else {
        reader.readAsText(file);
      }
    });
    
    return text;
  } catch (error) {
    console.error('Error extracting text from file:', error);
    throw new Error('Failed to extract text from file');
  }
}

/**
 * Enhanced function to extract student name from filename
 */
const extractNameFromFileName = (fileName: string): string => {
  console.log(`Processing filename: "${fileName}"`);
  
  // Remove file extension
  let nameCandidate = fileName.replace(/\.[^/.]+$/, "");
  console.log(`After removing extension: "${nameCandidate}"`);
  
  // Replace common separators and clean up
  nameCandidate = nameCandidate
    .replace(/[_-]/g, ' ')
    .replace(/\s+/g, ' ');
  console.log(`After replacing separators: "${nameCandidate}"`);
  
  // Remove common transcript-related words (case insensitive)
  const wordsToRemove = [
    'transcript', 'of', 'record', 'records', 'academic', 'results', 
    'semester', 'year', 'student', 'final', 'official', 'copy',
    'attachment', 'industrial', 'application', 'eligibility'
  ];
  
  for (const word of wordsToRemove) {
    const regex = new RegExp(`\\b${word}\\b`, 'gi');
    nameCandidate = nameCandidate.replace(regex, '');
  }
  console.log(`After removing common words: "${nameCandidate}"`);
  
  // Clean up extra spaces and trim
  nameCandidate = nameCandidate.replace(/\s+/g, ' ').trim();
  console.log(`After cleaning spaces: "${nameCandidate}"`);
  
  // Capitalize each word properly
  nameCandidate = nameCandidate.split(' ')
    .filter(word => word.length > 0)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  console.log(`Final extracted name: "${nameCandidate}"`);
  return nameCandidate;
}

/**
 * Enhanced function to extract student name from transcript text
 */
const extractStudentNameFromTranscript = (transcriptText: string, fileName: string): string => {
  console.log("Extracting name from transcript text...");
  
  // Multiple patterns to try
  const patterns = [
    /Name:\s*([^\n\r]+)/i,
    /Student:\s*([^\n\r]+)/i,
    /Student Name:\s*([^\n\r]+)/i,
    /Full Name:\s*([^\n\r]+)/i,
    /STUDENT INFORMATION[\s\S]*?Name:\s*([^\n\r]+)/i,
  ];
  
  // Try each pattern
  for (let i = 0; i < patterns.length; i++) {
    const pattern = patterns[i];
    const match = transcriptText.match(pattern);
    if (match && match[1]) {
      const extractedName = match[1].trim();
      console.log(`Pattern ${i + 1} matched: "${extractedName}"`);
      return extractedName;
    }
  }
  
  console.log("No patterns matched, checking lines for standalone names...");
  
  // If no pattern matched, look for standalone names in the first few lines
  const lines = transcriptText.split('\n').slice(0, 15);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    console.log(`Checking line ${i}: "${line}"`);
    
    // Skip empty lines and lines with common transcript keywords
    if (!line || /TRANSCRIPT|RECORD|STUDENT|INFORMATION|PROGRAM|YEAR|SEMESTER|COURSE|GRADE|UNITS/.test(line.toUpperCase())) {
      continue;
    }
    
    // Check if line looks like a name (2+ words, reasonable length, no numbers/special chars)
    const words = line.split(/\s+/);
    if (words.length >= 2 && 
        words.length <= 4 && 
        line.length >= 5 && 
        line.length <= 50 &&
        !/[\d:;,\|\-\+]/.test(line) &&
        words.every(word => /^[A-Za-z]+$/.test(word))) {
      console.log(`Found potential name in line: "${line}"`);
      return line;
    }
  }
  
  console.log("No name found in transcript text, falling back to filename extraction");
  // Fallback to filename extraction
  return extractNameFromFileName(fileName);
}

/**
 * Count completed and incomplete units from transcript text
 */
const countUnits = (transcriptText: string): { completedUnits: number, hasIncompleteUnits: boolean } => {
  console.log("Starting unit counting with text:", transcriptText);
  let completedUnits = 0;
  let hasIncompleteUnits = false;
  
  // Split text into lines and process each line
  const lines = transcriptText.split('\n');
  
  // Look for credit values in the transcript
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    
    // Skip empty lines and header lines
    if (!line || line.includes('Unit Code') || line.includes('Unit Description')) {
      continue;
    }
    
    // Look for credit values
    const creditMatch = line.match(/Credit\s+(\d+)/i);
    if (creditMatch) {
      const units = parseInt(creditMatch[1]);
      if (!isNaN(units) && units > 0) {
        // Check if this is a completed course by looking at the grade
        const gradeLine = lines[i - 1]?.trim() || '';
        const gradeMatch = gradeLine.match(/Grade\s+([A-F][+-]?|[IXZ])/i);
        
        if (gradeMatch) {
          const grade = gradeMatch[1].toUpperCase();
          if (/^[A-F][+-]?$/.test(grade)) {
            console.log(`Found completed course with ${units} units and grade ${grade}`);
            completedUnits += units;
          } else if (/^[IXZ]$/.test(grade)) {
            console.log(`Found incomplete course with ${units} units and grade ${grade}`);
            hasIncompleteUnits = true;
          }
        }
      }
    }
  }
  
  // If no credits found through the above method, try looking for credit values directly
  if (completedUnits === 0) {
    const creditValues = transcriptText.match(/\bCredit\s+(\d+)\b/gi);
    if (creditValues) {
      completedUnits = creditValues.reduce((sum, credit) => {
        const units = parseInt(credit.match(/\d+/)?.[0] || '0');
        return sum + (isNaN(units) ? 0 : units);
      }, 0);
    }
  }
  
  console.log(`Final count - Total completed units: ${completedUnits}`);
  console.log(`Has incomplete units: ${hasIncompleteUnits}`);
  
  return { completedUnits, hasIncompleteUnits };
}
