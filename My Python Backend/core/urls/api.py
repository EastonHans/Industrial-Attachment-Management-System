from django.urls import path, include
from rest_framework.routers import DefaultRouter
from ..views.api_views import (
    UserViewSet, ProfileViewSet, StudentViewSet, SupervisorViewSet, CompanyViewSet, AttachmentViewSet,
    SupervisorAssignmentViewSet, VerificationStatusViewSet, WeeklyLogViewSet,
    EvaluationViewSet, ReimbursementViewSet, MessageViewSet
)
from ..views.ocr_views import process_transcript, process_fee_statement

router = DefaultRouter()
router.register(r'users', UserViewSet)
router.register(r'profiles', ProfileViewSet)
router.register(r'students', StudentViewSet)
router.register(r'supervisors', SupervisorViewSet)  
router.register(r'companies', CompanyViewSet)
router.register(r'attachments', AttachmentViewSet)
router.register(r'supervisor-assignments', SupervisorAssignmentViewSet)
router.register(r'verification-status', VerificationStatusViewSet)
router.register(r'weekly-logs', WeeklyLogViewSet)
router.register(r'evaluations', EvaluationViewSet)
router.register(r'reimbursements', ReimbursementViewSet)
router.register(r'messages', MessageViewSet)

urlpatterns = [
    path('', include(router.urls)),
    # OCR endpoints
    path('ocr/transcript/', process_transcript, name='process_transcript'),
    path('ocr/fee-statement/', process_fee_statement, name='process_fee_statement'),
]