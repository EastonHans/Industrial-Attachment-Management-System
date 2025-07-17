-- Create reimbursements table
CREATE TABLE IF NOT EXISTS reimbursements (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    supervisor_id UUID REFERENCES supervisors(id) ON DELETE CASCADE,
    student_id UUID REFERENCES students(id) ON DELETE CASCADE,
    amount DECIMAL(10,2) NOT NULL,
    distance DECIMAL(10,2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS reimbursements_supervisor_id_idx ON reimbursements(supervisor_id);
CREATE INDEX IF NOT EXISTS reimbursements_student_id_idx ON reimbursements(student_id);
CREATE INDEX IF NOT EXISTS reimbursements_status_idx ON reimbursements(status);

-- Add RLS policies
ALTER TABLE reimbursements ENABLE ROW LEVEL SECURITY;

-- Allow admins to do everything
CREATE POLICY "Admins can do everything" ON reimbursements
    FOR ALL
    TO authenticated
    USING (auth.uid() IN (SELECT id FROM profiles WHERE role = 'admin'));

-- Allow supervisors to view their own reimbursements
CREATE POLICY "Supervisors can view their reimbursements" ON reimbursements
    FOR SELECT
    TO authenticated
    USING (supervisor_id IN (SELECT id FROM supervisors WHERE profile_id = auth.uid()));

-- Allow students to view reimbursements related to them
CREATE POLICY "Students can view their reimbursements" ON reimbursements
    FOR SELECT
    TO authenticated
    USING (student_id IN (SELECT id FROM students WHERE profile_id = auth.uid()));

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = TIMEZONE('utc'::text, NOW());
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_reimbursements_updated_at
    BEFORE UPDATE ON reimbursements
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column(); 