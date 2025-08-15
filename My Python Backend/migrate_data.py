#!/usr/bin/env python
"""
Data migration script to transfer data from CSV files to Django models
Run this after creating the Django database tables
"""
import os
import sys
import django
import csv
from pathlib import Path
from datetime import datetime
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

def read_csv(filename):
    """Read CSV file and return data"""
    csv_path = Path(filename)
    if not csv_path.exists():
        print(f"Warning: {filename} not found")
        return []
    
    with open(csv_path, 'r', encoding='utf-8') as file:
        reader = csv.DictReader(file)
        return list(reader)

def safe_uuid(value):
    """Convert string to UUID, return None if invalid"""
    if not value or value == '':
        return None
    try:
        return uuid.UUID(value)
    except (ValueError, TypeError):
        return uuid.uuid4()

def safe_date(value):
    """Convert string to date, return None if invalid"""
    if not value or value == '':
        return None
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None

def safe_datetime(value):
    """Convert string to datetime, return None if invalid"""
    if not value or value == '':
        return None
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00'))
    except (ValueError, TypeError):
        return None

def safe_int(value, default=0):
    """Convert string to int, return default if invalid"""
    if not value or value == '':
        return default
    try:
        return int(value)
    except (ValueError, TypeError):
        return default

def safe_decimal(value, default=0.0):
    """Convert string to decimal, return default if invalid"""
    if not value or value == '':
        return default
    try:
        return float(value)
    except (ValueError, TypeError):
        return default

def migrate_profiles():
    """Migrate profiles data"""
    print("Migrating profiles...")
    profiles_data = read_csv('profiles_rows.csv')
    
    for row in profiles_data:
        # Create user first
        user_id = safe_uuid(row.get('id'))
        if not user_id:
            continue
            
        user, created = User.objects.get_or_create(
            id=user_id,
            defaults={
                'username': row.get('email', f'user_{user_id}'),
                'email': row.get('email', f'user_{user_id}@example.com'),
                'first_name': row.get('first_name', ''),
                'last_name': row.get('last_name', ''),
                'role': 'student',  # Default role
            }
        )
        
        # Create profile
        Profile.objects.get_or_create(
            id=user_id,
            user=user,
            defaults={
                'first_name': row.get('first_name', ''),
                'last_name': row.get('last_name', ''),
                'phone_number': row.get('phone_number', ''),
                'created_at': safe_datetime(row.get('created_at')) or datetime.now(),
                'updated_at': safe_datetime(row.get('updated_at')) or datetime.now(),
            }
        )
    
    print(f"Migrated {len(profiles_data)} profiles")

def migrate_students():
    """Migrate students data"""
    print("Migrating students...")
    students_data = read_csv('students_rows.csv')
    
    for row in students_data:
        user_id = safe_uuid(row.get('id'))
        if not user_id:
            continue
            
        try:
            user = User.objects.get(id=user_id)
            user.role = 'student'
            user.save()
            
            Student.objects.get_or_create(
                id=user_id,
                user=user,
                defaults={
                    'student_id': row.get('student_id', ''),
                    'program': row.get('program', ''),
                    'year_of_study': safe_int(row.get('year_of_study'), 1),
                    'phone_number': row.get('phone_number', ''),
                    'created_at': safe_datetime(row.get('created_at')) or datetime.now(),
                    'updated_at': safe_datetime(row.get('updated_at')) or datetime.now(),
                }
            )
        except User.DoesNotExist:
            print(f"User with id {user_id} not found for student")
    
    print(f"Migrated {len(students_data)} students")

def migrate_supervisors():
    """Migrate supervisors data"""
    print("Migrating supervisors...")
    supervisors_data = read_csv('supervisors_rows.csv')
    
    for row in supervisors_data:
        user_id = safe_uuid(row.get('id'))
        if not user_id:
            continue
            
        try:
            user = User.objects.get(id=user_id)
            user.role = 'supervisor'
            user.save()
            
            Supervisor.objects.get_or_create(
                id=user_id,
                user=user,
                defaults={
                    'created_at': safe_datetime(row.get('created_at')) or datetime.now(),
                    'updated_at': safe_datetime(row.get('updated_at')) or datetime.now(),
                }
            )
        except User.DoesNotExist:
            print(f"User with id {user_id} not found for supervisor")
    
    print(f"Migrated {len(supervisors_data)} supervisors")

def migrate_companies():
    """Migrate companies data"""
    print("Migrating companies...")
    companies_data = read_csv('companies_rows.csv')
    
    for row in companies_data:
        Company.objects.get_or_create(
            id=safe_uuid(row.get('id')),
            defaults={
                'name': row.get('name', ''),
                'location': row.get('location', ''),
                'industry': row.get('industry', ''),
                'description': row.get('description', ''),
                'address': row.get('address', ''),
                'contact_email': row.get('contact_email', ''),
                'contact_phone': row.get('contact_phone', ''),
                'created_at': safe_datetime(row.get('created_at')) or datetime.now(),
                'updated_at': safe_datetime(row.get('updated_at')) or datetime.now(),
            }
        )
    
    print(f"Migrated {len(companies_data)} companies")

def migrate_all():
    """Run all migrations in correct order"""
    print("Starting data migration...")
    
    # Order matters due to foreign key relationships
    migrate_profiles()
    migrate_students() 
    migrate_supervisors()
    migrate_companies()
    
    # Add other migrations here as needed:
    # migrate_attachments()
    # migrate_supervisor_assignments()
    # migrate_verification_status()
    # migrate_weekly_logs()
    # migrate_evaluations()
    # migrate_reimbursements()
    
    print("Data migration completed!")

if __name__ == '__main__':
    migrate_all()