/**
 * Intelligent Transcript Data Extractor
 * Extracts structured data from OCR text like a human would
 */

export interface ExtractedData {
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
  confidence: {
    name: number;
    program: number;
    units: number;
    overall: number;
  };
  rawMatches: {
    nameMatches: string[];
    programMatches: string[];
    unitMatches: string[];
  };
}

export class TranscriptExtractor {
  
  /**
   * Main extraction method
   */
  static extractData(text: string, fileName?: string): ExtractedData {
    console.log('🔍 Starting intelligent transcript data extraction...');
    console.log(`📄 Text length: ${text.length} characters`);
    
    // Clean and prepare text
    const cleanText = this.preprocessText(text);
    
    // Extract each component
    const nameData = this.extractStudentName(cleanText, fileName);
    const programData = this.extractProgram(cleanText);
    const academicData = this.extractAcademicLevel(cleanText);
    const unitsData = this.extractUnits(cleanText);
    
    // Calculate confidence scores
    const confidence = this.calculateConfidence(nameData, programData, unitsData, cleanText);
    
    const result: ExtractedData = {
      studentName: nameData.name,
      program: programData.program,
      year: academicData.year,
      semester: academicData.semester,
      units: unitsData.units,
      totalUnits: unitsData.totalUnits,
      completedUnits: unitsData.completedUnits,
      confidence,
      rawMatches: {
        nameMatches: nameData.matches,
        programMatches: programData.matches,
        unitMatches: unitsData.rawMatches
      }
    };
    
    console.log('✅ Extraction complete:', result);
    return result;
  }

  /**
   * Preprocess text for better extraction
   */
  private static preprocessText(text: string): string {
    return text
      // Normalize whitespace
      .replace(/\s+/g, ' ')
      // Fix common OCR errors
      .replace(/[l|1]/g, 'I') // Common I/l/1 confusion
      .replace(/[O0]/g, 'O') // Common O/0 confusion
      .replace(/rn/g, 'm') // Common m/rn confusion
      // Normalize line breaks
      .replace(/\r\n/g, '\n')
      .replace(/\r/g, '\n')
      .trim();
  }

  /**
   * Extract student name with multiple strategies
   */
  private static extractStudentName(text: string, fileName?: string): { name: string; matches: string[]; confidence: number } {
    console.log('👤 Extracting student name...');
    
    const patterns = [
      // Direct name patterns
      /(?:student\s+name|name\s+of\s+student|full\s+name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/gi,
      /(?:name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,4})/gi,
      
      // Names before ID/Registration
      /([A-Z][A-Z\s]{8,40})\s*(?:ID|STUDENT|REG|ADMISSION)/gi,
      
      // Names in proper case (2-4 words)
      /\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b/g,
      
      // Names after titles
      /(?:MR|MS|MISS|DR|PROF)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})/gi,
      
      // Extract from filename if needed
      fileName ? new RegExp(`([A-Z][a-z]+(?:\\s+[A-Z][a-z]+)+)`, 'g') : null
    ].filter(Boolean) as RegExp[];

    const matches: string[] = [];
    const candidates: Array<{ name: string; score: number }> = [];

    // Apply all patterns
    for (const pattern of patterns) {
      const patternMatches = [...text.matchAll(pattern)];
      for (const match of patternMatches) {
        const candidate = match[1]?.trim();
        if (candidate && this.isValidName(candidate)) {
          matches.push(candidate);
          candidates.push({
            name: this.cleanName(candidate),
            score: this.scoreNameCandidate(candidate, text)
          });
        }
      }
    }

    // Score and select best candidate
    if (candidates.length === 0) {
      console.log('⚠️ No name candidates found');
      return { name: '', matches, confidence: 0 };
    }

    // Sort by score and select best
    candidates.sort((a, b) => b.score - a.score);
    const bestCandidate = candidates[0];
    
    console.log(`✅ Selected name: "${bestCandidate.name}" (score: ${bestCandidate.score.toFixed(2)})`);
    console.log(`📋 All candidates:`, candidates.map(c => `"${c.name}" (${c.score.toFixed(2)})`));
    
    return {
      name: bestCandidate.name,
      matches,
      confidence: Math.min(bestCandidate.score, 1.0)
    };
  }

  /**
   * Extract program/course information
   */
  private static extractProgram(text: string): { program: string; matches: string[]; confidence: number } {
    console.log('🎓 Extracting program information...');
    
    const patterns = [
      /(?:course|program|degree|study)[:\s]+([^\\n\\r]{10,80})/gi,
      /(?:bachelor|master|diploma|certificate)\s+(?:of\s+)?([^\\n\\r]{5,50})/gi,
      /(?:bsc|ba|msc|ma|phd|btech|bcom)\s+([^\\n\\r]{5,50})/gi,
      /(computer\s+science|information\s+technology|engineering|business|medicine|law|education)/gi
    ];

    const matches: string[] = [];
    const candidates: Array<{ program: string; score: number }> = [];

    for (const pattern of patterns) {
      const patternMatches = [...text.matchAll(pattern)];
      for (const match of patternMatches) {
        const candidate = match[1]?.trim() || match[0]?.trim();
        if (candidate && candidate.length >= 5) {
          matches.push(candidate);
          candidates.push({
            program: this.cleanProgram(candidate),
            score: this.scoreProgramCandidate(candidate)
          });
        }
      }
    }

    if (candidates.length === 0) {
      return { program: '', matches, confidence: 0 };
    }

    candidates.sort((a, b) => b.score - a.score);
    const best = candidates[0];
    
    console.log(`✅ Selected program: "${best.program}" (score: ${best.score.toFixed(2)})`);
    
    return {
      program: best.program,
      matches,
      confidence: Math.min(best.score, 1.0)
    };
  }

  /**
   * Extract academic level (year and semester)
   */
  private static extractAcademicLevel(text: string): { year: number; semester: number } {
    console.log('📅 Extracting academic level...');
    
    // Year patterns
    const yearPatterns = [
      /year[:\s]*(\d+)/gi,
      /(?:level|class)[:\s]*(\d+)/gi,
      /(\d+)(?:st|nd|rd|th)\s+year/gi
    ];

    // Semester patterns
    const semesterPatterns = [
      /semester[:\s]*(\d+)/gi,
      /sem[:\s]*(\d+)/gi,
      /term[:\s]*(\d+)/gi
    ];

    let year = 0;
    let semester = 2; // Default to semester 2

    // Extract year
    for (const pattern of yearPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const yearNum = parseInt(match[1]);
        if (yearNum >= 1 && yearNum <= 6) {
          year = Math.max(year, yearNum);
        }
      }
    }

    // Extract semester
    for (const pattern of semesterPatterns) {
      const matches = [...text.matchAll(pattern)];
      for (const match of matches) {
        const semNum = parseInt(match[1]);
        if (semNum >= 1 && semNum <= 2) {
          semester = Math.max(semester, semNum);
        }
      }
    }

    console.log(`✅ Academic level: Year ${year}, Semester ${semester}`);
    return { year, semester };
  }

  /**
   * Extract units with advanced pattern matching
   */
  private static extractUnits(text: string): { 
    units: Array<{ code: string; title: string; grade: string; units: number; status: 'complete' | 'incomplete' | 'failed' }>; 
    totalUnits: number; 
    completedUnits: number;
    rawMatches: string[];
  } {
    console.log('📚 Extracting units...');
    
    const lines = text.split(/\\n/);
    const units: Array<{ code: string; title: string; grade: string; units: number; status: 'complete' | 'incomplete' | 'failed' }> = [];
    const rawMatches: string[] = [];

    // Enhanced unit patterns
    const unitPatterns = [
      // Standard format: CIT 3105 – Machine Learning – A
      /([A-Z]{2,4}\\s*\\d{3,4}[A-Z]?)\\s*[–-]\\s*([^–-]+)\\s*[–-]\\s*([A-F][+-]?|[IXZ]|PASS|FAIL)/gi,
      
      // Tabular format: CIT3105 | Machine Learning | 3 | A
      /([A-Z]{2,4}\\d{3,4})\\s*\\|\\s*([^|]+)\\s*\\|\\s*(\\d+)\\s*\\|\\s*([A-F][+-]?|[IXZ])/gi,
      
      // Simple format: CIT3105 Machine Learning A
      /([A-Z]{2,4}\\s*\\d{3,4})\\s+([A-Za-z\\s]{10,50})\\s+([A-F][+-]?|[IXZ])/gi,
      
      // With units: CIT 3105 Machine Learning (3) A
      /([A-Z]{2,4}\\s*\\d{3,4})\\s+([^()]+)\\s*\\((\\d+)\\)\\s*([A-F][+-]?|[IXZ])/gi,
      
      // Grade first: A CIT3105 Machine Learning 3
      /([A-F][+-]?)\\s+([A-Z]{2,4}\\d{3,4})\\s+([A-Za-z\\s]+)\\s+(\\d+)/gi
    ];

    // Process each line
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.length < 5) continue;

      // Try each pattern
      for (const pattern of unitPatterns) {
        const matches = [...line.matchAll(pattern)];
        
        for (const match of matches) {
          try {
            let code = '', title = '', grade = '', unitsNum = 3; // Default 3 units
            
            if (pattern === unitPatterns[0]) { // Standard format
              code = match[1].replace(/\\s+/g, '');
              title = match[2].trim();
              grade = match[3].toUpperCase();
            } else if (pattern === unitPatterns[1]) { // Tabular
              code = match[1];
              title = match[2].trim();
              unitsNum = parseInt(match[3]) || 3;
              grade = match[4].toUpperCase();
            } else if (pattern === unitPatterns[2]) { // Simple
              code = match[1].replace(/\\s+/g, '');
              title = match[2].trim();
              grade = match[3].toUpperCase();
            } else if (pattern === unitPatterns[3]) { // With units
              code = match[1].replace(/\\s+/g, '');
              title = match[2].trim();
              unitsNum = parseInt(match[3]) || 3;
              grade = match[4].toUpperCase();
            } else if (pattern === unitPatterns[4]) { // Grade first
              grade = match[1].toUpperCase();
              code = match[2];
              title = match[3].trim();
              unitsNum = parseInt(match[4]) || 3;
            }

            // Validate and clean
            if (code && grade && this.isValidGrade(grade)) {
              const status = this.getUnitStatus(grade);
              
              units.push({
                code: code.toUpperCase(),
                title: this.cleanTitle(title),
                grade: grade,
                units: unitsNum,
                status
              });
              
              rawMatches.push(line);
              console.log(`✅ Extracted unit: ${code} - ${title} (${unitsNum} units, ${grade})`);
            }
          } catch (error) {
            console.warn('⚠️ Error parsing unit line:', line, error);
          }
        }
      }
    }

    // Calculate totals
    const totalUnits = units.reduce((sum, unit) => sum + unit.units, 0);
    const completedUnits = units
      .filter(unit => unit.status === 'complete')
      .reduce((sum, unit) => sum + unit.units, 0);

    console.log(`📊 Units summary: ${units.length} units found, ${completedUnits}/${totalUnits} completed`);

    return { units, totalUnits, completedUnits, rawMatches };
  }

  /**
   * Helper methods
   */
  private static isValidName(name: string): boolean {
    if (!name || name.length < 4 || name.length > 50) return false;
    
    const words = name.split(/\\s+/);
    if (words.length < 2 || words.length > 4) return false;
    
    // Check for valid name patterns
    return words.every(word => 
      /^[A-Z][a-z]{1,20}$/.test(word) && 
      word.length >= 2 &&
      !this.isCommonNonName(word)
    );
  }

  private static isCommonNonName(word: string): boolean {
    const nonNames = ['Adobe', 'Photoshop', 'Microsoft', 'Windows', 'Student', 'University', 'College', 'Transcript', 'Page', 'Date', 'Course', 'Program'];
    return nonNames.some(nonName => word.toLowerCase().includes(nonName.toLowerCase()));
  }

  private static cleanName(name: string): string {
    return name
      .split(/\\s+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .trim();
  }

  private static cleanProgram(program: string): string {
    return program
      .replace(/[^a-zA-Z0-9\\s]/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  private static cleanTitle(title: string): string {
    return title
      .replace(/[^a-zA-Z0-9\\s]/g, ' ')
      .replace(/\\s+/g, ' ')
      .trim();
  }

  private static scoreNameCandidate(name: string, text: string): number {
    let score = 0.5; // Base score
    
    // Bonus for appearing after "Name:" or similar
    if (text.toLowerCase().includes(`name: ${name.toLowerCase()}`)) score += 0.3;
    if (text.toLowerCase().includes(`student name: ${name.toLowerCase()}`)) score += 0.4;
    
    // Bonus for proper case
    if (/^[A-Z][a-z]+\\s+[A-Z][a-z]+/.test(name)) score += 0.2;
    
    // Penalty for appearing multiple times (might be a common word)
    const occurrences = (text.match(new RegExp(name, 'gi')) || []).length;
    if (occurrences > 3) score -= 0.2;
    
    return score;
  }

  private static scoreProgramCandidate(program: string): number {
    let score = 0.3; // Base score
    
    // Bonus for academic keywords
    const academicKeywords = ['computer', 'science', 'engineering', 'business', 'technology', 'information'];
    for (const keyword of academicKeywords) {
      if (program.toLowerCase().includes(keyword)) score += 0.15;
    }
    
    // Bonus for degree indicators
    if (/bachelor|master|diploma|certificate/i.test(program)) score += 0.2;
    if (/bsc|ba|msc|ma|btech|bcom/i.test(program)) score += 0.25;
    
    return score;
  }

  private static isValidGrade(grade: string): boolean {
    return /^[A-F][+-]?$|^[IXZ]$|^(PASS|FAIL)$/i.test(grade);
  }

  private static getUnitStatus(grade: string): 'complete' | 'incomplete' | 'failed' {
    const g = grade.toUpperCase();
    if (['I', 'X', 'Z'].includes(g)) return 'incomplete';
    if (g === 'F' || g === 'FAIL') return 'failed';
    return 'complete';
  }

  private static calculateConfidence(
    nameData: any, 
    programData: any, 
    unitsData: any, 
    text: string
  ): { name: number; program: number; units: number; overall: number } {
    const nameConf = nameData.confidence || 0;
    const programConf = programData.confidence || 0;
    const unitsConf = unitsData.units.length > 0 ? Math.min(unitsData.units.length / 10, 1) : 0;
    const overall = (nameConf + programConf + unitsConf) / 3;
    
    return {
      name: nameConf,
      program: programConf,
      units: unitsConf,
      overall
    };
  }
}