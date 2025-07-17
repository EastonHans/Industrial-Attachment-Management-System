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
    // Year 3, Semester 1 or higher
    return (year === 3 && semester >= 1) || year > 3;
  } else {
    // Year 2, Semester 1 or higher
    return (year === 2 && semester >= 1) || year > 2;
  }
};

// Check if the student name on the transcript matches the registered name
// This allows for minor variations in the name
export const checkNameMatch = (
  registeredName: string, 
  transcriptName: string
): boolean => {
  // Convert both names to lowercase for case-insensitive comparison
  const regNameLower = registeredName.toLowerCase();
  const transNameLower = transcriptName.toLowerCase();
  
  // Direct match
  if (regNameLower === transNameLower) {
    return true;
  }
  
  // Check if all parts of one name exist in the other
  const regNameParts = regNameLower.split(/\s+/);
  const transNameParts = transNameLower.split(/\s+/);
  
  // Check if at least 60% of name parts match
  let matches = 0;
  for (const regPart of regNameParts) {
    if (transNameParts.some(transPart => 
      transPart.includes(regPart) || 
      regPart.includes(transPart) ||
      calculateLevenshteinDistance(regPart, transPart) <= 2)) {
      matches++;
    }
  }
  
  return matches / Math.max(regNameParts.length, transNameParts.length) >= 0.6;
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
