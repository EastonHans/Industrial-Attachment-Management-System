-- Student Industrial Attachment Management System
-- Supabase/PostgreSQL Database Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable Row Level Security (RLS) extension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create custom types/enums
CREATE TYPE user_role AS ENUM ('admin', 'student', 'supervisor', 'dean');
CREATE TYPE program_type AS ENUM ('degree', 'diploma');
CREATE TYPE semester_type AS ENUM ('1', '2');
CREATE TYPE attachment_period AS ENUM ('Jan-Apr', 'May-Aug', 'Sep-Dec');
CREATE TYPE assignment_status AS ENUM ('active', 'pending', 'inactive');
CREATE TYPE attachment_status AS ENUM ('pending', 'approved', 'rejected', 'completed');
CREATE TYPE reimbursement_status AS ENUM ('pending', 'approved', 'rejected', 'paid');

-- 1. Users table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    first_name TEXT NOT NULL,
    last_name TEXT NOT NULL,
    email TEXT UNIQUE NOT NULL,
    role user_role NOT NULL DEFAULT 'student',
    phone_number TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Students table
CREATE TABLE students (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    student_id TEXT UNIQUE NOT NULL,
    program TEXT NOT NULL,
    program_type program_type DEFAULT 'degree',
    faculty TEXT,
    department TEXT,
    year_of_study INTEGER NOT NULL CHECK (year_of_study >= 1 AND year_of_study <= 6),
    semester semester_type DEFAULT '1',
    attachment_period attachment_period,
    phone_number TEXT,
    final_grade DECIMAL(5,2) CHECK (final_grade >= 0 AND final_grade <= 100),
    grade_calculation_details JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Supervisors table
CREATE TABLE supervisors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
    department TEXT,
    title TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Companies table
CREATE TABLE companies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    location TEXT NOT NULL,
    industry TEXT,
    description TEXT,
    address TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Attachments table
CREATE TABLE attachments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    status attachment_status DEFAULT 'pending',
    address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT valid_attachment_dates CHECK (end_date > start_date)
);

-- 6. Supervisor Assignments table
CREATE TABLE supervisor_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    supervisor_id UUID REFERENCES supervisors(id) ON DELETE CASCADE NOT NULL,
    status assignment_status DEFAULT 'active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, supervisor_id)
);

-- 7. Verification Status table
CREATE TABLE verification_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE UNIQUE NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    verification_date TIMESTAMPTZ,
    verification_details JSONB,
    fee_verified BOOLEAN DEFAULT FALSE,
    fee_verification_date TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Weekly Logs table
CREATE TABLE weekly_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    week_number INTEGER NOT NULL CHECK (week_number >= 1),
    date DATE NOT NULL,
    day TEXT NOT NULL,
    task_assigned TEXT,
    attachee_remarks TEXT,
    trainer_remarks TEXT,
    supervisor_remarks TEXT,
    trainer_signature TEXT,
    supervisor_signature TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(student_id, week_number, date)
);

-- 9. Evaluations table
CREATE TABLE evaluations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    attachment_id UUID REFERENCES attachments(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    supervisor_id UUID REFERENCES supervisors(id) ON DELETE CASCADE NOT NULL,
    evaluator_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    evaluation_date DATE NOT NULL,
    performance_rating INTEGER CHECK (performance_rating >= 1 AND performance_rating <= 10),
    availability_of_documents INTEGER CHECK (availability_of_documents >= 1 AND availability_of_documents <= 10),
    organization_of_logbook INTEGER CHECK (organization_of_logbook >= 1 AND organization_of_logbook <= 10),
    adaptability INTEGER CHECK (adaptability >= 1 AND adaptability <= 10),
    teamwork INTEGER CHECK (teamwork >= 1 AND teamwork <= 10),
    accomplishment INTEGER CHECK (accomplishment >= 1 AND accomplishment <= 10),
    presence INTEGER CHECK (presence >= 1 AND presence <= 10),
    communication_skills INTEGER CHECK (communication_skills >= 1 AND communication_skills <= 10),
    mannerism INTEGER CHECK (mannerism >= 1 AND mannerism <= 10),
    understanding_of_tasks INTEGER CHECK (understanding_of_tasks >= 1 AND understanding_of_tasks <= 10),
    oral_presentation INTEGER CHECK (oral_presentation >= 1 AND oral_presentation <= 10),
    total INTEGER CHECK (total >= 11 AND total <= 110),
    comments TEXT,
    overall_assessment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Reimbursements table
CREATE TABLE reimbursements (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    student_id UUID REFERENCES students(id) ON DELETE CASCADE NOT NULL,
    company_id UUID REFERENCES companies(id) ON DELETE CASCADE NOT NULL,
    supervisor_id UUID REFERENCES supervisors(id) ON DELETE SET NULL,
    amount DECIMAL(10,2) NOT NULL CHECK (amount >= 0),
    distance DECIMAL(10,2) NOT NULL CHECK (distance >= 0),
    rate DECIMAL(10,2) NOT NULL CHECK (rate >= 0),
    lunch DECIMAL(10,2) NOT NULL CHECK (lunch >= 0),
    supervision_visits INTEGER DEFAULT 1 CHECK (supervision_visits >= 1),
    status reimbursement_status DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Messages table
CREATE TABLE messages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sender_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    receiver_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    content TEXT NOT NULL,
    read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_role ON profiles(role);

CREATE INDEX idx_students_user_id ON students(user_id);
CREATE INDEX idx_students_student_id ON students(student_id);
CREATE INDEX idx_students_program ON students(program);

CREATE INDEX idx_supervisors_user_id ON supervisors(user_id);
CREATE INDEX idx_supervisors_department ON supervisors(department);

CREATE INDEX idx_companies_name ON companies(name);
CREATE INDEX idx_companies_location ON companies(location);

CREATE INDEX idx_attachments_student_id ON attachments(student_id);
CREATE INDEX idx_attachments_company_id ON attachments(company_id);
CREATE INDEX idx_attachments_supervisor_id ON attachments(supervisor_id);
CREATE INDEX idx_attachments_status ON attachments(status);

CREATE INDEX idx_supervisor_assignments_student_id ON supervisor_assignments(student_id);
CREATE INDEX idx_supervisor_assignments_supervisor_id ON supervisor_assignments(supervisor_id);

CREATE INDEX idx_verification_status_student_id ON verification_status(student_id);

CREATE INDEX idx_weekly_logs_student_id ON weekly_logs(student_id);
CREATE INDEX idx_weekly_logs_date ON weekly_logs(date);

CREATE INDEX idx_evaluations_student_id ON evaluations(student_id);
CREATE INDEX idx_evaluations_supervisor_id ON evaluations(supervisor_id);
CREATE INDEX idx_evaluations_evaluator_id ON evaluations(evaluator_id);

CREATE INDEX idx_reimbursements_student_id ON reimbursements(student_id);
CREATE INDEX idx_reimbursements_status ON reimbursements(status);

CREATE INDEX idx_messages_sender_id ON messages(sender_id);
CREATE INDEX idx_messages_receiver_id ON messages(receiver_id);
CREATE INDEX idx_messages_read ON messages(read);

-- Create updated_at trigger function
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply updated_at triggers to relevant tables
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_students_updated_at BEFORE UPDATE ON students FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supervisors_updated_at BEFORE UPDATE ON supervisors FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_attachments_updated_at BEFORE UPDATE ON attachments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_supervisor_assignments_updated_at BEFORE UPDATE ON supervisor_assignments FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_verification_status_updated_at BEFORE UPDATE ON verification_status FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_weekly_logs_updated_at BEFORE UPDATE ON weekly_logs FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_evaluations_updated_at BEFORE UPDATE ON evaluations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_reimbursements_updated_at BEFORE UPDATE ON reimbursements FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();