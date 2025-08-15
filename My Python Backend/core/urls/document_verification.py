"""
URL configuration for document verification endpoints
"""

from django.urls import path
from ..views.document_verification_views import (
    DocumentVerificationView,
    analyze_pdf_structure,
    extract_text_only,
    get_verification_status
)

urlpatterns = [
    # Main document verification endpoint
    path('verify/', DocumentVerificationView.as_view(), name='verify_document'),
    
    # Analysis endpoints
    path('analyze/', analyze_pdf_structure, name='analyze_pdf'),
    path('extract/', extract_text_only, name='extract_text'),
    
    # Status endpoint
    path('status/', get_verification_status, name='verification_status'),
]