"""
Intelligent PDF Document Processor for Academic Transcripts
Uses multiple heuristics to detect PDF type and apply optimal extraction method
"""

import io
import logging
import time
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
from pathlib import Path

# PDF Processing Libraries
import fitz  # PyMuPDF
import pdfplumber
from pdfminer.high_level import extract_text as pdfminer_extract_text
from pdfminer.layout import LAParams

# OCR Libraries
import pytesseract
from PIL import Image
import cv2
import numpy as np

# Text Processing
import re
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

@dataclass
class PDFAnalysisResult:
    """Results from PDF structure analysis"""
    is_digital: bool
    text_coverage: float  # Percentage of page covered by extractable text
    has_fonts: bool
    has_images: bool
    page_count: int
    extraction_method: str
    confidence: float
    analysis_details: Dict[str, Any]

@dataclass
class ExtractionResult:
    """Results from text extraction"""
    text: str
    method: str
    confidence: float
    processing_time: float
    page_count: int
    errors: List[str]
    metadata: Dict[str, Any]

@dataclass
class TranscriptData:
    """Cleaned and structured transcript data"""
    student_name: str
    student_id: str
    program: str
    year: int
    semester: int
    units: List[Dict[str, Any]]
    total_units: int
    completed_units: int
    gpa: Optional[float]
    confidence_scores: Dict[str, float]
    raw_data: Dict[str, Any]

class IntelligentPDFProcessor:
    """
    Advanced PDF processor with intelligent type detection and optimal extraction
    """
    
    def __init__(self):
        self.tesseract_config = {
            'lang': 'eng',
            'config': '--psm 1 --oem 3 -c tessedit_char_whitelist=ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789.,;:()/- '
        }
        
        # Academic keywords for validation
        self.academic_keywords = [
            'transcript', 'student', 'course', 'unit', 'grade', 'semester',
            'program', 'degree', 'university', 'college', 'gpa', 'credit'
        ]
        
    def analyze_pdf_structure(self, pdf_bytes: bytes) -> PDFAnalysisResult:
        """
        Analyze PDF structure using multiple heuristics to determine optimal extraction method
        """
        start_time = time.time()
        
        try:
            # Open with PyMuPDF for detailed analysis
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = len(doc)
            
            analysis_details = {
                'text_blocks_per_page': [],
                'image_blocks_per_page': [],
                'font_coverage': [],
                'text_density': [],
                'extraction_methods_tested': []
            }
            
            total_text_coverage = 0
            has_fonts = False
            has_images = False
            digital_indicators = 0
            scanned_indicators = 0
            
            # Analyze each page (limit to first 5 pages for performance)
            pages_to_analyze = min(5, page_count)
            
            for page_num in range(pages_to_analyze):
                page = doc[page_num]
                
                # Heuristic 1: Check for extractable text blocks
                text_blocks = page.get_text("dict")
                text_block_count = len(text_blocks.get('blocks', []))
                analysis_details['text_blocks_per_page'].append(text_block_count)
                
                if text_block_count > 5:  # Significant text content
                    digital_indicators += 2
                
                # Heuristic 2: Analyze fonts and text layout
                font_info = []
                for block in text_blocks.get('blocks', []):
                    if 'lines' in block:
                        for line in block['lines']:
                            for span in line.get('spans', []):
                                font_info.append({
                                    'font': span.get('font', ''),
                                    'size': span.get('size', 0),
                                    'text': span.get('text', '')
                                })
                
                if font_info:
                    has_fonts = True
                    font_coverage = len([f for f in font_info if f['text'].strip()])
                    analysis_details['font_coverage'].append(font_coverage)
                    digital_indicators += 1
                
                # Heuristic 3: Check for images and their characteristics
                image_list = page.get_images()
                image_count = len(image_list)
                analysis_details['image_blocks_per_page'].append(image_count)
                
                if image_count > 0:
                    has_images = True
                    # Large images that cover most of the page suggest scanned content
                    for img_index, img in enumerate(image_list):
                        try:
                            xref = img[0]
                            pix = fitz.Pixmap(doc, xref)
                            if pix.width > 1000 and pix.height > 1000:  # Large image
                                scanned_indicators += 2
                            pix = None  # Free memory
                        except:
                            pass
                
                # Heuristic 4: Text density analysis
                page_text = page.get_text()
                page_area = page.rect.width * page.rect.height
                text_density = len(page_text) / page_area if page_area > 0 else 0
                analysis_details['text_density'].append(text_density)
                
                if text_density > 0.01:  # Good text density suggests digital PDF
                    digital_indicators += 1
                elif text_density < 0.001:  # Very low density suggests scanned
                    scanned_indicators += 1
                
                # Heuristic 5: Test extraction quality
                extracted_text = page.get_text()
                if len(extracted_text.strip()) > 100:
                    # Check if extracted text looks meaningful
                    academic_keyword_count = sum(1 for keyword in self.academic_keywords 
                                               if keyword.lower() in extracted_text.lower())
                    if academic_keyword_count >= 2:
                        digital_indicators += 2
                        total_text_coverage += len(extracted_text) / 1000  # Normalize
                
            doc.close()
            
            # Determine PDF type based on heuristics
            is_digital = digital_indicators > scanned_indicators
            
            # Calculate confidence based on strength of indicators
            total_indicators = digital_indicators + scanned_indicators
            confidence = max(digital_indicators, scanned_indicators) / max(total_indicators, 1)
            
            # Calculate average text coverage
            text_coverage = min(total_text_coverage / pages_to_analyze, 100.0)
            
            # Determine extraction method
            if is_digital and text_coverage > 20:
                extraction_method = "digital_text"
            elif is_digital and text_coverage > 5:
                extraction_method = "hybrid"
            else:
                extraction_method = "ocr_only"
            
            analysis_details.update({
                'digital_indicators': digital_indicators,
                'scanned_indicators': scanned_indicators,
                'analysis_time': time.time() - start_time
            })
            
            logger.info(f"PDF Analysis: Digital={is_digital}, Coverage={text_coverage:.1f}%, Method={extraction_method}")
            
            return PDFAnalysisResult(
                is_digital=is_digital,
                text_coverage=text_coverage,
                has_fonts=has_fonts,
                has_images=has_images,
                page_count=page_count,
                extraction_method=extraction_method,
                confidence=confidence,
                analysis_details=analysis_details
            )
            
        except Exception as e:
            logger.error(f"PDF analysis failed: {str(e)}")
            # Fallback to OCR-only method
            return PDFAnalysisResult(
                is_digital=False,
                text_coverage=0.0,
                has_fonts=False,
                has_images=True,
                page_count=1,
                extraction_method="ocr_only",
                confidence=0.5,
                analysis_details={'error': str(e)}
            )
    
    def extract_digital_text(self, pdf_bytes: bytes) -> ExtractionResult:
        """
        Extract text from digital PDFs using multiple libraries for best results
        """
        start_time = time.time()
        errors = []
        best_text = ""
        best_method = ""
        best_confidence = 0.0
        
        # Method 1: PyMuPDF (fastest and handles complex layouts well)
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            pymupdf_text = ""
            for page_num in range(min(len(doc), 20)):  # Limit pages for performance
                page = doc[page_num]
                page_text = page.get_text()
                pymupdf_text += f"\n--- Page {page_num + 1} ---\n{page_text}"
            doc.close()
            
            pymupdf_confidence = self._calculate_text_quality(pymupdf_text)
            if pymupdf_confidence > best_confidence:
                best_text = pymupdf_text
                best_method = "pymupdf"
                best_confidence = pymupdf_confidence
                
            logger.info(f"PyMuPDF: {len(pymupdf_text)} chars, {pymupdf_confidence:.2f} confidence")
            
        except Exception as e:
            errors.append(f"PyMuPDF failed: {str(e)}")
            logger.warning(f"PyMuPDF extraction failed: {str(e)}")
        
        # Method 2: pdfplumber (excellent for tables and structured data)
        try:
            with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
                pdfplumber_text = ""
                for page_num, page in enumerate(pdf.pages[:20]):  # Limit pages
                    page_text = page.extract_text() or ""
                    pdfplumber_text += f"\n--- Page {page_num + 1} ---\n{page_text}"
            
            pdfplumber_confidence = self._calculate_text_quality(pdfplumber_text)
            if pdfplumber_confidence > best_confidence:
                best_text = pdfplumber_text
                best_method = "pdfplumber"
                best_confidence = pdfplumber_confidence
                
            logger.info(f"pdfplumber: {len(pdfplumber_text)} chars, {pdfplumber_confidence:.2f} confidence")
            
        except Exception as e:
            errors.append(f"pdfplumber failed: {str(e)}")
            logger.warning(f"pdfplumber extraction failed: {str(e)}")
        
        # Method 3: pdfminer (robust for complex layouts)
        try:
            laparams = LAParams(
                word_margin=0.1,
                char_margin=2.0,
                line_margin=0.5,
                boxes_flow=0.5
            )
            pdfminer_text = pdfminer_extract_text(io.BytesIO(pdf_bytes), laparams=laparams)
            
            pdfminer_confidence = self._calculate_text_quality(pdfminer_text)
            if pdfminer_confidence > best_confidence:
                best_text = pdfminer_text
                best_method = "pdfminer"
                best_confidence = pdfminer_confidence
                
            logger.info(f"pdfminer: {len(pdfminer_text)} chars, {pdfminer_confidence:.2f} confidence")
            
        except Exception as e:
            errors.append(f"pdfminer failed: {str(e)}")
            logger.warning(f"pdfminer extraction failed: {str(e)}")
        
        processing_time = time.time() - start_time
        
        # Count pages for metadata
        page_count = 1
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            page_count = len(doc)
            doc.close()
        except:
            pass
        
        return ExtractionResult(
            text=best_text,
            method=f"digital_{best_method}",
            confidence=best_confidence,
            processing_time=processing_time,
            page_count=page_count,
            errors=errors,
            metadata={
                'extraction_methods_tried': ['pymupdf', 'pdfplumber', 'pdfminer'],
                'best_method': best_method,
                'text_length': len(best_text)
            }
        )
    
    def extract_with_ocr(self, pdf_bytes: bytes) -> ExtractionResult:
        """
        Extract text using optimized OCR for scanned documents
        """
        start_time = time.time()
        errors = []
        
        try:
            doc = fitz.open(stream=pdf_bytes, filetype="pdf")
            full_text = ""
            total_confidence = 0.0
            pages_processed = 0
            
            for page_num in range(min(len(doc), 15)):  # Limit pages for performance
                try:
                    page = doc[page_num]
                    
                    # Convert page to high-resolution image
                    mat = fitz.Matrix(2.0, 2.0)  # 2x scaling for better OCR
                    pix = page.get_pixmap(matrix=mat)
                    img_data = pix.tobytes("png")
                    pix = None  # Free memory
                    
                    # Convert to PIL Image
                    image = Image.open(io.BytesIO(img_data))
                    
                    # Preprocess image for better OCR
                    processed_image = self._preprocess_image_for_ocr(image)
                    
                    # Run OCR with optimized settings
                    ocr_result = pytesseract.image_to_data(
                        processed_image,
                        lang=self.tesseract_config['lang'],
                        config=self.tesseract_config['config'],
                        output_type=pytesseract.Output.DICT
                    )
                    
                    # Extract text and calculate page confidence
                    page_text = " ".join([
                        text for text, conf in zip(ocr_result['text'], ocr_result['conf'])
                        if int(conf) > 30 and text.strip()  # Filter low-confidence words
                    ])
                    
                    if page_text.strip():
                        full_text += f"\n--- Page {page_num + 1} ---\n{page_text}"
                        page_confidence = np.mean([
                            int(conf) for conf in ocr_result['conf'] 
                            if int(conf) > 0
                        ])
                        total_confidence += page_confidence
                        pages_processed += 1
                        
                        logger.info(f"OCR Page {page_num + 1}: {len(page_text)} chars, {page_confidence:.1f}% confidence")
                    
                except Exception as e:
                    errors.append(f"OCR failed for page {page_num + 1}: {str(e)}")
                    logger.warning(f"OCR failed for page {page_num + 1}: {str(e)}")
            
            doc.close()
            
            # Calculate overall confidence
            overall_confidence = (total_confidence / pages_processed / 100.0) if pages_processed > 0 else 0.0
            
            processing_time = time.time() - start_time
            
            return ExtractionResult(
                text=full_text,
                method="ocr_tesseract",
                confidence=overall_confidence,
                processing_time=processing_time,
                page_count=pages_processed,
                errors=errors,
                metadata={
                    'tesseract_config': self.tesseract_config,
                    'pages_processed': pages_processed,
                    'average_confidence': total_confidence / pages_processed if pages_processed > 0 else 0
                }
            )
            
        except Exception as e:
            error_msg = f"OCR extraction failed: {str(e)}"
            errors.append(error_msg)
            logger.error(error_msg)
            
            return ExtractionResult(
                text="",
                method="ocr_failed",
                confidence=0.0,
                processing_time=time.time() - start_time,
                page_count=0,
                errors=errors,
                metadata={'fatal_error': str(e)}
            )
    
    def _preprocess_image_for_ocr(self, image: Image.Image) -> Image.Image:
        """
        Apply image preprocessing to improve OCR accuracy
        """
        try:
            # Convert PIL to OpenCV
            img_array = np.array(image)
            if len(img_array.shape) == 3:
                img_gray = cv2.cvtColor(img_array, cv2.COLOR_RGB2GRAY)
            else:
                img_gray = img_array
            
            # Apply preprocessing techniques
            # 1. Noise reduction
            img_denoised = cv2.fastNlMeansDenoising(img_gray)
            
            # 2. Contrast enhancement
            clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8,8))
            img_enhanced = clahe.apply(img_denoised)
            
            # 3. Binarization with adaptive threshold
            img_binary = cv2.adaptiveThreshold(
                img_enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C, 
                cv2.THRESH_BINARY, 11, 2
            )
            
            # Convert back to PIL
            return Image.fromarray(img_binary)
            
        except Exception as e:
            logger.warning(f"Image preprocessing failed: {str(e)}, using original")
            return image
    
    def _calculate_text_quality(self, text: str) -> float:
        """
        Calculate quality score for extracted text based on academic content
        """
        if not text or len(text.strip()) < 50:
            return 0.0
        
        score = 0.0
        
        # Check for academic keywords
        academic_keyword_count = sum(1 for keyword in self.academic_keywords 
                                   if keyword.lower() in text.lower())
        score += min(academic_keyword_count * 0.1, 0.5)  # Max 0.5 from keywords
        
        # Check text structure
        lines = text.split('\n')
        non_empty_lines = [line.strip() for line in lines if line.strip()]
        
        if len(non_empty_lines) > 10:
            score += 0.2  # Good line structure
        
        # Check for common transcript patterns
        patterns = [
            r'[A-Z]{2,4}\s*\d{3,4}',  # Course codes
            r'[A-F][+-]?|\bPass\b|\bFail\b',  # Grades
            r'\d+\s*(?:units?|credits?)',  # Units
            r'GPA|CGPA',  # GPA indicators
            r'Semester|Year|Program'  # Academic terms
        ]
        
        pattern_matches = sum(1 for pattern in patterns 
                            if re.search(pattern, text, re.IGNORECASE))
        score += min(pattern_matches * 0.05, 0.3)  # Max 0.3 from patterns
        
        return min(score, 1.0)  # Cap at 1.0
    
    def process_document(self, pdf_bytes: bytes) -> Tuple[ExtractionResult, PDFAnalysisResult]:
        """
        Main entry point: analyze PDF and extract text using optimal method
        """
        logger.info("Starting intelligent PDF processing...")
        
        # Step 1: Analyze PDF structure
        analysis = self.analyze_pdf_structure(pdf_bytes)
        
        # Step 2: Choose and apply extraction method
        if analysis.extraction_method == "digital_text":
            logger.info("Using digital text extraction (lossless)")
            extraction = self.extract_digital_text(pdf_bytes)
        elif analysis.extraction_method == "hybrid":
            logger.info("Using hybrid extraction (digital + OCR fallback)")
            extraction = self.extract_digital_text(pdf_bytes)
            # If digital extraction yields poor results, fall back to OCR
            if extraction.confidence < 0.3:
                logger.info("Digital extraction poor, falling back to OCR")
                extraction = self.extract_with_ocr(pdf_bytes)
        else:
            logger.info("Using OCR extraction (scanned document)")
            extraction = self.extract_with_ocr(pdf_bytes)
        
        logger.info(f"Extraction complete: {extraction.method}, {extraction.confidence:.2f} confidence")
        
        return extraction, analysis
    
    def extract_transcript_data(self, text: str) -> TranscriptData:
        """
        Extract and structure transcript data from raw text
        """
        from .transcript_data_extractor import TranscriptDataExtractor
        
        # Use the existing transcript data extractor
        extractor = TranscriptDataExtractor()
        return extractor.extract_structured_data(text)