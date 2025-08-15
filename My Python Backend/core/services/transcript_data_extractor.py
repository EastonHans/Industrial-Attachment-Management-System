"""
Advanced Transcript Data Extractor with Post-Processing
Cleans and normalizes names, units, course codes, and academic data
"""

import re
import logging
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from difflib import SequenceMatcher
import unicodedata

logger = logging.getLogger(__name__)

@dataclass
class CleanedUnit:
    """Represents a cleaned and normalized academic unit"""
    code: str
    title: str
    grade: str
    units: int
    status: str  # 'complete', 'incomplete', 'failed'
    confidence: float

@dataclass
class TranscriptData:
    """Cleaned and structured transcript data"""
    student_name: str
    student_id: str
    program: str
    year: int
    semester: int
    units: List[CleanedUnit]
    total_units: int
    completed_units: int
    gpa: Optional[float]
    confidence_scores: Dict[str, float]
    raw_data: Dict[str, Any]

class NameMatcher:
    """Advanced fuzzy name matching with multiple algorithms"""
    
    @staticmethod
    def normalize_name(name: str) -> str:
        """Normalize name for comparison"""
        if not name:
            return ""
        
        # Remove accents and special characters
        name = unicodedata.normalize('NFD', name)
        name = ''.join(c for c in name if unicodedata.category(c) != 'Mn')
        
        # Clean and normalize
        name = re.sub(r'[^a-zA-Z\s]', '', name)  # Remove non-alphabetic
        name = re.sub(r'\s+', ' ', name)  # Normalize whitespace
        name = name.strip().lower()
        
        # Sort name parts for order-independent comparison
        parts = [part for part in name.split() if len(part) > 1]
        return ' '.join(sorted(parts))
    
    @staticmethod
    def calculate_similarity(name1: str, name2: str) -> float:
        """Calculate similarity between two names using multiple methods"""
        if not name1 or not name2:
            return 0.0
        
        norm1 = NameMatcher.normalize_name(name1)
        norm2 = NameMatcher.normalize_name(name2)
        
        if norm1 == norm2:
            return 1.0
        
        # Sequence matcher similarity
        seq_sim = SequenceMatcher(None, norm1, norm2).ratio()
        
        # Check if one name contains the other
        parts1 = set(norm1.split())
        parts2 = set(norm2.split())
        
        if parts1.issubset(parts2) or parts2.issubset(parts1):
            return max(0.8, seq_sim)
        
        # Check for common parts
        common_parts = parts1.intersection(parts2)
        if common_parts:
            coverage = len(common_parts) / max(len(parts1), len(parts2))
            return max(seq_sim, coverage * 0.7)
        
        return seq_sim
    
    @staticmethod
    def match_names(registered_name: str, extracted_name: str) -> Dict[str, Any]:
        """Match names and return detailed results"""
        similarity = NameMatcher.calculate_similarity(registered_name, extracted_name)
        
        return {
            'is_match': similarity >= 0.7,
            'confidence': similarity,
            'method': 'fuzzy_matching',
            'normalized_registered': NameMatcher.normalize_name(registered_name),
            'normalized_extracted': NameMatcher.normalize_name(extracted_name),
            'explanation': f"Similarity: {similarity:.2f} ({'MATCH' if similarity >= 0.7 else 'NO MATCH'})"
        }

class TextCleaner:
    """Advanced text cleaning and normalization"""
    
    @staticmethod
    def clean_text(text: str) -> str:
        """Clean and normalize text"""
        if not text:
            return ""
        
        # Normalize unicode
        text = unicodedata.normalize('NFD', text)
        text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
        
        # Fix common OCR errors
        replacements = {
            'rn': 'm',
            'cl': 'd',
            '0': 'O',  # Only in specific contexts
            '1': 'I',  # Only in specific contexts
            'vv': 'w',
            'ii': 'n',
        }
        
        for old, new in replacements.items():
            text = text.replace(old, new)
        
        # Normalize whitespace
        text = re.sub(r'\s+', ' ', text)
        return text.strip()
    
    @staticmethod
    def extract_course_code(text: str) -> Optional[str]:
        """Extract and normalize course code"""
        # Pattern for course codes: 2-4 letters followed by 3-4 digits
        pattern = r'\b([A-Z]{2,4})\s*(\d{3,4}[A-Z]?)\b'
        match = re.search(pattern, text.upper())
        
        if match:
            return f"{match.group(1)}{match.group(2)}"
        
        return None
    
    @staticmethod
    def normalize_grade(grade: str) -> str:
        """Normalize grade format"""
        if not grade:
            return ""
        
        grade = grade.upper().strip()
        
        # Map common variations
        grade_map = {
            'PASS': 'P',
            'FAIL': 'F',
            'INCOMPLETE': 'I',
            'WITHDRAWN': 'W',
            'CREDIT': 'CR',
            'NO CREDIT': 'NC'
        }
        
        return grade_map.get(grade, grade)

class TranscriptDataExtractor:
    """Main class for extracting and cleaning transcript data"""
    
    def __init__(self):
        self.text_cleaner = TextCleaner()
        self.name_matcher = NameMatcher()
        
        # Academic keywords for validation
        self.academic_keywords = [
            'transcript', 'student', 'course', 'unit', 'grade', 'semester',
            'program', 'degree', 'university', 'college', 'gpa', 'credit'
        ]
    
    def extract_structured_data(self, text: str) -> TranscriptData:
        """Main extraction method"""
        logger.info("Starting transcript data extraction and cleaning...")
        
        cleaned_text = self.text_cleaner.clean_text(text)
        
        # Extract each component
        student_name = self._extract_student_name(cleaned_text)
        student_id = self._extract_student_id(cleaned_text)
        program = self._extract_program(cleaned_text)
        year, semester = self._extract_academic_period(cleaned_text)
        units = self._extract_units(cleaned_text)
        gpa = self._extract_gpa(cleaned_text)
        
        # Calculate totals - each course counts as 1 unit regardless of credits
        # Exclude exempt courses (AU, EX, N/A) from totals
        countable_units = [unit for unit in units if unit.status != 'exempt']
        total_units = len(countable_units)
        completed_units = len([unit for unit in countable_units if unit.status == 'complete'])
        
        # Calculate confidence scores
        confidence_scores = self._calculate_confidence_scores(
            student_name, program, units, cleaned_text
        )
        
        logger.info(f"Extraction complete: {len(units)} units, {completed_units}/{total_units} completed")
        
        return TranscriptData(
            student_name=student_name,
            student_id=student_id,
            program=program,
            year=year,
            semester=semester,
            units=units,
            total_units=total_units,
            completed_units=completed_units,
            gpa=gpa,
            confidence_scores=confidence_scores,
            raw_data={
                'original_text_length': len(text),
                'cleaned_text_length': len(cleaned_text),
                'extraction_method': 'advanced_pattern_matching'
            }
        )
    
    def _extract_student_name(self, text: str) -> str:
        """Extract and clean student name"""
        
        # First, log the beginning of the text to see what we're working with
        logger.info(f"Text preview for name extraction: {text[:500]}")
        
        patterns = [
            # Specific patterns based on the user's transcript format
            r'Name:\s*([A-Z][A-Z\s]{10,50})\s*Stage',  # "Name: EASTON MICHURA OCHIENG Stage"
            r'Name:\s*([A-Z][A-Z\s]{10,50})',
            
            # Names from fee statement format: "Name: EASTON MICHURA OCHIENG Stage: Y4S2"
            r'Name:\s*([A-Z\s]{10,50})\s*Stage:',
            
            # All caps names with stage info
            r'([A-Z]{2,}\s+[A-Z]{2,}\s+[A-Z]{2,})\s+Stage',
            
            # All caps names before student number or program info
            r'([A-Z]{2,}\s+[A-Z]{2,}\s+[A-Z]{2,})\s*(?:\d{6,8}|Student|Programme|Program)',
            
            # Standard patterns
            r'(?:student\s+name|name\s+of\s+student|full\s+name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
            r'(?:name)[:\s]+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
            
            # Names before ID/registration numbers
            r'([A-Z][A-Z\s]{10,40})\s*(?:ID|STUDENT|REG|ADMISSION|\d{6,8})',
            
            # Names in proper case
            r'\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b',
            
            # Names after titles
            r'(?:MR|MS|MISS|DR|PROF)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})'
        ]
        
        for pattern in patterns:
            matches = re.findall(pattern, text, re.IGNORECASE)
            for match in matches:
                cleaned_name = self._clean_name(match)
                if self._is_valid_name(cleaned_name):
                    logger.info(f"Extracted student name: {cleaned_name}")
                    return cleaned_name
        
        # Fallback: Look for any sequence of 2-4 capitalized words
        fallback_pattern = r'\b([A-Z][a-z]{2,}\s+[A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,}){0,2})\b'
        matches = re.findall(fallback_pattern, text)
        for match in matches:
            # Skip common header words
            if not any(skip_word in match.upper() for skip_word in [
                'UNIT CODE', 'UNIT DESCRIPTION', 'GRADE CREDIT', 'ACADEMIC REGISTRAR',
                'COMPUTER SCIENCE', 'BACHELOR OF', 'THE CATHOLIC', 'EASTERN AFRICA'
            ]):
                cleaned_name = self._clean_name(match)
                if self._is_valid_name(cleaned_name):
                    logger.info(f"Extracted student name (fallback): {cleaned_name}")
                    return cleaned_name
        
        logger.warning("No valid student name found")
        return ""
    
    def _extract_student_id(self, text: str) -> str:
        """Extract student ID"""
        patterns = [
            # Specific patterns for this transcript format
            r'(?:Student\s+No|Admission\s+Number):\s*(\d{6,8})',
            r'#(\d{6,8})\s+Page',  # Found in transcript: #1046098 Page 1 of 3
            r'(?:student\s+id|id\s+number|registration)[:\s]+([A-Z0-9]{6,15})',
            r'(?:id)[:\s]+([A-Z0-9]{6,15})',
            r'\b([A-Z]{2,3}\d{6,10})\b',  # Common ID format
            r'\b(\d{6,8})\b'  # Numeric ID - specific length
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                student_id = match.group(1).upper()
                logger.info(f"Extracted student ID: {student_id}")
                return student_id
        
        return ""
    
    def _extract_program(self, text: str) -> str:
        """Extract academic program"""
        patterns = [
            # Specific to transcript format: Programme: Bachelor of Science in Computer Science
            r'Programme:\s*([^\n\r]{10,80})',
            r'Program:\s*([^\n\r]{10,80})',
            r'(?:course|program|degree|study)[:\s]+([^\n\r]{10,80})',
            r'(?:bachelor|master|diploma|certificate)\s+(?:of\s+)?([^\n\r]{5,50})',
            r'(?:bsc|ba|msc|ma|phd|btech|bcom)\s+([^\n\r]{5,50})',
            r'(Bachelor\s+of\s+Science\s+in\s+Computer\s+Science)',  # Exact match for this case
            r'(computer\s+science|information\s+technology|engineering|business|medicine|law|education)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                program = self._clean_program_name(match.group(1))
                logger.info(f"Extracted program: {program}")
                return program
        
        return ""
    
    def _extract_academic_period(self, text: str) -> Tuple[int, int]:
        """Extract year and semester"""
        year = 0
        semester = 2  # Default
        
        # Year patterns - specific to transcript format: Stage: Y4S2
        year_patterns = [
            r'Stage:\s*Y(\d+)S\d+',  # Stage: Y4S2 format
            r'year[:\s]*(\d+)',
            r'(?:level|class)[:\s]*(\d+)',
            r'(\d+)(?:st|nd|rd|th)\s+year'
        ]
        
        for pattern in year_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                year_num = int(match.group(1))
                if 1 <= year_num <= 6:
                    year = max(year, year_num)
        
        # Semester patterns - specific to transcript format: Stage: Y4S2
        sem_patterns = [
            r'Stage:\s*Y\d+S(\d+)',  # Stage: Y4S2 format
            r'semester[:\s]*(\d+)',
            r'sem[:\s]*(\d+)',
            r'term[:\s]*(\d+)'
        ]
        
        for pattern in sem_patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                sem_num = int(match.group(1))
                if 1 <= sem_num <= 2:
                    semester = max(semester, sem_num)
        
        # Extract from course history - look for the most recent semester
        # Find the latest semester from course entries like "JAN-APR25"
        semester_entries = re.findall(r'(JAN-APR|SEPT-DEC|MAY-AUG)(\d{2})', text)
        if semester_entries:
            # Sort by year and get the latest
            sorted_entries = sorted(semester_entries, key=lambda x: int(x[1]), reverse=True)
            latest_entry = sorted_entries[0]
            
            # Estimate year based on latest course year
            latest_year = 2000 + int(latest_entry[1])
            current_year = 2025  # Approximate current year
            
            # Estimate student year (assuming they started 4 years ago for a degree)
            estimated_year = min(6, max(1, current_year - latest_year + 4))
            year = max(year, estimated_year)
            
        logger.info(f"Extracted academic period: Year {year}, Semester {semester}")
        return year, semester
    
    def _extract_units(self, text: str) -> List[CleanedUnit]:
        """Extract and clean academic units"""
        units = []
        lines = text.split('\n')
        
        # Simple course code counting for this specific transcript format
        # Look for course codes in the format: ABC 123 or ABC123
        course_code_pattern = r'\b([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\b'
        
        # Track unique course codes found
        found_courses = set()
        
        # Enhanced unit patterns specific to this transcript format
        patterns = [
            # Transcript format: CMT 108 INTRO. TO WEB DEVELOPMENT 24 50 74 A 3
            # Code Title Cat Exam Mark Total Score Grade Credit
            r'([A-Z]{2,4}\s+\d{3,4})\s+([A-Z][A-Z\s\.\&]{8,60})\s+\d+\s+\d+\s+\d+\s+([A-F][+-]?|[DIXZ])\s+(\d+)',
            
            # Alternative format with different spacing
            r'([A-Z]{2,4}\s+\d{3,4})\s+([A-Z][A-Z\s\.\&/]{5,50})\s+(?:\d+\s+){2,3}([A-F][+-]?|[DIXZ])\s+(\d+)',
            
            # Standard format: CIT 3105 – Machine Learning – A
            r'([A-Z]{2,4}\s*\d{3,4}[A-Z]?)\s*[–-]\s*([^–-]+)\s*[–-]\s*([A-F][+-]?|[IXZ]|PASS|FAIL)',
            
            # Tabular format: CIT3105 | Machine Learning | 3 | A
            r'([A-Z]{2,4}\d{3,4})\s*\|\s*([^|]+)\s*\|\s*(\d+)\s*\|\s*([A-F][+-]?|[IXZ])',
            
            # Simple format: CIT3105 Machine Learning A
            r'([A-Z]{2,4}\s*\d{3,4})\s+([A-Za-z\s]{10,50})\s+([A-F][+-]?|[IXZ])',
            
            # With units: CIT 3105 Machine Learning (3) A
            r'([A-Z]{2,4}\s*\d{3,4})\s+([^()]+)\s*\((\d+)\)\s*([A-F][+-]?|[IXZ])'
        ]
        
        for line in lines:
            line = line.strip()
            if len(line) < 5:
                continue
            
            # Skip header lines and non-unit lines
            if any(skip_word in line.upper() for skip_word in [
                'UNIT CODE', 'UNIT DESCRIPTION', 'GRADE CREDIT', 'PAGE', 'PROGRESSIVE', 
                'SIGNATURE', 'ACADEMIC REGISTRAR', 'KEY:', 'MEAN', 'BALANCE'
            ]):
                continue
            
            # First, try specific patterns for detailed extraction
            for pattern in patterns:
                matches = re.findall(pattern, line, re.IGNORECASE)
                for match in matches:
                    try:
                        unit = self._parse_unit_match(match, pattern)
                        if unit and self._is_valid_unit(unit):
                            units.append(unit)
                            found_courses.add(unit.code.replace(' ', '').upper())
                            logger.debug(f"Extracted unit: {unit.code} - {unit.title} ({unit.units} units, {unit.grade})")
                    except Exception as e:
                        logger.warning(f"Failed to parse unit from line: {line}, error: {e}")
            
            # Fallback: Count course codes even if we can't parse full details
            if not any(pattern for pattern in patterns if re.search(pattern, line, re.IGNORECASE)):
                course_matches = re.findall(course_code_pattern, line)
                for course_code in course_matches:
                    normalized_code = course_code.replace(' ', '').upper()
                    if normalized_code not in found_courses and len(normalized_code) >= 5:
                        # Create a basic unit entry for counting purposes
                        units.append(CleanedUnit(
                            code=course_code,
                            title="Course",  # Generic title
                            grade="A",  # Assume passed for counting
                            units=1,
                            status="complete",
                            confidence=0.5  # Lower confidence for fallback extraction
                        ))
                        found_courses.add(normalized_code)
                        logger.debug(f"Found course code: {course_code}")
        
        # Additional fallback: If still no courses found, try simple word counting
        if len(units) == 0:
            logger.warning("No courses found with standard patterns, trying simple detection")
            
            # Look for any pattern that might be course-related
            simple_course_patterns = [
                r'\b[A-Z]{2,4}\d{3,4}\b',  # Simple format: ABC123
                r'\b[A-Z]{3,4}\s+\d{3,4}\b',  # Spaced format: ABC 123
            ]
            
            all_text = ' '.join(lines)
            for pattern in simple_course_patterns:
                matches = re.findall(pattern, all_text)
                for match in matches:
                    normalized_code = match.replace(' ', '').upper()
                    if normalized_code not in found_courses:
                        units.append(CleanedUnit(
                            code=match,
                            title="Course",
                            grade="A",
                            units=1,
                            status="complete",
                            confidence=0.3  # Very low confidence
                        ))
                        found_courses.add(normalized_code)
                        logger.debug(f"Simple detection found: {match}")
        
        logger.info(f"Extracted {len(units)} units from {len(found_courses)} unique courses")
        return units
    
    def _parse_unit_match(self, match: tuple, pattern: str) -> Optional[CleanedUnit]:
        """Parse a unit match into a CleanedUnit object"""
        try:
            if len(match) == 3:  # code, title, grade
                code = self.text_cleaner.extract_course_code(match[0]) or match[0].replace(' ', '').upper()
                title = self._clean_title(match[1])
                grade = self.text_cleaner.normalize_grade(match[2])
                units = 1  # Each course = 1 unit (ignore credit values)
            elif len(match) == 4:  # code, title, credits, grade
                code = self.text_cleaner.extract_course_code(match[0]) or match[0].replace(' ', '').upper()
                title = self._clean_title(match[1])
                units = 1  # Each course = 1 unit (ignore credit values)
                grade = self.text_cleaner.normalize_grade(match[3])
            else:
                return None
            
            # Validate
            if not self._is_valid_grade(grade):
                return None
            
            status = self._determine_unit_status(grade)
            confidence = 0.9  # High confidence for pattern matches
            
            return CleanedUnit(
                code=code,
                title=title,
                grade=grade,
                units=units,
                status=status,
                confidence=confidence
            )
            
        except Exception as e:
            logger.warning(f"Failed to parse unit match: {e}")
            return None
    
    def _extract_gpa(self, text: str) -> Optional[float]:
        """Extract GPA from text"""
        patterns = [
            r'(?:gpa|cgpa)[:\s]*(\d+\.?\d*)',
            r'grade\s+point\s+average[:\s]*(\d+\.?\d*)'
        ]
        
        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE)
            if match:
                try:
                    gpa = float(match.group(1))
                    if 0.0 <= gpa <= 4.0:
                        logger.info(f"Extracted GPA: {gpa}")
                        return gpa
                except ValueError:
                    continue
        
        return None
    
    def _clean_name(self, name: str) -> str:
        """Clean and format a name"""
        if not name:
            return ""
        
        # Remove extra whitespace and special characters
        name = re.sub(r'[^\w\s]', '', name)
        name = re.sub(r'\s+', ' ', name)
        
        # Title case
        words = name.strip().split()
        cleaned_words = []
        
        for word in words:
            if len(word) > 1 and word.isalpha():
                cleaned_words.append(word.capitalize())
        
        return ' '.join(cleaned_words)
    
    def _clean_program_name(self, program: str) -> str:
        """Clean program name"""
        program = re.sub(r'[^a-zA-Z0-9\s]', ' ', program)
        program = re.sub(r'\s+', ' ', program)
        return program.strip().title()
    
    def _clean_title(self, title: str) -> str:
        """Clean course title"""
        title = re.sub(r'[^a-zA-Z0-9\s]', ' ', title)
        title = re.sub(r'\s+', ' ', title)
        return title.strip().title()
    
    def _is_valid_name(self, name: str) -> bool:
        """Check if a name looks valid"""
        if not name or len(name) < 4 or len(name) > 50:
            return False
        
        words = name.split()
        if len(words) < 2 or len(words) > 4:
            return False
        
        # Check for non-names and invalid terms
        non_names = [
            'Adobe', 'Photoshop', 'Microsoft', 'Student', 'University', 'Page',
            'Admission Number', 'Full Name', 'Student Name', 'Programme', 'Science',
            'Computer', 'Bachelor', 'Office', 'Academic', 'Registrar', 'Progressive'
        ]
        if any(non_name.lower() in name.lower() for non_name in non_names):
            return False
        
        return all(word.isalpha() and len(word) >= 2 for word in words)
    
    def _is_valid_unit(self, unit: CleanedUnit) -> bool:
        """Check if a unit looks valid"""
        if not unit.code or len(unit.code) < 5 or len(unit.code) > 10:
            return False
        
        if not unit.title or len(unit.title) < 3:
            return False
        
        # Check for invalid course codes
        invalid_codes = ['PAGE', 'YEAR', 'SEMESTER', 'GRADE']
        if any(invalid in unit.code.upper() for invalid in invalid_codes):
            return False
        
        return True
    
    def _is_valid_grade(self, grade: str) -> bool:
        """Check if a grade is valid"""
        valid_grades = [
            'A', 'B', 'C', 'D', 'E', 'F', 'I', 'X', 'Z', 'P', 'PASS', 'FAIL',
            'F*', 'AU', 'EX', 'N/A'  # Additional transcript grades
        ]
        return grade in valid_grades or re.match(r'^[A-F][+-]?$', grade)
    
    def _determine_unit_status(self, grade: str) -> str:
        """Determine unit status from grade"""
        if grade in ['I', 'X', 'Z', 'F*']:
            return 'incomplete'
        elif grade in ['F', 'FAIL']:
            return 'failed'
        elif grade in ['AU', 'N/A', 'EX']:
            return 'exempt'  # Audit/Exempt - don't count toward completion
        else:
            return 'complete'
    
    def _calculate_confidence_scores(self, name: str, program: str, units: List[CleanedUnit], text: str) -> Dict[str, float]:
        """Calculate confidence scores for extracted data"""
        scores = {}
        
        # Name confidence
        scores['name'] = 0.8 if name and self._is_valid_name(name) else 0.2
        
        # Program confidence
        scores['program'] = 0.8 if program and len(program) > 5 else 0.3
        
        # Units confidence
        if units:
            avg_unit_confidence = sum(unit.confidence for unit in units) / len(units)
            scores['units'] = avg_unit_confidence
        else:
            scores['units'] = 0.1
        
        # Overall confidence
        scores['overall'] = sum(scores.values()) / len(scores)
        
        return scores