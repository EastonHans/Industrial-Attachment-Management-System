/**
 * Advanced Fuzzy Name Matching System
 * Handles OCR errors and variations in name formats
 */

export interface NameMatchResult {
  isMatch: boolean;
  confidence: number;
  method: string;
  details: {
    exactMatch: boolean;
    substringMatch: boolean;
    jaroWinklerScore: number;
    levenshteinScore: number;
    initialsMatch: boolean;
    phonexMatch: boolean;
  };
  explanation: string;
}

export class NameMatcher {
  
  /**
   * Main name matching function with multiple algorithms
   */
  static matchNames(registeredName: string, extractedName: string): NameMatchResult {
    console.log('🔍 Advanced name matching...');
    console.log(`Registered: "${registeredName}"`);
    console.log(`Extracted: "${extractedName}"`);

    if (!registeredName || !extractedName) {
      return {
        isMatch: false,
        confidence: 0,
        method: 'invalid_input',
        details: {
          exactMatch: false,
          substringMatch: false,
          jaroWinklerScore: 0,
          levenshteinScore: 0,
          initialsMatch: false,
          phonexMatch: false
        },
        explanation: 'One or both names are empty'
      };
    }

    // Normalize names
    const regName = this.normalizeName(registeredName);
    const extName = this.normalizeName(extractedName);
    
    // Test multiple matching methods
    const exactMatch = regName === extName;
    const substringMatch = this.checkSubstringMatch(regName, extName);
    const jaroWinklerScore = this.calculateJaroWinkler(regName, extName);
    const levenshteinScore = this.calculateLevenshteinSimilarity(regName, extName);
    const initialsMatch = this.checkInitialsMatch(regName, extName);
    const phonexMatch = this.checkPhonexMatch(regName, extName);

    // Calculate weighted confidence
    const confidence = this.calculateOverallConfidence({
      exactMatch,
      substringMatch,
      jaroWinklerScore,
      levenshteinScore,
      initialsMatch,
      phonexMatch
    });

    // Determine if it's a match
    const isMatch = confidence >= 0.7;
    
    // Determine primary method
    let method = 'composite';
    if (exactMatch) method = 'exact';
    else if (substringMatch) method = 'substring';
    else if (jaroWinklerScore >= 0.9) method = 'jaro_winkler';
    else if (levenshteinScore >= 0.9) method = 'levenshtein';
    else if (initialsMatch) method = 'initials';
    else if (phonexMatch) method = 'phonetic';

    const explanation = this.generateExplanation({
      exactMatch,
      substringMatch,
      jaroWinklerScore,
      levenshteinScore,
      initialsMatch,
      phonexMatch,
      confidence,
      isMatch
    });

    console.log(`Result: ${isMatch ? 'MATCH' : 'NO MATCH'} (${confidence.toFixed(3)} confidence via ${method})`);
    
    return {
      isMatch,
      confidence,
      method,
      details: {
        exactMatch,
        substringMatch,
        jaroWinklerScore,
        levenshteinScore,
        initialsMatch,
        phonexMatch
      },
      explanation
    };
  }

  /**
   * Normalize names for comparison
   */
  private static normalizeName(name: string): string {
    return name
      .toLowerCase()
      .trim()
      .replace(/[^a-z\\s]/g, '') // Remove non-alphabetic characters
      .replace(/\\s+/g, ' ') // Normalize whitespace
      .split(' ')
      .filter(part => part.length > 1) // Remove single characters
      .sort() // Sort for order-independent comparison
      .join(' ');
  }

  /**
   * Check if one name contains the other
   */
  private static checkSubstringMatch(name1: string, name2: string): boolean {
    const parts1 = name1.split(' ');
    const parts2 = name2.split(' ');
    
    // Check if all parts of the shorter name are in the longer name
    const [shorter, longer] = parts1.length <= parts2.length ? [parts1, parts2] : [parts2, parts1];
    
    return shorter.every(part => 
      longer.some(longerPart => 
        longerPart.includes(part) || part.includes(longerPart)
      )
    );
  }

  /**
   * Calculate Jaro-Winkler similarity
   */
  private static calculateJaroWinkler(s1: string, s2: string): number {
    if (s1 === s2) return 1.0;

    const len1 = s1.length;
    const len2 = s2.length;
    
    if (len1 === 0 || len2 === 0) return 0.0;

    const matchWindow = Math.floor(Math.max(len1, len2) / 2) - 1;
    const s1Matches = new Array(len1).fill(false);
    const s2Matches = new Array(len2).fill(false);
    
    let matches = 0;
    let transpositions = 0;

    // Find matches
    for (let i = 0; i < len1; i++) {
      const start = Math.max(0, i - matchWindow);
      const end = Math.min(i + matchWindow + 1, len2);
      
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
    for (let i = 0; i < len1; i++) {
      if (!s1Matches[i]) continue;
      while (!s2Matches[k]) k++;
      if (s1[i] !== s2[k]) transpositions++;
      k++;
    }

    const jaro = (matches / len1 + matches / len2 + (matches - transpositions / 2) / matches) / 3;

    // Winkler bonus for common prefix
    let prefix = 0;
    for (let i = 0; i < Math.min(4, len1, len2); i++) {
      if (s1[i] !== s2[i]) break;
      prefix++;
    }

    return jaro + (0.1 * prefix * (1 - jaro));
  }

  /**
   * Calculate Levenshtein similarity
   */
  private static calculateLevenshteinSimilarity(s1: string, s2: string): number {
    const distance = this.levenshteinDistance(s1, s2);
    const maxLength = Math.max(s1.length, s2.length);
    return maxLength === 0 ? 1 : 1 - (distance / maxLength);
  }

  private static levenshteinDistance(s1: string, s2: string): number {
    const matrix = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  /**
   * Check if initials match
   */
  private static checkInitialsMatch(name1: string, name2: string): boolean {
    const initials1 = name1.split(' ').map(part => part[0]).join('');
    const initials2 = name2.split(' ').map(part => part[0]).join('');
    
    return initials1.length >= 2 && 
           initials2.length >= 2 && 
           initials1 === initials2;
  }

  /**
   * Simple phonetic matching (Soundex-like)
   */
  private static checkPhonexMatch(name1: string, name2: string): boolean {
    const phonex1 = this.simplePhonex(name1);
    const phonex2 = this.simplePhonex(name2);
    
    // Check if at least 60% of phonetic codes match
    const matches = phonex1.filter(code => phonex2.includes(code)).length;
    const total = Math.max(phonex1.length, phonex2.length);
    
    return total > 0 && (matches / total) >= 0.6;
  }

  private static simplePhonex(name: string): string[] {
    return name.split(' ').map(word => {
      return word
        .toLowerCase()
        .replace(/[aeiou]/g, '') // Remove vowels
        .replace(/[ck]/g, 'k') // C/K sound
        .replace(/[sz]/g, 's') // S/Z sound
        .replace(/[pb]/g, 'p') // P/B sound
        .replace(/[dt]/g, 't') // D/T sound
        .replace(/[gj]/g, 'g') // G/J sound
        .replace(/[fv]/g, 'f') // F/V sound
        .replace(/(.)\\1+/g, '$1') // Remove duplicates
        .substring(0, 4); // Keep first 4 chars
    });
  }

  /**
   * Calculate overall confidence from all methods
   */
  private static calculateOverallConfidence(scores: {
    exactMatch: boolean;
    substringMatch: boolean;
    jaroWinklerScore: number;
    levenshteinScore: number;
    initialsMatch: boolean;
    phonexMatch: boolean;
  }): number {
    let confidence = 0;
    let totalWeight = 0;

    // Exact match (highest weight)
    if (scores.exactMatch) {
      confidence += 1.0 * 0.4;
      totalWeight += 0.4;
    }

    // Substring match
    if (scores.substringMatch) {
      confidence += 0.9 * 0.25;
      totalWeight += 0.25;
    }

    // Jaro-Winkler score
    confidence += scores.jaroWinklerScore * 0.2;
    totalWeight += 0.2;

    // Levenshtein score
    confidence += scores.levenshteinScore * 0.1;
    totalWeight += 0.1;

    // Initials match (good fallback for poor OCR)
    if (scores.initialsMatch) {
      confidence += 0.7 * 0.05;
      totalWeight += 0.05;
    }

    // Phonetic match (helps with OCR errors)
    if (scores.phonexMatch) {
      confidence += 0.6 * 0.05;
      totalWeight += 0.05;
    }

    return totalWeight > 0 ? Math.min(confidence / totalWeight, 1.0) : 0;
  }

  /**
   * Generate human-readable explanation
   */
  private static generateExplanation(scores: any): string {
    const { exactMatch, substringMatch, jaroWinklerScore, levenshteinScore, 
            initialsMatch, phonexMatch, confidence, isMatch } = scores;

    let explanation = `${isMatch ? 'MATCH' : 'NO MATCH'} (${(confidence * 100).toFixed(1)}% confidence)\\n\\n`;

    if (exactMatch) {
      explanation += '✅ Exact match found\\n';
    } else if (substringMatch) {
      explanation += '✅ Names contain each other\\n';
    } else {
      explanation += '❌ No exact or substring match\\n';
    }

    explanation += `📊 Similarity scores:\\n`;
    explanation += `  • Jaro-Winkler: ${(jaroWinklerScore * 100).toFixed(1)}%\\n`;
    explanation += `  • Levenshtein: ${(levenshteinScore * 100).toFixed(1)}%\\n`;
    
    if (initialsMatch) {
      explanation += `  • ✅ Initials match\\n`;
    }
    
    if (phonexMatch) {
      explanation += `  • ✅ Phonetic similarity detected\\n`;
    }

    if (confidence >= 0.8) {
      explanation += '\\n🔥 High confidence match';
    } else if (confidence >= 0.7) {
      explanation += '\\n✅ Good confidence match';
    } else if (confidence >= 0.5) {
      explanation += '\\n⚠️ Low confidence - manual review recommended';
    } else {
      explanation += '\\n❌ Very low confidence - likely not a match';
    }

    return explanation;
  }
}