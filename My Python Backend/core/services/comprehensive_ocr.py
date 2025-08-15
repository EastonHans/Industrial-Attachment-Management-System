"""
Comprehensive OCR Service for Django Backend
Provides server-side OCR processing with multiple fallback methods
"""

import os
import io
import cv2
import numpy as np
from PIL import Image
import pytesseract
from pdf2image import convert_from_bytes
import PyPDF2
import logging
from typing import Dict, List, Optional, Tuple, Any
import time
import re

logger = logging.getLogger(__name__)

class ComprehensiveOCRService:
    """
    Server-side OCR service with multiple extraction methods and preprocessing
    """
    
    # OCR configuration
    TESSERACT_CONFIG = {
        'config': '--oem 1 --psm 1 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 .,;:()[]{}/-+*=@#$%&',
        'timeout': 30,
        'lang': 'eng'
    }
    
    PDF_CONFIG = {
        'dpi': 300,
        'first_page': 1,
        'last_page': 15,  # Limit pages for performance
    }

    @classmethod
    def process_document(cls, file_bytes: bytes, filename: str, options: Optional[Dict] = None) -> Dict[str, Any]:
        """
        Process document with comprehensive OCR methods
        
        Args:
            file_bytes: Document file as bytes
            filename: Original filename for type detection
            options: Optional processing parameters
            
        Returns:
            Dict containing text, confidence, method, errors, etc.
        """
        start_time = time.time()
        errors = []
        
        try:
            # Determine file type
            file_type = cls._detect_file_type(file_bytes, filename)
            logger.info(f"Processing {file_type} document: {filename}")
            
            if file_type == 'pdf':
                return cls._process_pdf(file_bytes, start_time, errors, options)
            elif file_type in ['image', 'jpg', 'jpeg', 'png', 'tiff', 'bmp']:
                return cls._process_image(file_bytes, start_time, errors, options)
            else:
                raise ValueError(f"Unsupported file type: {file_type}")
                
        except Exception as e:
            logger.error(f"OCR processing failed for {filename}: {str(e)}")
            return {
                'text': '',
                'confidence': 0.0,
                'method': 'failed',
                'processing_time': time.time() - start_time,
                'errors': [f"Processing failed: {str(e)}"],
                'success': False
            }

    @classmethod
    def _process_pdf(cls, file_bytes: bytes, start_time: float, errors: List[str], options: Optional[Dict] = None) -> Dict[str, Any]:
        """Process PDF with multiple extraction methods"""
        
        # Method 1: Try native PDF text extraction
        try:
            native_text = cls._extract_native_pdf_text(file_bytes)
            if cls._is_text_meaningful(native_text):
                logger.info("✓ Native PDF extraction successful")
                return {
                    'text': native_text,
                    'confidence': 0.95,
                    'method': 'pdf-native',
                    'processing_time': time.time() - start_time,
                    'errors': errors,
                    'success': True
                }
            else:
                errors.append("Native PDF extraction yielded insufficient text")
        except Exception as e:
            errors.append(f"Native PDF extraction failed: {str(e)}")
            logger.warning(f"Native PDF extraction failed: {str(e)}")

        # Method 2: PDF to Image OCR
        try:
            logger.info("→ Falling back to PDF-to-Image OCR...")
            ocr_result = cls._extract_pdf_via_ocr(file_bytes, options)
            return {
                **ocr_result,
                'method': 'pdf-ocr',
                'processing_time': time.time() - start_time,
                'errors': errors,
                'success': True
            }
        except Exception as e:
            errors.append(f"PDF OCR failed: {str(e)}")
            logger.error(f"PDF OCR failed: {str(e)}")

        return {
            'text': '',
            'confidence': 0.0,
            'method': 'pdf-ocr',
            'processing_time': time.time() - start_time,
            'errors': errors,
            'success': False
        }

    @classmethod
    def _process_image(cls, file_bytes: bytes, start_time: float, errors: List[str], options: Optional[Dict] = None) -> Dict[str, Any]:
        """Process image file with OCR"""
        
        try:
            logger.info("→ Processing image with OCR...")
            
            # Load image
            image = Image.open(io.BytesIO(file_bytes))
            
            # Preprocess image if enabled
            preprocessed_image = cls._preprocess_image(image)
            
            # Extract text with confidence
            ocr_data = pytesseract.image_to_data(
                preprocessed_image, 
                output_type=pytesseract.Output.DICT,
                config=cls.TESSERACT_CONFIG['config'],
                timeout=cls.TESSERACT_CONFIG['timeout']
            )
            
            # Filter out low confidence words and build text
            text_parts = []
            confidences = []
            
            for i, conf in enumerate(ocr_data['conf']):
                if int(conf) > 30 and ocr_data['text'][i].strip():  # Filter low confidence
                    text_parts.append(ocr_data['text'][i])
                    confidences.append(int(conf))
            
            final_text = ' '.join(text_parts)
            avg_confidence = np.mean(confidences) / 100 if confidences else 0.0
            
            return {
                'text': final_text,
                'confidence': avg_confidence,
                'method': 'image-ocr',
                'processing_time': time.time() - start_time,
                'errors': errors,
                'success': True
            }
            
        except Exception as e:
            logger.error(f"Image OCR failed: {str(e)}")
            errors.append(f"Image OCR failed: {str(e)}")
            return {
                'text': '',
                'confidence': 0.0,
                'method': 'image-ocr',
                'processing_time': time.time() - start_time,
                'errors': errors,
                'success': False
            }

    @classmethod
    def _extract_native_pdf_text(cls, file_bytes: bytes) -> str:
        """Extract text natively from PDF using PyPDF2"""
        
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text_parts = []
        
        max_pages = min(len(pdf_reader.pages), cls.PDF_CONFIG['last_page'])
        
        for page_num in range(max_pages):
            try:
                page = pdf_reader.pages[page_num]
                page_text = page.extract_text()
                if page_text.strip():
                    text_parts.append(page_text)
            except Exception as e:
                logger.warning(f"Failed to extract text from page {page_num + 1}: {str(e)}")
                continue
        
        return '\n'.join(text_parts)

    @classmethod
    def _extract_pdf_via_ocr(cls, file_bytes: bytes, options: Optional[Dict] = None) -> Dict[str, Any]:
        """Convert PDF pages to images and process with OCR"""
        
        # Convert PDF to images
        images = convert_from_bytes(
            file_bytes,
            dpi=cls.PDF_CONFIG['dpi'],
            first_page=cls.PDF_CONFIG['first_page'],
            last_page=cls.PDF_CONFIG['last_page']
        )
        
        all_text = []
        confidences = []
        
        for page_num, image in enumerate(images, 1):
            try:
                # Preprocess image
                processed_image = cls._preprocess_image(image)
                
                # OCR with confidence data
                ocr_data = pytesseract.image_to_data(
                    processed_image,
                    output_type=pytesseract.Output.DICT,
                    config=cls.TESSERACT_CONFIG['config'],
                    timeout=cls.TESSERACT_CONFIG['timeout']
                )
                
                # Filter and collect text with confidence
                page_text_parts = []
                page_confidences = []
                
                for i, conf in enumerate(ocr_data['conf']):
                    if int(conf) > 20 and ocr_data['text'][i].strip():
                        page_text_parts.append(ocr_data['text'][i])
                        page_confidences.append(int(conf))
                
                if page_text_parts:
                    page_text = ' '.join(page_text_parts)
                    all_text.append(f"\n--- Page {page_num} ---\n{page_text}")
                    confidences.extend(page_confidences)
                    
                    logger.info(f"Page {page_num}: {np.mean(page_confidences):.1f}% confidence, {len(page_text)} chars")
                
            except Exception as e:
                logger.warning(f"Failed to process page {page_num}: {str(e)}")
                continue
        
        final_text = '\n'.join(all_text)
        avg_confidence = np.mean(confidences) / 100 if confidences else 0.0
        
        return {
            'text': final_text,
            'confidence': avg_confidence
        }

    @classmethod
    def _preprocess_image(cls, image: Image.Image) -> np.ndarray:
        """
        Preprocess image to improve OCR accuracy
        """
        try:
            # Convert PIL image to OpenCV format
            opencv_image = cv2.cvtColor(np.array(image), cv2.COLOR_RGB2BGR)
            
            # Convert to grayscale
            gray = cv2.cvtColor(opencv_image, cv2.COLOR_BGR2GRAY)
            
            # Noise removal
            denoised = cv2.fastNlMeansDenoising(gray)
            
            # Thresholding for better contrast
            _, thresh = cv2.threshold(denoised, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
            
            # Morphological operations to clean up
            kernel = np.ones((1, 1), np.uint8)
            processed = cv2.morphologyEx(thresh, cv2.MORPH_CLOSE, kernel)
            
            # Deskewing (optional - can be computationally expensive)
            # processed = cls._deskew_image(processed)
            
            return processed
            
        except Exception as e:
            logger.warning(f"Image preprocessing failed: {str(e)}, using original")
            # Return original image as numpy array if preprocessing fails
            return np.array(image.convert('L'))  # Convert to grayscale

    @classmethod
    def _detect_file_type(cls, file_bytes: bytes, filename: str) -> str:
        """Detect file type from bytes and filename"""
        
        # Check file signature (magic bytes)
        if file_bytes[:4] == b'%PDF':
            return 'pdf'
        elif file_bytes[:2] == b'\xff\xd8':  # JPEG
            return 'jpeg'
        elif file_bytes[:8] == b'\x89PNG\r\n\x1a\n':  # PNG
            return 'png'
        elif file_bytes[:2] in [b'II', b'MM']:  # TIFF
            return 'tiff'
        elif file_bytes[:2] == b'BM':  # BMP
            return 'bmp'
        
        # Fallback to filename extension
        ext = filename.lower().split('.')[-1] if '.' in filename else ''
        if ext in ['pdf']:
            return 'pdf'
        elif ext in ['jpg', 'jpeg', 'png', 'tiff', 'tif', 'bmp']:
            return 'image'
        
        return 'unknown'

    @classmethod
    def _is_text_meaningful(cls, text: str) -> bool:
        """Check if extracted text is meaningful"""
        
        if not text or len(text.strip()) < 50:
            return False
        
        clean_text = re.sub(r'\s+', ' ', text).strip()
        word_count = len(clean_text.split())
        
        # Check for reasonable content
        has_letters = bool(re.search(r'[a-zA-Z]{3,}', clean_text))
        has_reasonable_length = len(clean_text) > 100
        has_enough_words = word_count > 20
        
        return has_letters and has_reasonable_length and has_enough_words

# Utility functions for transcript processing
class TranscriptAnalyzer:
    """Analyze transcript content for student verification"""
    
    @classmethod
    def extract_student_name(cls, text: str, filename: str = '') -> str:
        """Extract student name from transcript text"""
        
        # Name patterns to look for
        name_patterns = [
            # CUEA specific pattern - name above student number (primary pattern)
            r'([A-Z]+\s+[A-Z]+\s+[A-Z]+)\s*\n\s*\d{6,8}',
            # Look for names before student ID numbers
            r'([A-Z][A-Z\s]+[A-Z])\s*\n\s*(\d{7,})',  # Name above student ID
            # Pattern for "EASTON MICHURA OCHIENG" type names
            r'\b([A-Z]{3,}\s+[A-Z]{3,}\s+[A-Z]{3,})\b',
            # Look for names in transcript headers
            r'([A-Z][A-Z\s]+[A-Z])\s*(?:ID|STUDENT|REG|ADMISSION)',  # Uppercase names
            # Standard name field patterns
            r'(?:student\s+name|name\s+of\s+student|full\s+name)[:\s]*([^\n\r]{5,50})',
            r'(?:name)[:\s]*([A-Z][a-z]+(?:\s+[A-Z][a-z]+){1,3})',
        ]
        
        for pattern in name_patterns:
            matches = re.finditer(pattern, text, re.IGNORECASE | re.MULTILINE)
            for match in matches:
                candidate_name = match.group(1).strip()
                if cls._is_valid_name(candidate_name):
                    return cls._clean_name(candidate_name)
        
        # Fallback to filename extraction
        return cls._extract_name_from_filename(filename)
    
    @classmethod
    def analyze_units(cls, text: str) -> Dict[str, Any]:
        """Analyze completed units from transcript"""
        
        completed_units = 0
        has_incomplete_units = False
        unit_details = []
        
        # Unit patterns
        unit_patterns = [
            r'(?:credit\s*(?:hours?|units?)?\s*:?\s*(\d+))\s*.*?(?:grade\s*:?\s*([A-F][+-]?|[IXZ]))',
            r'([A-Z]{2,4}\s*\d{3,4})\s+.*?(\d+)\s*(?:units?|credits?|hrs?)\s*.*?([A-F][+-]?|[IXZ])',
            r'([A-F][+-]?|[IXZ])\s*.*?(\d+)\s*(?:units?|credits?)',
        ]
        
        lines = text.split('\n')
        
        for line in lines:
            line = line.strip()
            if not line:
                continue
            
            for pattern in unit_patterns:
                matches = re.finditer(pattern, line, re.IGNORECASE)
                
                for match in matches:
                    groups = match.groups()
                    
                    # Extract units and grade based on pattern
                    if len(groups) >= 2:
                        try:
                            if groups[0].isdigit():  # First group is units
                                units = int(groups[0])
                                grade = groups[1].upper()
                            elif groups[1].isdigit():  # Second group is units
                                units = int(groups[1])
                                grade = groups[2].upper() if len(groups) > 2 else groups[0].upper()
                            else:
                                continue
                            
                            if units <= 0 or units > 10:
                                continue
                            
                            unit_details.append({
                                'course': groups[0] if not groups[0].isdigit() else 'Course',
                                'units': units,
                                'grade': grade
                            })
                            
                            # Count completed units
                            if re.match(r'^[A-F][+-]?$', grade) and grade != 'F':
                                completed_units += units
                            elif re.match(r'^[IXZ]$', grade):
                                has_incomplete_units = True
                                
                        except (ValueError, IndexError):
                            continue
        
        # Look for summary lines
        summary_patterns = [
            r'(?:total|completed|earned)\s*(?:units?|credits?|hours?)[:\s]*(\d+)',
        ]
        
        for line in lines:
            for pattern in summary_patterns:
                match = re.search(pattern, line, re.IGNORECASE)
                if match:
                    summary_units = int(match.group(1))
                    if 10 <= summary_units <= 200:  # Reasonable range
                        completed_units = max(completed_units, summary_units)
        
        return {
            'completed_units': completed_units,
            'has_incomplete_units': has_incomplete_units,
            'unit_details': unit_details
        }
    
    @classmethod
    def _is_valid_name(cls, candidate: str) -> bool:
        """Check if candidate string looks like a valid name"""
        
        if not candidate or len(candidate) < 5 or len(candidate) > 50:
            return False
        
        words = candidate.split()
        if len(words) < 2 or len(words) > 4:
            return False
        
        # Check for academic/system words to exclude
        exclude_words = {
            'UNIT', 'CODE', 'DESCRIPTION', 'GRADE', 'CREDIT', 'OBJECT', 'ORIENTED',
            'PROGRAMMING', 'COMPUTER', 'SCIENCE', 'BACHELOR', 'EASTERN', 'AFRICA',
            'CATHOLIC', 'UNIVERSITY', 'ACADEMIC', 'REGISTRAR', 'TRANSCRIPT',
            'STUDENT', 'NUMBER', 'STAGE', 'SEMESTER', 'YEAR', 'MARKS', 'POINTS'
        }
        
        if any(word.upper() in exclude_words for word in words):
            return False
        
        # Accept both title case (Easton) and uppercase (EASTON) names
        return all(
            word.isalpha() and 2 <= len(word) <= 15 and 
            (word[0].isupper() or word.isupper())
            for word in words
        )
    
    @classmethod
    def _clean_name(cls, name: str) -> str:
        """Clean and format name"""
        return re.sub(r'[^\w\s]', '', name).strip().title()
    
    @classmethod
    def _extract_name_from_filename(cls, filename: str) -> str:
        """Extract name from filename as fallback"""
        
        if not filename:
            return 'Unknown Student'
        
        # Remove extension and common words
        name_candidate = re.sub(r'\.[^.]*$', '', filename)  # Remove extension
        name_candidate = re.sub(r'[_-]', ' ', name_candidate)  # Replace separators
        name_candidate = re.sub(
            r'\b(?:transcript|record|academic|student|attachment|eligibility)\b',
            '', name_candidate, flags=re.IGNORECASE
        )
        name_candidate = re.sub(r'\s+', ' ', name_candidate).strip()
        
        return cls._clean_name(name_candidate) if name_candidate else 'Unknown Student'