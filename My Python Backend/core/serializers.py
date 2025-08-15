from rest_framework import serializers
from django.contrib.auth import authenticate
from .models import (
    User, Profile, Student, Supervisor, Company, Attachment,
    SupervisorAssignment, VerificationStatus, WeeklyLog, 
    Evaluation, Reimbursement, Message
)

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'first_name', 'last_name', 'role', 'is_active')
        read_only_fields = ('id',)

class UserRegistrationSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('email', 'password', 'password_confirm', 'first_name', 'last_name', 'role')

    def validate(self, attrs):
        if attrs['password'] != attrs['password_confirm']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs

    def create(self, validated_data):
        validated_data.pop('password_confirm')
        user = User.objects.create_user(
            username=validated_data['email'],
            email=validated_data['email'],
            password=validated_data['password'],
            first_name=validated_data['first_name'],
            last_name=validated_data['last_name'],
            role=validated_data['role']
        )
        return user

class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()

    def validate(self, attrs):
        email = attrs.get('email')
        password = attrs.get('password')

        if email and password:
            user = authenticate(username=email, password=password)
            if not user:
                raise serializers.ValidationError('Invalid credentials')
            if not user.is_active:
                raise serializers.ValidationError('User account is disabled')
            attrs['user'] = user
        return attrs

class ProfileSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Profile
        fields = '__all__'

class StudentSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)
    verification_status = serializers.SerializerMethodField()
    attachments = serializers.SerializerMethodField()
    
    class Meta:
        model = Student
        fields = '__all__'
    
    def get_verification_status(self, obj):
        try:
            verification = obj.verification_status
            return {
                'id': verification.id,
                'is_verified': verification.is_verified,
                'fee_verified': verification.fee_verified,
                'verification_date': verification.verification_date,
                'fee_verification_date': verification.fee_verification_date,
                'verification_details': verification.verification_details,
                'created_at': verification.created_at,
                'updated_at': verification.updated_at,
            }
        except VerificationStatus.DoesNotExist:
            return None
    
    def get_attachments(self, obj):
        attachments = obj.attachments.all()
        return [{
            'id': attachment.id,
            'company': {
                'id': attachment.company.id,
                'name': attachment.company.name,
                'location': attachment.company.location,
                'industry': attachment.company.industry,
            } if attachment.company else None,
            'start_date': attachment.start_date,
            'end_date': attachment.end_date,
            'supervisor': {
                'id': attachment.supervisor.id,
                'user': {
                    'first_name': attachment.supervisor.user.first_name,
                    'last_name': attachment.supervisor.user.last_name,
                }
            } if attachment.supervisor else None,
        } for attachment in attachments]

class SupervisorSerializer(serializers.ModelSerializer):
    user = UserSerializer(read_only=True)

    class Meta:
        model = Supervisor
        fields = '__all__'

class CompanySerializer(serializers.ModelSerializer):
    class Meta:
        model = Company
        fields = '__all__'

class AttachmentSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    company = CompanySerializer(read_only=True)
    supervisor = SupervisorSerializer(read_only=True)
    
    # Add write-only fields for IDs
    student_id = serializers.UUIDField(write_only=True, required=False)
    company_id = serializers.UUIDField(write_only=True, required=False)
    supervisor_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Attachment
        fields = '__all__'
    

class SupervisorAssignmentSerializer(serializers.ModelSerializer):
    student_detail = StudentSerializer(source='student', read_only=True)
    supervisor_detail = SupervisorSerializer(source='supervisor', read_only=True)

    class Meta:
        model = SupervisorAssignment
        fields = '__all__'

class VerificationStatusSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)

    class Meta:
        model = VerificationStatus
        fields = '__all__'

class WeeklyLogSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)

    class Meta:
        model = WeeklyLog
        fields = '__all__'

class EvaluationSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    supervisor = SupervisorSerializer(read_only=True)
    evaluator = UserSerializer(read_only=True)
    attachment = AttachmentSerializer(read_only=True)
    
    # Add write-only fields for IDs
    student_id = serializers.UUIDField(write_only=True, required=True)
    supervisor_id = serializers.UUIDField(write_only=True, required=True)
    attachment_id = serializers.UUIDField(write_only=True, required=False)

    class Meta:
        model = Evaluation
        fields = '__all__'
    
    def create(self, validated_data):
        # Extract ID fields and convert to objects
        student_id = validated_data.pop('student_id', None)
        supervisor_id = validated_data.pop('supervisor_id', None)
        attachment_id = validated_data.pop('attachment_id', None)
        
        # Get the actual objects
        if student_id:
            validated_data['student'] = Student.objects.get(id=student_id)
        if supervisor_id:
            validated_data['supervisor'] = Supervisor.objects.get(id=supervisor_id)
        if attachment_id:
            validated_data['attachment'] = Attachment.objects.get(id=attachment_id)
            
        return super().create(validated_data)

class ReimbursementSerializer(serializers.ModelSerializer):
    student = StudentSerializer(read_only=True)
    company = CompanySerializer(read_only=True)
    supervisor = SupervisorSerializer(read_only=True)
    
    # Add write-only fields for IDs
    student_id = serializers.UUIDField(write_only=True, required=True)
    company_id = serializers.UUIDField(write_only=True, required=True)
    supervisor_id = serializers.UUIDField(write_only=True, required=True)

    class Meta:
        model = Reimbursement
        fields = '__all__'
    
    def create(self, validated_data):
        # Extract ID fields and convert to objects
        student_id = validated_data.pop('student_id', None)
        company_id = validated_data.pop('company_id', None)
        supervisor_id = validated_data.pop('supervisor_id', None)
        
        # Get the actual objects
        if student_id:
            validated_data['student'] = Student.objects.get(id=student_id)
        if company_id:
            validated_data['company'] = Company.objects.get(id=company_id)
        if supervisor_id:
            validated_data['supervisor'] = Supervisor.objects.get(id=supervisor_id)
            
        return super().create(validated_data)

class MessageSerializer(serializers.ModelSerializer):
    sender = UserSerializer(read_only=True)
    receiver = UserSerializer(read_only=True)
    receiver_id = serializers.UUIDField(write_only=True)

    class Meta:
        model = Message
        fields = '__all__'
        extra_kwargs = {
            'receiver': {'read_only': True}
        }

    def create(self, validated_data):
        receiver_id = validated_data.pop('receiver_id', None)
        if receiver_id:
            try:
                receiver = User.objects.get(id=receiver_id)
                validated_data['receiver'] = receiver
            except User.DoesNotExist:
                raise serializers.ValidationError({'receiver_id': 'User not found'})
        return super().create(validated_data)

class ForgotPasswordSerializer(serializers.Serializer):
    email = serializers.EmailField()

    def validate_email(self, value):
        return value.lower()

class ResetPasswordSerializer(serializers.Serializer):
    uid = serializers.CharField()
    token = serializers.CharField()
    new_password = serializers.CharField(min_length=8)
    confirm_password = serializers.CharField(min_length=8)

    def validate(self, attrs):
        if attrs['new_password'] != attrs['confirm_password']:
            raise serializers.ValidationError("Passwords don't match")
        return attrs