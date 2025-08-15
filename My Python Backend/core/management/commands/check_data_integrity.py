"""
Data Integrity Checker for IAMS
Identifies orphaned users, missing records, and data corruption issues
"""

from django.core.management.base import BaseCommand
from django.db import transaction
from core.models import User, Profile, Student, Supervisor
from collections import defaultdict


class Command(BaseCommand):
    help = 'Check data integrity and identify orphaned or corrupted user records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--fix',
            action='store_true',
            help='Automatically fix orphaned users by creating missing records or deleting invalid ones',
        )
        parser.add_argument(
            '--delete-orphans',
            action='store_true',
            help='Delete users without proper role records (use with caution)',
        )

    def handle(self, *args, **options):
        self.style.SUCCESS = self.style.SUCCESS
        self.style.ERROR = self.style.ERROR
        self.style.WARNING = self.style.WARNING
        
        self.stdout.write(self.style.SUCCESS('Starting Data Integrity Check...'))
        self.stdout.write('=' * 60)
        
        issues = self.check_integrity()
        
        if options['fix']:
            self.fix_issues(issues, delete_orphans=options['delete_orphans'])
        else:
            self.report_issues(issues)
            
        self.stdout.write('=' * 60)
        self.stdout.write(self.style.SUCCESS('Data integrity check complete!'))

    def check_integrity(self):
        """Check for various data integrity issues"""
        issues = {
            'orphaned_users': [],
            'missing_profiles': [],
            'missing_role_records': [],
            'inactive_with_records': [],
            'summary': defaultdict(int)
        }
        
        all_users = User.objects.all()
        self.stdout.write(f'Checking {all_users.count()} users...')
        
        for user in all_users:
            user_issues = []
            
            # Check for missing Profile
            try:
                profile = user.profile
            except Profile.DoesNotExist:
                user_issues.append('missing_profile')
                issues['missing_profiles'].append(user)
            
            # Check for missing role-specific records
            if user.role == 'student':
                try:
                    student = user.student_profile
                except Student.DoesNotExist:
                    user_issues.append('missing_student_record')
                    issues['missing_role_records'].append({
                        'user': user,
                        'missing_record': 'Student',
                        'role': 'student'
                    })
            elif user.role == 'supervisor':
                try:
                    supervisor = user.supervisor_profile
                except Supervisor.DoesNotExist:
                    user_issues.append('missing_supervisor_record')
                    issues['missing_role_records'].append({
                        'user': user,
                        'missing_record': 'Supervisor',
                        'role': 'supervisor'
                    })
            
            # Check for inactive users with active records
            if not user.is_active:
                has_active_records = False
                try:
                    if user.profile:
                        has_active_records = True
                except Profile.DoesNotExist:
                    pass
                    
                if has_active_records:
                    issues['inactive_with_records'].append(user)
            
            # Classify as orphaned if missing critical records
            if user_issues:
                issues['orphaned_users'].append({
                    'user': user,
                    'issues': user_issues
                })
                
            # Update summary
            for issue in user_issues:
                issues['summary'][issue] += 1
        
        return issues

    def report_issues(self, issues):
        """Report found issues to stdout"""
        
        # Summary
        self.stdout.write(self.style.WARNING('\nINTEGRITY ISSUES SUMMARY:'))
        if issues['summary']:
            for issue_type, count in issues['summary'].items():
                self.stdout.write(f'  - {issue_type.replace("_", " ").title()}: {count}')
        else:
            self.stdout.write(self.style.SUCCESS('  No integrity issues found!'))
            return
        
        # Detailed reporting
        if issues['missing_profiles']:
            self.stdout.write(self.style.ERROR('\nUSERS WITHOUT PROFILES:'))
            for user in issues['missing_profiles']:
                self.stdout.write(f'  - {user.email} ({user.role}) - ID: {user.id}')
        
        if issues['missing_role_records']:
            self.stdout.write(self.style.ERROR('\nUSERS WITHOUT ROLE RECORDS:'))
            for item in issues['missing_role_records']:
                user = item['user']
                missing = item['missing_record']
                self.stdout.write(f'  - {user.email} (missing {missing} record) - ID: {user.id}')
        
        if issues['orphaned_users']:
            self.stdout.write(self.style.WARNING('\nORPHANED USERS (Multiple Issues):'))
            for item in issues['orphaned_users']:
                user = item['user']
                user_issues = ', '.join(item['issues'])
                self.stdout.write(f'  - {user.email} - Issues: {user_issues}')
                self.stdout.write(f'    Role: {user.role}, Active: {user.is_active}, ID: {user.id}')
        
        if issues['inactive_with_records']:
            self.stdout.write(self.style.WARNING('\nINACTIVE USERS WITH ACTIVE RECORDS:'))
            for user in issues['inactive_with_records']:
                self.stdout.write(f'  - {user.email} ({user.role}) - Should cleanup records')
        
        # Recommendations
        self.stdout.write(self.style.WARNING('\nRECOMMENDATIONS:'))
        self.stdout.write('  - Run with --fix to automatically create missing Profile records')
        self.stdout.write('  - Run with --fix --delete-orphans to delete users without role records')
        self.stdout.write('  - Review inactive users and cleanup their records if needed')

    def fix_issues(self, issues, delete_orphans=False):
        """Automatically fix found issues"""
        self.stdout.write(self.style.WARNING('\nFIXING INTEGRITY ISSUES...'))
        
        fixed_count = 0
        deleted_count = 0
        
        with transaction.atomic():
            # Fix missing profiles
            for user in issues['missing_profiles']:
                self.stdout.write(f'Creating Profile for {user.email}...')
                Profile.objects.create(
                    user=user,
                    first_name=user.first_name or 'Unknown',
                    last_name=user.last_name or 'User',
                    phone_number=''
                )
                fixed_count += 1
            
            # Handle missing role records
            for item in issues['missing_role_records']:
                user = item['user']
                missing_record = item['missing_record']
                
                if delete_orphans:
                    self.stdout.write(self.style.ERROR(f'Deleting orphaned user {user.email}...'))
                    user.delete()
                    deleted_count += 1
                else:
                    # Create missing role records with minimal data
                    if missing_record == 'Student':
                        self.stdout.write(f'Creating Student record for {user.email}...')
                        Student.objects.create(
                            user=user,
                            student_id=f'RECOVERED_{user.id}',
                            program='Unknown Program',
                            year_of_study=1,
                            semester=1
                        )
                        fixed_count += 1
                    elif missing_record == 'Supervisor':
                        self.stdout.write(f'Creating Supervisor record for {user.email}...')
                        Supervisor.objects.create(user=user)
                        fixed_count += 1
        
        # Summary
        self.stdout.write(self.style.SUCCESS(f'\nFIXES APPLIED:'))
        self.stdout.write(f'  - Records created/fixed: {fixed_count}')
        if delete_orphans:
            self.stdout.write(f'  - Orphaned users deleted: {deleted_count}')
        
        if not delete_orphans and issues['missing_role_records']:
            self.stdout.write(self.style.WARNING('\nNote: Some users still need role records.'))
            self.stdout.write('   Use --delete-orphans to remove them entirely.')