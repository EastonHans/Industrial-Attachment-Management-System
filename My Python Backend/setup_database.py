#!/usr/bin/env python
"""
Complete database setup script with sample data
"""
import os
import sys
import django
from datetime import datetime, date
import uuid

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'iams_backend.settings')
django.setup()

from django.contrib.auth import get_user_model
from core.models import (
    Profile, Student, Supervisor, Company, Attachment,
    SupervisorAssignment, VerificationStatus, WeeklyLog,
    Evaluation, Reimbursement, Message
)

User = get_user_model()

def create_sample_data():
    """Create sample data for testing"""
    print("Creating sample data...")
    
    # Create admin user
    admin_user, created = User.objects.get_or_create(
        email='admin@iams.edu',
        defaults={
            'username': 'admin@iams.edu',
            'first_name': 'System',
            'last_name': 'Administrator',
            'role': 'admin',
            'is_staff': True,
            'is_superuser': True,
        }
    )
    if created:
        admin_user.set_password('admin123')
        admin_user.save()
    
    # Create admin profile
    Profile.objects.get_or_create(
        user=admin_user,
        defaults={
            'first_name': 'System',
            'last_name': 'Administrator',
            'phone_number': '+1234567890'
        }
    )
    
    # Create sample companies
    companies_data = [
        {
            'name': 'TechCorp Solutions',
            'location': 'Nairobi, Kenya',
            'industry': 'Technology',
            'address': '123 Tech Street, Westlands',
            'contact_email': 'hr@techcorp.ke',
            'contact_phone': '+254712345678'
        },
        {
            'name': 'Kenya Commercial Bank',
            'location': 'Mombasa, Kenya',
            'industry': 'Banking',
            'address': '456 Moi Avenue, Mombasa',
            'contact_email': 'internships@kcb.co.ke',
            'contact_phone': '+254787654321'
        },
        {
            'name': 'Safaricom PLC',
            'location': 'Nairobi, Kenya',
            'industry': 'Telecommunications',
            'address': '789 Waiyaki Way, Westlands',
            'contact_email': 'careers@safaricom.co.ke',
            'contact_phone': '+254700123456'
        }
    ]
    
    companies = []
    for company_data in companies_data:
        company, created = Company.objects.get_or_create(
            name=company_data['name'],
            defaults=company_data
        )
        companies.append(company)
    
    # Create sample supervisors
    supervisors_data = [
        {
            'email': 'supervisor1@iams.edu',
            'first_name': 'Dr. Jane',
            'last_name': 'Smith',
            'phone': '+254711111111'
        },
        {
            'email': 'supervisor2@iams.edu',
            'first_name': 'Prof. John',
            'last_name': 'Doe',
            'phone': '+254722222222'
        }
    ]
    
    supervisors = []
    for sup_data in supervisors_data:
        user, created = User.objects.get_or_create(
            email=sup_data['email'],
            defaults={
                'username': sup_data['email'],
                'first_name': sup_data['first_name'],
                'last_name': sup_data['last_name'],
                'role': 'supervisor',
            }
        )
        if created:
            user.set_password('supervisor123')
            user.save()
        
        Profile.objects.get_or_create(
            user=user,
            defaults={
                'first_name': sup_data['first_name'],
                'last_name': sup_data['last_name'],
                'phone_number': sup_data['phone']
            }
        )
        
        supervisor, created = Supervisor.objects.get_or_create(user=user)
        supervisors.append(supervisor)
    
    # Create sample students
    students_data = [
        {
            'email': 'student1@student.iams.edu',
            'first_name': 'Alice',
            'last_name': 'Johnson',
            'student_id': 'ST001',
            'program': 'Computer Science',
            'year': 3,
            'phone': '+254733333333'
        },
        {
            'email': 'student2@student.iams.edu',
            'first_name': 'Bob',
            'last_name': 'Wilson',
            'student_id': 'ST002',
            'program': 'Business Administration',
            'year': 2,
            'phone': '+254744444444'
        },
        {
            'email': 'student3@student.iams.edu',
            'first_name': 'Carol',
            'last_name': 'Brown',
            'student_id': 'ST003',
            'program': 'Engineering',
            'year': 4,
            'phone': '+254755555555'
        }
    ]
    
    students = []
    for student_data in students_data:
        user, created = User.objects.get_or_create(
            email=student_data['email'],
            defaults={
                'username': student_data['email'],
                'first_name': student_data['first_name'],
                'last_name': student_data['last_name'],
                'role': 'student',
            }
        )
        if created:
            user.set_password('student123')
            user.save()
        
        Profile.objects.get_or_create(
            user=user,
            defaults={
                'first_name': student_data['first_name'],
                'last_name': student_data['last_name'],
                'phone_number': student_data['phone']
            }
        )
        
        student, created = Student.objects.get_or_create(
            user=user,
            defaults={
                'student_id': student_data['student_id'],
                'program': student_data['program'],
                'year_of_study': student_data['year'],
                'phone_number': student_data['phone']
            }
        )
        students.append(student)
    
    # Create attachments
    for i, student in enumerate(students):
        company = companies[i % len(companies)]
        supervisor = supervisors[i % len(supervisors)]
        
        attachment, created = Attachment.objects.get_or_create(
            student=student,
            company=company,
            defaults={
                'supervisor': supervisor,
                'start_date': date(2024, 6, 1),
                'end_date': date(2024, 8, 31),
            }
        )
        
        # Create supervisor assignment
        SupervisorAssignment.objects.get_or_create(
            student=student,
            supervisor=supervisor,
            defaults={'status': 'active'}
        )
        
        # Create verification status
        VerificationStatus.objects.get_or_create(
            student=student,
            defaults={
                'is_verified': True,
                'fee_verified': True,
                'verification_date': datetime.now(),
                'fee_verification_date': datetime.now(),
                'verification_details': {'transcript': 'verified', 'fees': 'paid'}
            }
        )
        
        # Create sample weekly log
        WeeklyLog.objects.get_or_create(
            student=student,
            week_number=1,
            defaults={
                'date': date(2024, 6, 7),
                'day': 'Monday',
                'task_assigned': 'Database design and implementation',
                'attachee_remarks': 'Completed database schema design',
                'trainer_remarks': 'Good progress on understanding requirements',
                'supervisor_remarks': 'Excellent analytical skills demonstrated'
            }
        )
        
        # Create sample reimbursement
        Reimbursement.objects.get_or_create(
            student=student,
            company=company,
            defaults={
                'supervisor': supervisor,
                'amount': 5000.00,
                'distance': 25.5,
                'rate': 50.0,
                'lunch': 500.0,
                'status': 'pending'
            }
        )
    
    print("Sample data created successfully!")
    print("\nLogin credentials:")
    print("Admin: admin@iams.edu / admin123")
    print("Supervisor 1: supervisor1@iams.edu / supervisor123")
    print("Supervisor 2: supervisor2@iams.edu / supervisor123")
    print("Student 1: student1@student.iams.edu / student123")
    print("Student 2: student2@student.iams.edu / student123")
    print("Student 3: student3@student.iams.edu / student123")

if __name__ == '__main__':
    create_sample_data()