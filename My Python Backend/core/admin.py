from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from .models import (
    User, Profile, Student, Supervisor, Company, Attachment,
    SupervisorAssignment, VerificationStatus, WeeklyLog, 
    Evaluation, Reimbursement, Message
)

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_active')
    list_filter = ('role', 'is_active', 'is_staff')
    search_fields = ('email', 'first_name', 'last_name')
    ordering = ('email',)
    
    fieldsets = UserAdmin.fieldsets + (
        ('Additional Info', {'fields': ('role',)}),
    )

@admin.register(Profile)
class ProfileAdmin(admin.ModelAdmin):
    list_display = ('first_name', 'last_name', 'phone_number', 'created_at')
    search_fields = ('first_name', 'last_name', 'phone_number')

@admin.register(Student)
class StudentAdmin(admin.ModelAdmin):
    list_display = ('student_id', 'get_full_name', 'program', 'year_of_study', 'created_at')
    search_fields = ('student_id', 'user__first_name', 'user__last_name', 'program')
    list_filter = ('year_of_study', 'program')
    
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"
    get_full_name.short_description = 'Full Name'

@admin.register(Supervisor)
class SupervisorAdmin(admin.ModelAdmin):
    list_display = ('get_full_name', 'created_at')
    search_fields = ('user__first_name', 'user__last_name')
    
    def get_full_name(self, obj):
        return f"{obj.user.first_name} {obj.user.last_name}"
    get_full_name.short_description = 'Full Name'

@admin.register(Company)
class CompanyAdmin(admin.ModelAdmin):
    list_display = ('name', 'location', 'industry', 'contact_email', 'created_at')
    search_fields = ('name', 'location', 'industry')
    list_filter = ('industry',)

@admin.register(Attachment)
class AttachmentAdmin(admin.ModelAdmin):
    list_display = ('get_student_name', 'company', 'start_date', 'end_date', 'created_at')
    search_fields = ('student__user__first_name', 'student__user__last_name', 'company__name')
    list_filter = ('start_date', 'end_date')
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"
    get_student_name.short_description = 'Student'

@admin.register(SupervisorAssignment)
class SupervisorAssignmentAdmin(admin.ModelAdmin):
    list_display = ('get_student_name', 'get_supervisor_name', 'status', 'created_at')
    search_fields = ('student__user__first_name', 'supervisor__user__first_name')
    list_filter = ('status',)
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"
    get_student_name.short_description = 'Student'
    
    def get_supervisor_name(self, obj):
        return f"{obj.supervisor.user.first_name} {obj.supervisor.user.last_name}"
    get_supervisor_name.short_description = 'Supervisor'

@admin.register(VerificationStatus)
class VerificationStatusAdmin(admin.ModelAdmin):
    list_display = ('get_student_name', 'is_verified', 'fee_verified', 'verification_date')
    search_fields = ('student__user__first_name', 'student__user__last_name')
    list_filter = ('is_verified', 'fee_verified')
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"
    get_student_name.short_description = 'Student'

@admin.register(WeeklyLog)
class WeeklyLogAdmin(admin.ModelAdmin):
    list_display = ('get_student_name', 'week_number', 'day', 'date', 'created_at')
    search_fields = ('student__user__first_name', 'student__user__last_name')
    list_filter = ('week_number', 'day', 'date')
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"
    get_student_name.short_description = 'Student'

@admin.register(Evaluation)
class EvaluationAdmin(admin.ModelAdmin):
    list_display = ('get_student_name', 'get_evaluator_name', 'total', 'evaluation_date', 'created_at')
    search_fields = ('student__user__first_name', 'evaluator__first_name')
    list_filter = ('evaluation_date', 'total')
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"
    get_student_name.short_description = 'Student'
    
    def get_evaluator_name(self, obj):
        return f"{obj.evaluator.first_name} {obj.evaluator.last_name}"
    get_evaluator_name.short_description = 'Evaluator'

@admin.register(Reimbursement)
class ReimbursementAdmin(admin.ModelAdmin):
    list_display = ('get_student_name', 'company', 'amount', 'status', 'created_at')
    search_fields = ('student__user__first_name', 'company__name')
    list_filter = ('status', 'created_at')
    
    def get_student_name(self, obj):
        return f"{obj.student.user.first_name} {obj.student.user.last_name}"
    get_student_name.short_description = 'Student'

@admin.register(Message)
class MessageAdmin(admin.ModelAdmin):
    list_display = ('get_sender_name', 'get_receiver_name', 'read', 'created_at')
    search_fields = ('sender__first_name', 'receiver__first_name', 'content')
    list_filter = ('read', 'created_at')
    
    def get_sender_name(self, obj):
        return f"{obj.sender.first_name} {obj.sender.last_name}"
    get_sender_name.short_description = 'Sender'
    
    def get_receiver_name(self, obj):
        return f"{obj.receiver.first_name} {obj.receiver.last_name}"
    get_receiver_name.short_description = 'Receiver'