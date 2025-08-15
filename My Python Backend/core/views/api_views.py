from rest_framework import viewsets, permissions, status
from rest_framework.decorators import action
from rest_framework.response import Response
from django.db.models import Q
from ..models import (
    User, Profile, Student, Supervisor, Company, Attachment, SupervisorAssignment,
    VerificationStatus, WeeklyLog, Evaluation, Reimbursement, Message
)
from ..serializers import (
    UserSerializer, ProfileSerializer, StudentSerializer, SupervisorSerializer, CompanySerializer, AttachmentSerializer,
    SupervisorAssignmentSerializer, VerificationStatusSerializer, WeeklyLogSerializer,
    EvaluationSerializer, ReimbursementSerializer, MessageSerializer
)

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all()
    serializer_class = UserSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Only admins can manage users
        if self.request.user.role in ['admin', 'dean']:
            return User.objects.all()
        else:
            # Non-admins can only see their own user record
            return User.objects.filter(id=self.request.user.id)

    def perform_destroy(self, instance):
        """
        When deleting a user, also ensure proper cleanup
        Django CASCADE will automatically delete related Profile, Student, Supervisor records
        """
        instance.delete()

    @action(detail=False, methods=['get'], permission_classes=[permissions.IsAuthenticated])
    def check_data_integrity(self, request):
        """
        Check for data integrity issues like orphaned users, missing profiles, etc.
        Only accessible by admin users.
        """
        if request.user.role not in ['admin', 'dean']:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        
        # Get all users
        all_users = User.objects.all()
        
        # Initialize issue tracking
        orphaned_users = []
        missing_profiles = []
        missing_role_records = []
        
        for user in all_users:
            issues = []
            
            # Check for missing Profile
            try:
                profile = user.profile
            except Profile.DoesNotExist:
                issues.append('missing_profile')
                missing_profiles.append({
                    'user_id': str(user.id),
                    'email': user.email,
                    'role': user.role,
                    'issues': ['missing_profile'],
                    'is_active': user.is_active
                })
            
            # Check for missing role-specific records
            if user.role == 'student':
                try:
                    student = user.student_profile
                except Student.DoesNotExist:
                    issues.append('missing_student_record')
                    missing_role_records.append({
                        'user_id': str(user.id),
                        'email': user.email,
                        'role': user.role,
                        'issues': ['missing_student_record'],
                        'is_active': user.is_active,
                        'missing_record': 'Student'
                    })
            elif user.role == 'supervisor':
                try:
                    supervisor = user.supervisor_profile
                except Supervisor.DoesNotExist:
                    issues.append('missing_supervisor_record')
                    missing_role_records.append({
                        'user_id': str(user.id),
                        'email': user.email,
                        'role': user.role,
                        'issues': ['missing_supervisor_record'],
                        'is_active': user.is_active,
                        'missing_record': 'Supervisor'
                    })
            
            # If user has issues, add to orphaned users
            if issues:
                orphaned_users.append({
                    'user_id': str(user.id),
                    'email': user.email,
                    'role': user.role,
                    'issues': issues,
                    'is_active': user.is_active
                })
        
        # Generate recommendations
        recommendations = []
        total_issues = len(missing_profiles) + len(missing_role_records)
        
        if total_issues == 0:
            recommendations.append("✅ No integrity issues found! Database is healthy.")
        else:
            if missing_profiles:
                recommendations.append("🔧 Click 'Fix Profile Issues' to create missing profile records")
            if missing_role_records:
                recommendations.append("⚠️ Users without role records should be reviewed manually")
                recommendations.append("🗑️ Consider deleting orphaned users that can't be fixed")
            recommendations.append("🔄 Run regular integrity checks to prevent future issues")
        
        return Response({
            'total_users': all_users.count(),
            'issues_found': total_issues,
            'orphaned_users': orphaned_users,
            'missing_profiles': missing_profiles,
            'missing_role_records': missing_role_records,
            'recommendations': recommendations
        })

    @action(detail=False, methods=['post'], permission_classes=[permissions.IsAuthenticated])
    def fix_profile_issues(self, request):
        """
        Create missing Profile records for users who don't have them.
        Only accessible by admin users.
        """
        if request.user.role not in ['admin', 'dean']:
            return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)
        
        fixed_count = 0
        errors = []
        
        # Get all users without profiles
        users_without_profiles = []
        for user in User.objects.all():
            try:
                profile = user.profile
            except Profile.DoesNotExist:
                users_without_profiles.append(user)
        
        # Create missing profiles
        for user in users_without_profiles:
            try:
                Profile.objects.create(
                    user=user,
                    first_name=user.first_name or 'Unknown',
                    last_name=user.last_name or 'User',
                    phone_number=''
                )
                fixed_count += 1
            except Exception as e:
                errors.append(f"Failed to create profile for {user.email}: {str(e)}")
        
        return Response({
            'fixed_count': fixed_count,
            'errors': errors,
            'message': f'Created {fixed_count} missing profile records'
        })

class ProfileViewSet(viewsets.ModelViewSet):
    queryset = Profile.objects.all()
    serializer_class = ProfileSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users can only see their own profile
        return Profile.objects.filter(user=self.request.user)

class StudentViewSet(viewsets.ModelViewSet):
    queryset = Student.objects.all()
    serializer_class = StudentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Student.objects.all()
        if self.request.user.role == 'student':
            # Students can only see their own data
            queryset = queryset.filter(user=self.request.user)
        elif self.request.user.role == 'supervisor':
            # Supervisors can see their assigned students
            supervisor = self.request.user.supervisor_profile
            assigned_students = SupervisorAssignment.objects.filter(
                supervisor=supervisor
            ).values_list('student_id', flat=True)
            queryset = queryset.filter(id__in=assigned_students)
        return queryset

class SupervisorViewSet(viewsets.ModelViewSet):
    queryset = Supervisor.objects.all()
    serializer_class = SupervisorSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Supervisor.objects.all()
        if self.request.user.role == 'supervisor':
            # Supervisors can only see their own data
            queryset = queryset.filter(user=self.request.user)
        return queryset

class CompanyViewSet(viewsets.ModelViewSet):
    queryset = Company.objects.all()
    serializer_class = CompanySerializer
    permission_classes = [permissions.IsAuthenticated]

class AttachmentViewSet(viewsets.ModelViewSet):
    queryset = Attachment.objects.all()
    serializer_class = AttachmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Attachment.objects.all()
        if self.request.user.role == 'student':
            # Students can only see their own attachments
            student = self.request.user.student_profile
            queryset = queryset.filter(student=student)
        elif self.request.user.role == 'supervisor':
            # Supervisors can see attachments of their assigned students
            supervisor = self.request.user.supervisor_profile
            assigned_students = SupervisorAssignment.objects.filter(
                supervisor=supervisor
            ).values_list('student_id', flat=True)
            queryset = queryset.filter(student_id__in=assigned_students)
        return queryset

class SupervisorAssignmentViewSet(viewsets.ModelViewSet):
    queryset = SupervisorAssignment.objects.all()
    serializer_class = SupervisorAssignmentSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = SupervisorAssignment.objects.all()
        
        # Handle query parameters for filtering (used by admin dashboard)
        supervisor_id = self.request.query_params.get('supervisor', None)
        student_id = self.request.query_params.get('student', None)
        
        if supervisor_id:
            queryset = queryset.filter(supervisor_id=supervisor_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        # Role-based filtering for non-admin users
        if self.request.user.role == 'student':
            # Students can only see their own assignments
            student = self.request.user.student_profile
            queryset = queryset.filter(student=student)
        elif self.request.user.role == 'supervisor':
            # Supervisors can see their assignments
            supervisor = self.request.user.supervisor_profile
            queryset = queryset.filter(supervisor=supervisor)
        # Admin users can see all assignments (with optional filtering by query params)
        
        return queryset

class VerificationStatusViewSet(viewsets.ModelViewSet):
    queryset = VerificationStatus.objects.all()
    serializer_class = VerificationStatusSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = VerificationStatus.objects.all()
        if self.request.user.role == 'student':
            # Students can only see their own verification status
            student = self.request.user.student_profile
            queryset = queryset.filter(student=student)
        elif self.request.user.role == 'supervisor':
            # Supervisors can see verification status of their assigned students
            supervisor = self.request.user.supervisor_profile
            assigned_students = SupervisorAssignment.objects.filter(
                supervisor=supervisor
            ).values_list('student_id', flat=True)
            queryset = queryset.filter(student_id__in=assigned_students)
        return queryset

    def create(self, request, *args, **kwargs):
        """
        Handle upsert logic for verification status.
        Creates new record or updates existing one for the current student.
        """
        if request.user.role == 'student':
            # For students, automatically use their own profile
            student = request.user.student_profile
            
            # Try to get existing verification status
            verification_status, created = VerificationStatus.objects.get_or_create(
                student=student,
                defaults={
                    'is_verified': request.data.get('is_verified', False),
                    'verification_details': request.data.get('verification_details'),
                    'verification_date': request.data.get('verification_date'),
                    'fee_verified': request.data.get('fee_verified', False),
                    'fee_verification_date': request.data.get('fee_verification_date'),
                }
            )
            
            # If not created, update the existing record
            if not created:
                verification_status.is_verified = request.data.get('is_verified', verification_status.is_verified)
                verification_status.verification_details = request.data.get('verification_details', verification_status.verification_details)
                verification_status.verification_date = request.data.get('verification_date', verification_status.verification_date)
                verification_status.fee_verified = request.data.get('fee_verified', verification_status.fee_verified)
                verification_status.fee_verification_date = request.data.get('fee_verification_date', verification_status.fee_verification_date)
                verification_status.save()
            
            serializer = self.get_serializer(verification_status)
            return Response(serializer.data, status=status.HTTP_201_CREATED if created else status.HTTP_200_OK)
        else:
            # For non-students, use the default behavior
            return super().create(request, *args, **kwargs)

class WeeklyLogViewSet(viewsets.ModelViewSet):
    queryset = WeeklyLog.objects.all()
    serializer_class = WeeklyLogSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = WeeklyLog.objects.all()
        if self.request.user.role == 'student':
            # Students can only see their own weekly logs
            student = self.request.user.student_profile
            queryset = queryset.filter(student=student)
        elif self.request.user.role == 'supervisor':
            # Supervisors can see weekly logs of their assigned students
            supervisor = self.request.user.supervisor_profile
            assigned_students = SupervisorAssignment.objects.filter(
                supervisor=supervisor
            ).values_list('student_id', flat=True)
            queryset = queryset.filter(student_id__in=assigned_students)
        return queryset

    def perform_create(self, serializer):
        if self.request.user.role == 'student':
            student = self.request.user.student_profile
            serializer.save(student=student)
        else:
            serializer.save()

class EvaluationViewSet(viewsets.ModelViewSet):
    queryset = Evaluation.objects.all()
    serializer_class = EvaluationSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Evaluation.objects.all()
        
        # Apply query parameter filters
        evaluator_id = self.request.query_params.get('evaluator', None)
        supervisor_id = self.request.query_params.get('supervisor', None)
        student_id = self.request.query_params.get('student', None)
        
        if evaluator_id:
            queryset = queryset.filter(evaluator_id=evaluator_id)
        if supervisor_id:
            queryset = queryset.filter(supervisor_id=supervisor_id)
        if student_id:
            queryset = queryset.filter(student_id=student_id)
        
        # Apply role-based filtering if no specific filters are provided
        if not any([evaluator_id, supervisor_id, student_id]):
            if self.request.user.role == 'student':
                # Students can see evaluations about them
                student = self.request.user.student_profile
                queryset = queryset.filter(student=student)
            elif self.request.user.role == 'supervisor':
                # Supervisors can see evaluations they gave and for their assigned students
                supervisor = self.request.user.supervisor_profile
                queryset = queryset.filter(
                    Q(supervisor=supervisor) | Q(evaluator=self.request.user)
                )
        
        return queryset

    def perform_create(self, serializer):
        serializer.save(evaluator=self.request.user)

class ReimbursementViewSet(viewsets.ModelViewSet):
    queryset = Reimbursement.objects.all()
    serializer_class = ReimbursementSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        queryset = Reimbursement.objects.all()
        if self.request.user.role == 'student':
            # Students can only see their own reimbursements
            student = self.request.user.student_profile
            queryset = queryset.filter(student=student)
        elif self.request.user.role == 'supervisor':
            # Supervisors can see reimbursements of their assigned students
            supervisor = self.request.user.supervisor_profile
            assigned_students = SupervisorAssignment.objects.filter(
                supervisor=supervisor
            ).values_list('student_id', flat=True)
            queryset = queryset.filter(student_id__in=assigned_students)
        return queryset

    @action(detail=True, methods=['post'])
    def approve(self, request, pk=None):
        reimbursement = self.get_object()
        if request.user.role in ['admin', 'dean']:
            reimbursement.status = 'approved'
            reimbursement.save()
            return Response({'status': 'approved'})
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

    @action(detail=True, methods=['post'])
    def reject(self, request, pk=None):
        reimbursement = self.get_object()
        if request.user.role in ['admin', 'dean']:
            reimbursement.status = 'rejected'
            reimbursement.save()
            return Response({'status': 'rejected'})
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)

class MessageViewSet(viewsets.ModelViewSet):
    queryset = Message.objects.all()
    serializer_class = MessageSerializer
    permission_classes = [permissions.IsAuthenticated]

    def get_queryset(self):
        # Users can only see messages they sent or received
        return Message.objects.filter(
            Q(sender=self.request.user) | Q(receiver=self.request.user)
        )

    def perform_create(self, serializer):
        serializer.save(sender=self.request.user)

    @action(detail=True, methods=['post'])
    def mark_read(self, request, pk=None):
        message = self.get_object()
        if message.receiver == request.user:
            message.read = True
            message.save()
            return Response({'status': 'marked as read'})
        return Response({'error': 'Not authorized'}, status=status.HTTP_403_FORBIDDEN)