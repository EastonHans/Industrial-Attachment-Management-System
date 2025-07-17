-- Add fee_verified and fee_verification_date columns to verification_status
ALTER TABLE verification_status ADD COLUMN IF NOT EXISTS fee_verified BOOLEAN DEFAULT NULL;
ALTER TABLE verification_status ADD COLUMN IF NOT EXISTS fee_verification_date TIMESTAMP WITH TIME ZONE DEFAULT NULL;

-- Add foreign key from reimbursements.student_id to students.id
ALTER TABLE reimbursements
ADD CONSTRAINT fk_reimbursements_student
FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE;

-- Add foreign key from reimbursements.company_id to companies.id
ALTER TABLE reimbursements
ADD CONSTRAINT fk_reimbursements_company
FOREIGN KEY (company_id) REFERENCES companies(id) ON DELETE CASCADE;

-- Add foreign key from reimbursements.supervisor_id to supervisors.id
ALTER TABLE reimbursements
ADD CONSTRAINT fk_reimbursements_supervisor
FOREIGN KEY (supervisor_id) REFERENCES supervisors(id) ON DELETE CASCADE;