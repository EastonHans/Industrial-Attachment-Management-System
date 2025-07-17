/**
 * Analyzes an uploaded transcript to verify eligibility for industrial attachment
 */
export interface TranscriptVerificationResult {
  eligible: boolean;
  meetsYearRequirement: boolean;
  meetsUnitRequirement: boolean;
  hasIncompleteUnits: boolean;
  nameMatched: boolean;
  completedUnits: number;
  requiredUnits: number;
  // Debug fields for better feedback
  nameInTranscript?: string;
  nameProvided?: string;
  debugMode?: boolean;
}

/**
 * Utility functions for checking student eligibility
 */

// Check if a student meets the unit requirements
export const checkUnitRequirements = (
  programLevel: 'degree' | 'diploma', 
  units: number
): boolean => {
  if (programLevel === 'degree') {
    return units >= 39;
  } else {
    return units >= 20;
  }
};

// Check if a student meets the year and semester requirements
export const checkYearAndSemester = (
  programLevel: 'degree' | 'diploma',
  year: number,
  semester: number
): boolean => {
  if (programLevel === 'degree') {
    // Year 3, Semester 2 or higher
    return (year === 3 && semester >= 2) || year > 3;
  } else {
    // Year 2, Semester 2 or higher
    return (year === 2 && semester >= 2) || year > 2;
  }
};

// Enhanced name matching with better logging
export const checkNameMatch = (
  registeredName: string, 
  transcriptName: string
): boolean => {
  if (!registeredName || !transcriptName) {
    console.log('WARNING: Empty name provided for matching');
    console.log(`Registered: "${registeredName}", Transcript: "${transcriptName}"`);
    return false;
  }

  // Convert both names to lowercase for case-insensitive comparison
  const regNameLower = registeredName.toLowerCase().trim();
  const transNameLower = transcriptName.toLowerCase().trim();
  
  console.log(`=== NAME MATCHING PROCESS ===`);
  console.log(`Registered name: "${regNameLower}"`);
  console.log(`Transcript name: "${transNameLower}"`);
  
  // Direct match
  if (regNameLower === transNameLower) {
    console.log('✓ MATCH: Direct exact match');
    return true;
  }
  
  // Check if one name is contained in the other
  if (regNameLower.includes(transNameLower) || transNameLower.includes(regNameLower)) {
    console.log('✓ MATCH: One name contains the other');
    return true;
  }
  
  // Split names into parts and check for matches
  const regNameParts = regNameLower.split(/\s+/).filter(part => part.length > 1);
  const transNameParts = transNameLower.split(/\s+/).filter(part => part.length > 1);
  
  console.log(`Registered name parts: [${regNameParts.join(', ')}]`);
  console.log(`Transcript name parts: [${transNameParts.join(', ')}]`);
  
  // Check if at least 40% of name parts match (reduced from 60%)
  let matches = 0;
  let matchDetails = [];
  
  for (const regPart of regNameParts) {
    const matchingPart = transNameParts.find(transPart => {
      const isSubstring = transPart.includes(regPart) || regPart.includes(transPart);
      const isClose = calculateLevenshteinDistance(regPart, transPart) <= 3; // Increased from 2 to 3
      return isSubstring || isClose;
    });
      
    if (matchingPart) {
      matches++;
      matchDetails.push(`"${regPart}" ↔ "${matchingPart}"`);
    }
  }
  
  const matchRatio = matches / Math.max(regNameParts.length, transNameParts.length, 1);
  console.log(`Matches found: ${matches}/${Math.max(regNameParts.length, transNameParts.length)}`);
  console.log(`Match ratio: ${matchRatio.toFixed(2)} (need ≥ 0.4)`);
  console.log(`Match details: ${matchDetails.join(', ')}`);
  
  const isMatch = matchRatio >= 0.4; // Reduced from 0.6 to 0.4
  console.log(`${isMatch ? '✓' : '✗'} Final result: ${isMatch ? 'MATCH' : 'NO MATCH'}`);
  console.log(`=== END NAME MATCHING ===`);
  
  return isMatch;
};

// Calculate Levenshtein distance between two strings
// This helps with matching names that have minor spelling differences
const calculateLevenshteinDistance = (a: string, b: string): number => {
  const matrix = [];
  
  // Increment along the first column of each row
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  
  // Increment each column in the first row
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  
  // Fill in the rest of the matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i-1) === a.charAt(j-1)) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1, // substitution
          matrix[i][j-1] + 1,   // insertion
          matrix[i-1][j] + 1    // deletion
        );
      }
    }
  }
  
  return matrix[b.length][a.length];
};

// Adding this function to use the actual uploaded file
export const verifyTranscript = async (
  transcriptFile: File,
  studentName: string,
  program: string,
  yearOfStudy: number
): Promise<TranscriptVerificationResult> => {
  // This is now just a wrapper for the processTranscriptFile function
  // The actual implementation is in transcriptProcessor.ts
  const { processTranscriptFile } = await import('./transcriptProcessor');
  return processTranscriptFile(transcriptFile, studentName, program, yearOfStudy, 2);
};
