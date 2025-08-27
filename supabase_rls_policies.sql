-- Row Level Security (RLS) Policies for Supabase
-- Student Industrial Attachment Management System

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisors ENABLE ROW LEVEL SECURITY;
ALTER TABLE companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE attachments ENABLE ROW LEVEL SECURITY;
ALTER TABLE supervisor_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE weekly_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_uuid UUID)
RETURNS TEXT AS $$
BEGIN
    RETURN (SELECT role FROM profiles WHERE user_id = user_uuid);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is admin
CREATE OR REPLACE FUNCTION is_admin(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(user_uuid) = 'admin';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is supervisor
CREATE OR REPLACE FUNCTION is_supervisor(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(user_uuid) = 'supervisor';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Helper function to check if user is student
CREATE OR REPLACE FUNCTION is_student(user_uuid UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN get_user_role(user_uuid) = 'student';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- PROFILES TABLE POLICIES
-- Users can read all profiles but only update their own
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert their own profile" ON profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON profiles FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any profile" ON profiles FOR UPDATE USING (is_admin(auth.uid()));

-- STUDENTS TABLE POLICIES
-- Students can only see their own data, supervisors can see assigned students, admins see all
CREATE POLICY "Students can view their own data" ON students FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Supervisors can view assigned students" ON students FOR SELECT USING (
    is_supervisor(auth.uid()) AND 
    id IN (SELECT student_id FROM supervisor_assignments WHERE supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid()))
);
CREATE POLICY "Admins can view all students" ON students FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Students can update their own data" ON students FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any student" ON students FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert students" ON students FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- SUPERVISORS TABLE POLICIES
CREATE POLICY "Everyone can view supervisors" ON supervisors FOR SELECT USING (true);
CREATE POLICY "Supervisors can update their own data" ON supervisors FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Admins can update any supervisor" ON supervisors FOR UPDATE USING (is_admin(auth.uid()));
CREATE POLICY "Admins can insert supervisors" ON supervisors FOR INSERT WITH CHECK (is_admin(auth.uid()));

-- COMPANIES TABLE POLICIES
CREATE POLICY "Everyone can view companies" ON companies FOR SELECT USING (true);
CREATE POLICY "Admins can manage companies" ON companies FOR ALL USING (is_admin(auth.uid()));

-- ATTACHMENTS TABLE POLICIES
CREATE POLICY "Students can view their own attachments" ON attachments FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Supervisors can view supervised attachments" ON attachments FOR SELECT USING (
    is_supervisor(auth.uid()) AND 
    (supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid()) OR
     student_id IN (SELECT student_id FROM supervisor_assignments WHERE supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())))
);
CREATE POLICY "Admins can view all attachments" ON attachments FOR SELECT USING (is_admin(auth.uid()));
CREATE POLICY "Students can insert their own attachments" ON attachments FOR INSERT WITH CHECK (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage all attachments" ON attachments FOR ALL USING (is_admin(auth.uid()));

-- SUPERVISOR ASSIGNMENTS TABLE POLICIES
CREATE POLICY "Students can view their assignments" ON supervisor_assignments FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Supervisors can view their assignments" ON supervisor_assignments FOR SELECT USING (
    supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage all assignments" ON supervisor_assignments FOR ALL USING (is_admin(auth.uid()));

-- VERIFICATION STATUS TABLE POLICIES
CREATE POLICY "Students can view their verification status" ON verification_status FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage verification status" ON verification_status FOR ALL USING (is_admin(auth.uid()));

-- WEEKLY LOGS TABLE POLICIES
CREATE POLICY "Students can manage their own logs" ON weekly_logs FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Supervisors can view assigned student logs" ON weekly_logs FOR SELECT USING (
    is_supervisor(auth.uid()) AND 
    student_id IN (SELECT student_id FROM supervisor_assignments WHERE supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid()))
);
CREATE POLICY "Supervisors can update assigned student logs" ON weekly_logs FOR UPDATE USING (
    is_supervisor(auth.uid()) AND 
    student_id IN (SELECT student_id FROM supervisor_assignments WHERE supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid()))
);
CREATE POLICY "Admins can manage all logs" ON weekly_logs FOR ALL USING (is_admin(auth.uid()));

-- EVALUATIONS TABLE POLICIES
CREATE POLICY "Students can view their evaluations" ON evaluations FOR SELECT USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Supervisors can manage evaluations for assigned students" ON evaluations FOR ALL USING (
    is_supervisor(auth.uid()) AND 
    (supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid()) OR
     student_id IN (SELECT student_id FROM supervisor_assignments WHERE supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())))
);
CREATE POLICY "Evaluators can manage their own evaluations" ON evaluations FOR ALL USING (auth.uid() = evaluator_id);
CREATE POLICY "Admins can manage all evaluations" ON evaluations FOR ALL USING (is_admin(auth.uid()));

-- REIMBURSEMENTS TABLE POLICIES
CREATE POLICY "Students can manage their own reimbursements" ON reimbursements FOR ALL USING (
    student_id IN (SELECT id FROM students WHERE user_id = auth.uid())
);
CREATE POLICY "Supervisors can view and approve reimbursements" ON reimbursements FOR SELECT USING (
    is_supervisor(auth.uid()) AND 
    (supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid()) OR
     student_id IN (SELECT student_id FROM supervisor_assignments WHERE supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())))
);
CREATE POLICY "Supervisors can update reimbursement status" ON reimbursements FOR UPDATE USING (
    is_supervisor(auth.uid()) AND 
    supervisor_id IN (SELECT id FROM supervisors WHERE user_id = auth.uid())
);
CREATE POLICY "Admins can manage all reimbursements" ON reimbursements FOR ALL USING (is_admin(auth.uid()));

-- MESSAGES TABLE POLICIES
CREATE POLICY "Users can view their own messages" ON messages FOR SELECT USING (
    auth.uid() = sender_id OR auth.uid() = receiver_id
);
CREATE POLICY "Users can send messages" ON messages FOR INSERT WITH CHECK (auth.uid() = sender_id);
CREATE POLICY "Users can update their received messages" ON messages FOR UPDATE USING (auth.uid() = receiver_id);
CREATE POLICY "Admins can manage all messages" ON messages FOR ALL USING (is_admin(auth.uid()));