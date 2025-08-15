from rest_framework import status, generics
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.decorators import api_view, permission_classes
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import get_user_model
from django.contrib.auth.tokens import default_token_generator
from django.utils.http import urlsafe_base64_encode, urlsafe_base64_decode
from django.utils.encoding import force_bytes, force_str
from django.template.loader import render_to_string
from django.core.mail import send_mail
from django.conf import settings
from django.db import transaction, IntegrityError
from django.core.exceptions import ValidationError
from ..models import Profile, Student, Supervisor
from ..serializers import (
    UserRegistrationSerializer, LoginSerializer, UserSerializer, ProfileSerializer,
    ForgotPasswordSerializer, ResetPasswordSerializer
)

User = get_user_model()

class RegisterView(generics.CreateAPIView):
    serializer_class = UserRegistrationSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        # Use transaction to ensure data integrity
        try:
            with transaction.atomic():
                # Create user
                user = serializer.save()
                
                # Get or update profile (User.save() auto-creates one)
                profile, created = Profile.objects.get_or_create(
                    user=user,
                    defaults={
                        'first_name': user.first_name,
                        'last_name': user.last_name,
                        'phone_number': request.data.get('phone_number', '')
                    }
                )
                
                # Update profile if it already exists
                if not created:
                    profile.first_name = user.first_name
                    profile.last_name = user.last_name
                    profile.phone_number = request.data.get('phone_number', '')
                    profile.save()
                
                # Create role-specific records - this is required for proper functionality
                if user.role == 'student':
                    student_id = request.data.get('student_id', '')
                    program = request.data.get('program', '')
                    
                    # Validate required student fields
                    if not student_id:
                        raise ValueError("Student ID is required for student registration")
                    if not program:
                        raise ValueError("Program is required for student registration")
                    
                    # Get year of study and ensure it's an integer
                    year_of_study = request.data.get('year_of_study', 1)
                    if isinstance(year_of_study, str):
                        year_of_study = int(year_of_study) if year_of_study.isdigit() else 1
                    
                    # Validate year of study range
                    if year_of_study < 1 or year_of_study > 6:
                        raise ValueError("Year of study must be between 1 and 6")
                    
                    Student.objects.create(
                        user=user,
                        student_id=student_id,
                        program=program,
                        program_type=request.data.get('program_type', 'degree'),
                        faculty=request.data.get('faculty', ''),
                        department=request.data.get('department', ''),
                        year_of_study=year_of_study,
                        semester=request.data.get('semester', 1),
                        attachment_period=request.data.get('attachment_period', ''),
                        phone_number=request.data.get('phone_number', '')
                    )
                elif user.role == 'supervisor':
                    Supervisor.objects.create(
                        user=user,
                        department=request.data.get('department', '')
                    )
                elif user.role == 'admin':
                    # Admin users only need Profile, no additional records
                    pass
                else:
                    raise ValueError(f"Invalid user role: {user.role}")
                
                # Generate tokens
                refresh = RefreshToken.for_user(user)
                
                return Response({
                    'user': UserSerializer(user).data,
                    'tokens': {
                        'refresh': str(refresh),
                        'access': str(refresh.access_token),
                    }
                }, status=status.HTTP_201_CREATED)
                
        except ValueError as e:
            return Response({
                'error': str(e)
            }, status=status.HTTP_400_BAD_REQUEST)
        except IntegrityError as e:
            # Handle database constraint violations (duplicate email, student_id, etc.)
            error_message = str(e)
            if 'email' in error_message.lower():
                return Response({
                    'email': ['A user with this email already exists.']
                }, status=status.HTTP_400_BAD_REQUEST)
            elif 'student_id' in error_message.lower():
                return Response({
                    'student_id': ['A student with this ID already exists.']
                }, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({
                    'error': 'Registration failed due to duplicate data. Please check your information.'
                }, status=status.HTTP_400_BAD_REQUEST)
        except ValidationError as e:
            # Handle Django model validation errors
            if hasattr(e, 'message_dict'):
                return Response(e.message_dict, status=status.HTTP_400_BAD_REQUEST)
            else:
                return Response({
                    'error': str(e)
                }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            # Log the actual error for debugging
            import logging
            import traceback
            logger = logging.getLogger(__name__)
            logger.error(f"Unexpected registration error: {str(e)}")
            logger.error(f"Request data: {request.data}")
            logger.error(f"Traceback: {traceback.format_exc()}")
            
            # Return generic error to user
            return Response({
                'error': 'Registration failed due to an unexpected error. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class LoginView(generics.GenericAPIView):
    serializer_class = LoginSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        user = serializer.validated_data['user']
        refresh = RefreshToken.for_user(user)
        
        return Response({
            'user': UserSerializer(user).data,
            'tokens': {
                'refresh': str(refresh),
                'access': str(refresh.access_token),
            }
        })

class LogoutView(generics.GenericAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        try:
            refresh_token = request.data.get("refresh")
            if refresh_token:
                try:
                    token = RefreshToken(refresh_token)
                    token.blacklist()
                except AttributeError:
                    # Blacklisting not available, just return success
                    # This happens when rest_framework_simplejwt.token_blacklist is not installed
                    pass
            return Response({"message": "Successfully logged out"}, status=status.HTTP_200_OK)
        except Exception as e:
            # Even if blacklisting fails, consider logout successful
            # as the frontend will clear the token
            return Response({"message": "Successfully logged out"}, status=status.HTTP_200_OK)

class UserProfileView(generics.RetrieveUpdateAPIView):
    serializer_class = UserSerializer
    permission_classes = [IsAuthenticated]

    def get_object(self):
        return self.request.user

    def get(self, request, *args, **kwargs):
        user = self.get_object()
        user_data = UserSerializer(user).data
        
        # Add profile data
        try:
            profile = user.profile
            user_data['profile'] = ProfileSerializer(profile).data
        except Profile.DoesNotExist:
            user_data['profile'] = None
            
        # Add role-specific data
        if user.role == 'student':
            try:
                student = user.student_profile
                user_data['student_data'] = {
                    'student_id': student.student_id,
                    'program': student.program,
                    'program_type': student.program_type,
                    'faculty': student.faculty,
                    'department': student.department,
                    'year_of_study': student.year_of_study,
                    'semester': student.semester,
                    'is_eligible_for_attachment': student.is_eligible_for_attachment()
                }
            except Student.DoesNotExist:
                user_data['student_data'] = None
        elif user.role == 'supervisor':
            try:
                supervisor = user.supervisor_profile
                user_data['supervisor_data'] = {
                    'id': str(supervisor.id)
                }
            except Supervisor.DoesNotExist:
                user_data['supervisor_data'] = None
                
        return Response(user_data)

class ForgotPasswordView(generics.GenericAPIView):
    serializer_class = ForgotPasswordSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        email = serializer.validated_data['email']
        
        try:
            user = User.objects.get(email=email)
            
            # Generate password reset token
            token = default_token_generator.make_token(user)
            uid = urlsafe_base64_encode(force_bytes(user.pk))
            
            # Create reset URL (frontend URL)
            reset_url = f"{settings.FRONTEND_URL}/reset-password/{uid}/{token}"
            
            # Send email
            subject = 'Password Reset Request - IAMS'
            message = render_to_string('emails/password_reset.html', {
                'user': user,
                'reset_url': reset_url,
                'site_name': 'IAMS - Internship Attachment Management System'
            })
            
            send_mail(
                subject=subject,
                message='',  # Plain text version (optional)
                html_message=message,
                from_email=settings.DEFAULT_FROM_EMAIL,
                recipient_list=[email],
                fail_silently=False,
            )
            
            return Response({
                'message': 'Password reset email sent successfully. Please check your email.'
            }, status=status.HTTP_200_OK)
            
        except User.DoesNotExist:
            # For security, return same message even if user doesn't exist
            return Response({
                'message': 'Password reset email sent successfully. Please check your email.'
            }, status=status.HTTP_200_OK)
        except Exception as e:
            return Response({
                'error': 'Failed to send password reset email. Please try again later.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

class ResetPasswordView(generics.GenericAPIView):
    serializer_class = ResetPasswordSerializer
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        
        uid = serializer.validated_data['uid']
        token = serializer.validated_data['token']
        new_password = serializer.validated_data['new_password']
        
        try:
            # Decode user ID
            user_id = force_str(urlsafe_base64_decode(uid))
            user = User.objects.get(pk=user_id)
            
            # Verify token
            if not default_token_generator.check_token(user, token):
                return Response({
                    'error': 'Invalid or expired reset token.'
                }, status=status.HTTP_400_BAD_REQUEST)
            
            # Reset password
            user.set_password(new_password)
            user.save()
            
            return Response({
                'message': 'Password has been reset successfully. You can now login with your new password.'
            }, status=status.HTTP_200_OK)
            
        except (TypeError, ValueError, OverflowError, User.DoesNotExist):
            return Response({
                'error': 'Invalid reset link.'
            }, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({
                'error': 'Failed to reset password. Please try again.'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_authenticated_user(request):
    """
    Get current authenticated user information.
    Used by frontend to validate session and restore user state on refresh.
    """
    user = request.user
    
    # Build user data with profile information
    user_data = {
        'id': str(user.id),
        'email': user.email,
        'first_name': user.first_name,
        'last_name': user.last_name,
        'role': user.role,
        'is_active': user.is_active,
        'date_joined': user.date_joined.isoformat() if user.date_joined else None,
    }
    
    # Add profile information if exists
    try:
        profile = user.profile
        user_data['profile'] = {
            'first_name': profile.first_name,
            'last_name': profile.last_name,
            'phone_number': profile.phone_number,
        }
    except Profile.DoesNotExist:
        user_data['profile'] = None
        
    # Add role-specific data
    if user.role == 'student':
        try:
            student = user.student_profile
            user_data['student_data'] = {
                'student_id': student.student_id,
                'program': student.program,
                'program_type': student.program_type,
                'faculty': student.faculty,
                'department': student.department,
                'year_of_study': student.year_of_study,
                'semester': student.semester,
            }
        except Student.DoesNotExist:
            user_data['student_data'] = None
    elif user.role == 'supervisor':
        try:
            supervisor = user.supervisor_profile
            user_data['supervisor_data'] = {
                'id': str(supervisor.id)
            }
        except Supervisor.DoesNotExist:
            user_data['supervisor_data'] = None
            
    return Response(user_data)