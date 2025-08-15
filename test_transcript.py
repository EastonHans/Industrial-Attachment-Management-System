#!/usr/bin/env python
"""
Test transcript verification functionality
"""
import sys
import os
sys.path.append(os.path.join(os.path.dirname(__file__), 'My Python Backend'))

import django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'iams_backend.settings')
django.setup()

def test_transcript_name_extraction():
    """Test name extraction from transcript text"""
    sample_text = """
    EASTON MICHURA OCHIENG
    1046098
    SCI
    Bachelor of Science in Computer Science
    """
    
    print("Sample transcript text:")
    print(sample_text)
    print("\n" + "="*50)
    
    # Test name extraction patterns
    import re
    
    name_patterns = [
        r'([A-Z]{2,}\s+[A-Z]{2,}\s+[A-Z]{2,})',
        r'([A-Z][A-Z\s]{10,50})',
        r'([A-Z]+\s+[A-Z]+\s+[A-Z]+)',
    ]
    
    for i, pattern in enumerate(name_patterns):
        matches = re.findall(pattern, sample_text)
        print(f"Pattern {i+1}: {pattern}")
        print(f"Matches: {matches}")
        print()

if __name__ == "__main__":
    test_transcript_name_extraction()