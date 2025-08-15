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

// Enhanced name matching with fuzzy logic and multiple algorithms
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
  
  console.log(`=== FUZZY NAME MATCHING PROCESS ===`);
  console.log(`Registered name: "${regNameLower}"`);
  console.log(`Transcript name: "${transNameLower}"`);
  
  // Method 1: Direct exact match
  if (regNameLower === transNameLower) {
    console.log('✓ MATCH: Direct exact match');
    return true;
  }
  
  // Method 2: Substring containment
  if (regNameLower.includes(transNameLower) || transNameLower.includes(regNameLower)) {
    console.log('✓ MATCH: One name contains the other');
    return true;
  }
  
  // Method 3: Fuzzy string similarity (overall)
  const overallSimilarity = calculateJaroWinklerSimilarity(regNameLower, transNameLower);
  console.log(`Overall Jaro-Winkler similarity: ${overallSimilarity.toFixed(3)}`);
  
  if (overallSimilarity >= 0.85) {
    console.log('✓ MATCH: High overall string similarity');
    return true;
  }
  
  // Method 4: Split names into parts and use multiple algorithms
  const regNameParts = regNameLower.split(/\s+/).filter(part => part.length > 1);
  const transNameParts = transNameLower.split(/\s+/).filter(part => part.length > 1);
  
  console.log(`Registered name parts: [${regNameParts.join(', ')}]`);
  console.log(`Transcript name parts: [${transNameParts.join(', ')}]`);
  
  // Enhanced fuzzy matching for individual parts
  let matches = 0;
  let weightedScore = 0;
  let matchDetails = [];
  
  for (const regPart of regNameParts) {
    let bestMatch = null;
    let bestScore = 0;
    
    for (const transPart of transNameParts) {
      // Multiple similarity algorithms
      const levenshtein = 1 - (calculateLevenshteinDistance(regPart, transPart) / Math.max(regPart.length, transPart.length));
      const jaroWinkler = calculateJaroWinklerSimilarity(regPart, transPart);
      const substring = transPart.includes(regPart) || regPart.includes(transPart) ? 1 : 0;
      
      // Weighted combination of algorithms
      const combinedScore = (levenshtein * 0.4) + (jaroWinkler * 0.4) + (substring * 0.2);
      
      if (combinedScore > bestScore && combinedScore >= 0.6) {
        bestScore = combinedScore;
        bestMatch = transPart;
      }
    }
    
    if (bestMatch) {
      matches++;
      weightedScore += bestScore;
      matchDetails.push(`"${regPart}" ↔ "${bestMatch}" (${bestScore.toFixed(2)})`);
    }
  }
  
  const matchRatio = matches / Math.max(regNameParts.length, transNameParts.length, 1);
  const averageScore = matches > 0 ? weightedScore / matches : 0;
  
  console.log(`Part matches: ${matches}/${Math.max(regNameParts.length, transNameParts.length)}`);
  console.log(`Match ratio: ${matchRatio.toFixed(2)} (need ≥ 0.5)`);
  console.log(`Average similarity score: ${averageScore.toFixed(2)} (need ≥ 0.7)`);
  console.log(`Match details: ${matchDetails.join(', ')}`);
  
  // Method 5: Initials matching (fallback for very different OCR)
  const regInitials = regNameParts.map(part => part[0]).join('');
  const transInitials = transNameParts.map(part => part[0]).join('');
  const initialsMatch = regInitials === transInitials && regInitials.length >= 2;
  
  if (initialsMatch) {
    console.log(`✓ Initials match: "${regInitials}" (fallback for poor OCR)`);
  }
  
  // Final decision with multiple criteria
  const isMatch = (matchRatio >= 0.5 && averageScore >= 0.7) || 
                  overallSimilarity >= 0.85 || 
                  (matchRatio >= 0.4 && averageScore >= 0.8) ||
                  initialsMatch;
  
  console.log(`${isMatch ? '✓' : '✗'} Final fuzzy result: ${isMatch ? 'MATCH' : 'NO MATCH'}`);
  console.log(`=== END FUZZY NAME MATCHING ===`);
  
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

// Calculate Jaro-Winkler similarity between two strings
// This is more forgiving for name matching than Levenshtein distance
const calculateJaroWinklerSimilarity = (s1: string, s2: string): number => {
  if (s1 === s2) return 1.0;
  if (s1.length === 0 || s2.length === 0) return 0.0;

  // Calculate Jaro similarity first
  const matchWindow = Math.floor(Math.max(s1.length, s2.length) / 2) - 1;
  const s1Matches = new Array(s1.length).fill(false);
  const s2Matches = new Array(s2.length).fill(false);
  
  let matches = 0;
  let transpositions = 0;

  // Find matches
  for (let i = 0; i < s1.length; i++) {
    const start = Math.max(0, i - matchWindow);
    const end = Math.min(i + matchWindow + 1, s2.length);
    
    for (let j = start; j < end; j++) {
      if (s2Matches[j] || s1[i] !== s2[j]) continue;
      s1Matches[i] = true;
      s2Matches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0.0;

  // Count transpositions
  let k = 0;
  for (let i = 0; i < s1.length; i++) {
    if (!s1Matches[i]) continue;
    while (!s2Matches[k]) k++;
    if (s1[i] !== s2[k]) transpositions++;
    k++;
  }

  const jaro = (matches / s1.length + matches / s2.length + (matches - transpositions / 2) / matches) / 3;

  // Calculate Winkler bonus for common prefix (up to 4 characters)
  const prefix = Math.min(4, Math.max(s1.length, s2.length));
  let commonPrefix = 0;
  for (let i = 0; i < prefix && s1[i] === s2[i]; i++) {
    commonPrefix++;
  }

  return jaro + (0.1 * commonPrefix * (1 - jaro));
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
