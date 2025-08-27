# Student Industrial Attachment Management System - ERD

## Entity Relationship Diagram

```mermaid
erDiagram
    User {
        UUID id PK
        string email UK
        string username
        string first_name
        string last_name
        string role
        datetime created_at
        datetime updated_at
    }
    
    Profile {
        UUID id PK
        UUID user_id FK
        string first_name
        string last_name
        string phone_number
        datetime created_at
        datetime updated_at
    }
    
    Student {
        UUID id PK
        UUID user_id FK
        string student_id UK
        string program
        string program_type
        string faculty
        string department
        int year_of_study
        int semester
        string attachment_period
        string phone_number
        decimal final_grade
        json grade_calculation_details
        datetime created_at
        datetime updated_at
    }
    
    Supervisor {
        UUID id PK
        UUID user_id FK
        string department
        string title
        datetime created_at
        datetime updated_at
    }
    
    Company {
        UUID id PK
        string name
        string location
        string industry
        string description
        string address
        string contact_email
        string contact_phone
        datetime created_at
        datetime updated_at
    }
    
    Attachment {
        UUID id PK
        UUID student_id FK
        UUID company_id FK
        UUID supervisor_id FK
        date start_date
        date end_date
        string status
        string address
        datetime created_at
        datetime updated_at
    }
    
    SupervisorAssignment {
        UUID id PK
        UUID student_id FK
        UUID supervisor_id FK
        string status
        datetime created_at
        datetime updated_at
    }
    
    VerificationStatus {
        UUID id PK
        UUID student_id FK
        boolean is_verified
        datetime verification_date
        json verification_details
        boolean fee_verified
        datetime fee_verification_date
        datetime created_at
        datetime updated_at
    }
    
    WeeklyLog {
        UUID id PK
        UUID student_id FK
        int week_number
        date date
        string day
        text task_assigned
        text attachee_remarks
        text trainer_remarks
        text supervisor_remarks
        text trainer_signature
        text supervisor_signature
        datetime created_at
        datetime updated_at
    }
    
    Evaluation {
        UUID id PK
        UUID attachment_id FK
        UUID student_id FK
        UUID supervisor_id FK
        UUID evaluator_id FK
        date evaluation_date
        int performance_rating
        int availability_of_documents
        int organization_of_logbook
        int adaptability
        int teamwork
        int accomplishment
        int presence
        int communication_skills
        int mannerism
        int understanding_of_tasks
        int oral_presentation
        int total
        text comments
        text overall_assessment
        datetime created_at
        datetime updated_at
    }
    
    Reimbursement {
        UUID id PK
        UUID student_id FK
        UUID company_id FK
        UUID supervisor_id FK
        decimal amount
        decimal distance
        decimal rate
        decimal lunch
        int supervision_visits
        string status
        datetime created_at
        datetime updated_at
    }
    
    Message {
        UUID id PK
        UUID sender_id FK
        UUID receiver_id FK
        text content
        boolean read
        datetime created_at
    }

    %% Relationships
    User ||--|| Profile : "has"
    User ||--o| Student : "can be"
    User ||--o| Supervisor : "can be"
    User ||--o{ Message : "sends"
    User ||--o{ Message : "receives"
    User ||--o{ Evaluation : "evaluates"
    
    Student ||--o| VerificationStatus : "has"
    Student ||--o{ Attachment : "has"
    Student ||--o{ SupervisorAssignment : "assigned to"
    Student ||--o{ WeeklyLog : "writes"
    Student ||--o{ Evaluation : "evaluated"
    Student ||--o{ Reimbursement : "claims"
    
    Supervisor ||--o{ SupervisorAssignment : "supervises"
    Supervisor ||--o{ Attachment : "supervises"
    Supervisor ||--o{ Evaluation : "conducts"
    Supervisor ||--o{ Reimbursement : "approves"
    
    Company ||--o{ Attachment : "hosts"
    Company ||--o{ Reimbursement : "reimburses"
    
    Attachment ||--o{ Evaluation : "evaluated for"
```

## Key Relationships Summary

### Core Entities
- **User**: Base authentication entity with roles (admin, student, supervisor, dean)
- **Profile**: Extended user information (one-to-one with User)
- **Student**: Student-specific information linked to User
- **Supervisor**: Supervisor-specific information linked to User
- **Company**: Organizations hosting attachments

### Process Entities
- **Attachment**: Central entity linking students to companies for industrial attachment
- **SupervisorAssignment**: Manages supervisor-student relationships
- **VerificationStatus**: Tracks student eligibility verification
- **WeeklyLog**: Student's weekly activity reports during attachment
- **Evaluation**: Performance assessments by supervisors/lecturers
- **Reimbursement**: Travel and expense claims
- **Message**: Communication system between users

### Key Business Rules
1. Each User has exactly one Profile
2. Users can have different roles (student, supervisor, admin, dean)
3. Students can have multiple attachments over time
4. Students can be assigned to multiple supervisors
5. Attachments are evaluated by multiple evaluators (lecturers)
6. Final grades are calculated from multiple evaluations (50% each from 2 lecturers)
7. Reimbursements are linked to specific attachments and require supervisor approval
8. Weekly logs track daily activities during attachment period

### Data Integrity Features
- UUID primary keys for all entities
- Soft delete capabilities through status fields
- Audit trails with created_at/updated_at timestamps
- JSON fields for flexible data storage (verification details, grade calculations)
- Foreign key constraints maintaining referential integrity