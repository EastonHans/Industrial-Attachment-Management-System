-- Create weekly_logs table
CREATE TABLE IF NOT EXISTS weekly_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    week_number integer NOT NULL,
    date date NOT NULL,
    day varchar(16) NOT NULL,
    task_assigned text NOT NULL,
    attachee_remarks text NOT NULL,
    trainer_remarks text,
    supervisor_remarks text,
    trainer_signature text,
    supervisor_signature text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
);

-- Create evaluations table
CREATE TABLE IF NOT EXISTS evaluations (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid REFERENCES students(id) ON DELETE CASCADE,
    supervisor_id uuid REFERENCES supervisors(id) ON DELETE CASCADE,
    week_number integer NOT NULL,
    availability_of_documents integer NOT NULL,
    organization_of_logbook integer NOT NULL,
    adaptability integer NOT NULL,
    teamwork integer NOT NULL,
    accomplishment integer NOT NULL,
    presence integer NOT NULL,
    communication_skills integer NOT NULL,
    mannerism integer NOT NULL,
    understanding_of_tasks integer NOT NULL,
    oral_presentation integer NOT NULL,
    total integer NOT NULL,
    overall_assessment varchar(16) NOT NULL,
    comments text,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now()
); 