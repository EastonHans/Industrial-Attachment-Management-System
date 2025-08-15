import uuid
from django.db import models
from django.contrib.auth.models import AbstractUser
from django.utils import timezone
from django.db.models.signals import post_save
from django.dispatch import receiver

class User(AbstractUser):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=20, choices=[
        ('admin', 'Admin'),
        ('student', 'Student'),
        ('supervisor', 'Supervisor'),
        ('dean', 'Dean'),
    ])
    
    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['username']
    
    def save(self, *args, **kwargs):
        """Override save to enforce data integrity"""
        super().save(*args, **kwargs)
        
        # Auto-create Profile if it doesn't exist
        if not hasattr(self, 'profile'):
            Profile.objects.get_or_create(
                user=self,
                defaults={
                    'first_name': self.first_name or 'Unknown',
                    'last_name': self.last_name or 'User',
                }
            )
    
    def clean(self):
        """Validate user data integrity"""
        from django.core.exceptions import ValidationError
        super().clean()
        
        # Validate role consistency
        if self.role not in ['admin', 'student', 'supervisor', 'dean']:
            raise ValidationError(f'Invalid role: {self.role}')
        
        # Check for existing users with same email
        if User.objects.filter(email=self.email).exclude(pk=self.pk).exists():
            raise ValidationError('User with this email already exists')

class Profile(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='profile')
    first_name = models.TextField()
    last_name = models.TextField()
    phone_number = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

class Student(models.Model):
    PROGRAM_TYPE_CHOICES = [
        ('degree', 'Degree Program'),
        ('diploma', 'Diploma Program'),
    ]
    
    SEMESTER_CHOICES = [
        (1, 'Semester 1'),
        (2, 'Semester 2'),
    ]
    
    ATTACHMENT_PERIOD_CHOICES = [
        ('Jan-Apr', 'January - April'),
        ('May-Aug', 'May - August'), 
        ('Sep-Dec', 'September - December'),
    ]
    
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='student_profile')
    student_id = models.TextField(unique=True)
    program = models.TextField()
    program_type = models.CharField(max_length=10, choices=PROGRAM_TYPE_CHOICES, default='degree')
    faculty = models.TextField(blank=True, null=True)
    department = models.TextField(blank=True, null=True)
    year_of_study = models.IntegerField()
    semester = models.IntegerField(choices=SEMESTER_CHOICES, default=1)
    attachment_period = models.CharField(max_length=10, choices=ATTACHMENT_PERIOD_CHOICES, blank=True, null=True)
    phone_number = models.TextField(blank=True, null=True)
    # Combined grade from both lecturer evaluations (50% each)
    final_grade = models.DecimalField(max_digits=5, decimal_places=2, blank=True, null=True, help_text="Combined grade from both lecturer evaluations")
    grade_calculation_details = models.JSONField(blank=True, null=True, help_text="Details of how the final grade was calculated")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student_id} - {self.user.first_name} {self.user.last_name}"
    
    def is_eligible_for_attachment(self):
        """
        Check if student meets minimum requirements for attachment based on program type
        - Degree: Must have completed 3.2 (3rd year, 2nd semester)
        - Diploma: Must have completed 2.2 (2nd year, 2nd semester)
        """
        if self.program_type == 'degree':
            return (self.year_of_study == 3 and self.semester >= 2) or self.year_of_study > 3
        elif self.program_type == 'diploma':
            return (self.year_of_study == 2 and self.semester >= 2) or self.year_of_study > 2
        return False
    
    def calculate_final_grade(self):
        """
        Calculate final grade by combining evaluations from different lecturers
        Each lecturer's evaluation contributes 50% to the final grade
        """
        from decimal import Decimal
        evaluations = self.evaluations.all()
        
        if evaluations.count() == 0:
            return None
            
        lecturer_grades = {}
        
        # Group evaluations by evaluator (lecturer)
        for evaluation in evaluations:
            lecturer_id = evaluation.evaluator.id
            if lecturer_id not in lecturer_grades:
                lecturer_grades[lecturer_id] = []
            lecturer_grades[lecturer_id].append(evaluation.total)
        
        # Calculate average for each lecturer (in case they have multiple evaluations)
        lecturer_averages = {}
        for lecturer_id, grades in lecturer_grades.items():
            lecturer_averages[str(lecturer_id)] = sum(grades) / len(grades)
        
        # If we have exactly 2 lecturers, convert each to 50-point scale and combine
        if len(lecturer_averages) == 2:
            grade1, grade2 = list(lecturer_averages.values())
            # Convert each grade from 110-point scale to 50-point scale
            contribution1 = (Decimal(grade1) / 110) * 50
            contribution2 = (Decimal(grade2) / 110) * 50
            final_grade = contribution1 + contribution2
            
            self.final_grade = final_grade
            self.grade_calculation_details = {
                'calculation_method': '50_50_split',
                'lecturer_grades_raw': lecturer_averages,
                'lecturer_contributions': {
                    'lecturer1_contribution': float(contribution1),
                    'lecturer2_contribution': float(contribution2)
                },
                'final_grade': float(final_grade),
                'max_possible_score': 100,
                'calculated_at': timezone.now().isoformat()
            }
            self.save()
            return float(final_grade)
            
        # If only one lecturer, convert to 100-point scale (their contribution counts as 100%)
        elif len(lecturer_averages) == 1:
            grade = list(lecturer_averages.values())[0]
            # Convert from 110-point scale to 100-point scale
            converted_grade = (Decimal(grade) / 110) * 100
            self.final_grade = converted_grade
            self.grade_calculation_details = {
                'calculation_method': 'single_lecturer',
                'lecturer_grade_raw': grade,
                'final_grade': float(converted_grade),
                'max_possible_score': 100,
                'calculated_at': timezone.now().isoformat()
            }
            self.save()
            return float(converted_grade)
            
        return None

class Supervisor(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.OneToOneField(User, on_delete=models.CASCADE, related_name='supervisor_profile')
    department = models.CharField(max_length=100, blank=True, null=True, help_text="Department or faculty the supervisor belongs to")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Supervisor: {self.user.first_name} {self.user.last_name}"

class Company(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    name = models.TextField()
    location = models.TextField()
    industry = models.TextField(blank=True, null=True)
    description = models.TextField(blank=True, null=True)
    address = models.TextField(blank=True, null=True)
    contact_email = models.TextField(blank=True, null=True)
    contact_phone = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.name

    class Meta:
        verbose_name_plural = "Companies"

class Attachment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='attachments')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='attachments')
    supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE, related_name='attachments', blank=True, null=True)
    start_date = models.DateField()
    end_date = models.DateField()
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student.user.first_name} at {self.company.name}"

class SupervisorAssignment(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='supervisor_assignments')
    supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE, related_name='student_assignments')
    status = models.CharField(max_length=50, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.student.user.first_name} -> {self.supervisor.user.first_name}"

class VerificationStatus(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.OneToOneField(Student, on_delete=models.CASCADE, related_name='verification_status')
    is_verified = models.BooleanField(default=False)
    verification_date = models.DateTimeField(blank=True, null=True)
    verification_details = models.JSONField(blank=True, null=True)
    fee_verified = models.BooleanField(default=False)
    fee_verification_date = models.DateTimeField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Verification for {self.student.user.first_name}"

class WeeklyLog(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='weekly_logs')
    week_number = models.IntegerField()
    date = models.DateField()
    day = models.CharField(max_length=50)
    task_assigned = models.TextField(blank=True, null=True)
    attachee_remarks = models.TextField(blank=True, null=True)
    trainer_remarks = models.TextField(blank=True, null=True)
    supervisor_remarks = models.TextField(blank=True, null=True)
    trainer_signature = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Week {self.week_number} - {self.student.user.first_name}"

class Evaluation(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    attachment = models.ForeignKey(Attachment, on_delete=models.CASCADE, related_name='evaluations', blank=True, null=True)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='evaluations')
    supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE, related_name='evaluations')
    evaluator = models.ForeignKey(User, on_delete=models.CASCADE, related_name='evaluations_given')
    evaluation_date = models.DateField()
    
    # Rating fields (1-10 scale)
    performance_rating = models.IntegerField()
    availability_of_documents = models.IntegerField()
    organization_of_logbook = models.IntegerField()
    adaptability = models.IntegerField()
    teamwork = models.IntegerField()
    accomplishment = models.IntegerField()
    presence = models.IntegerField()
    communication_skills = models.IntegerField()
    mannerism = models.IntegerField()
    understanding_of_tasks = models.IntegerField()
    oral_presentation = models.IntegerField()
    total = models.IntegerField()
    
    comments = models.TextField(blank=True, null=True)
    overall_assessment = models.TextField(blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Evaluation for {self.student.user.first_name} by {self.evaluator.first_name}"

class Reimbursement(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    student = models.ForeignKey(Student, on_delete=models.CASCADE, related_name='reimbursements')
    company = models.ForeignKey(Company, on_delete=models.CASCADE, related_name='reimbursements')
    supervisor = models.ForeignKey(Supervisor, on_delete=models.CASCADE, related_name='reimbursements', blank=True, null=True)
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    distance = models.DecimalField(max_digits=10, decimal_places=2)
    rate = models.DecimalField(max_digits=10, decimal_places=2)
    lunch = models.DecimalField(max_digits=10, decimal_places=2)
    supervision_visits = models.IntegerField(default=1, help_text='Number of actual supervision visits')
    status = models.TextField(default='pending')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"Reimbursement for {self.student.user.first_name} - ${self.amount}"

class Message(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sender = models.ForeignKey(User, on_delete=models.CASCADE, related_name='sent_messages')
    receiver = models.ForeignKey(User, on_delete=models.CASCADE, related_name='received_messages')
    content = models.TextField()
    read = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"Message from {self.sender.first_name} to {self.receiver.first_name}"

# Signal to automatically calculate final grade when evaluation is saved
@receiver(post_save, sender=Evaluation)
def update_student_final_grade(sender, instance, created, **kwargs):
    """
    Automatically recalculate student's final grade when an evaluation is saved
    """
    if instance.student:
        instance.student.calculate_final_grade()