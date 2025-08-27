-- Sample Data for Student Industrial Attachment Management System
-- Run this after creating the schema and RLS policies

-- Note: In Supabase, users are created through auth.users automatically
-- This script assumes you have some users created through Supabase Auth

-- Sample Companies
INSERT INTO companies (id, name, location, industry, description, contact_email, contact_phone) VALUES
('b1603348-fd38-48a0-8831-c8f9639eead2', 'Oracom Group Limited', 'Nairobi, Westlands', 'Technology', 'Software development and IT consulting', 'developer@oracom.co.ke', '+254729990583'),
('a2603348-fd38-48a0-8831-c8f9639eead3', 'Safaricom PLC', 'Nairobi, Westlands', 'Telecommunications', 'Leading telecommunications company in Kenya', 'careers@safaricom.co.ke', '+254722000000'),
('c3603348-fd38-48a0-8831-c8f9639eead4', 'Equity Bank', 'Nairobi, Upper Hill', 'Banking', 'Commercial banking and financial services', 'hr@equitybank.co.ke', '+254763000000');

-- Sample Profiles (these would typically be created when users sign up)
-- You'll need to replace the user_id values with actual UUIDs from auth.users
INSERT INTO profiles (id, user_id, first_name, last_name, email, role, phone_number) VALUES
-- Admins
('f271a93d-36f6-450d-9989-5f9ebaabb44e', 'f271a93d-36f6-450d-9989-5f9ebaabb44e', 'Super', 'Admin', 'admin@cuea.edu', 'admin', '+254700000001'),

-- Supervisors
('5994583b-40d2-436c-9570-231504cb09c1', '5994583b-40d2-436c-9570-231504cb09c1', 'Chris', 'Nandasaba', 'chrisn@cuea.edu', 'supervisor', '+254700000002'),
('85d1b466-86d5-4fbc-90e8-fa8fd5ad994c', '85d1b466-86d5-4fbc-90e8-fa8fd5ad994c', 'Jessy', 'Jane', 'jessyjane@cuea.edu', 'supervisor', '+254700000003'),
('9f4864a8-b5bb-4c5c-ad6d-c7d518823649', '9f4864a8-b5bb-4c5c-ad6d-c7d518823649', 'Joe', 'Goldberg', 'joegoldberg@cuea.edu', 'supervisor', '+254700000004'),
('b12afdaf-88bf-4f5b-b5de-c6afc4abe48e', 'b12afdaf-88bf-4f5b-b5de-c6afc4abe48e', 'David', 'Maina', 'davidmaina@cuea.edu', 'supervisor', '+254700000005'),

-- Students
('63659318-4769-4b4e-bc6b-15fcb5723a6f', '63659318-4769-4b4e-bc6b-15fcb5723a6f', 'Easton', 'Hans', 'hanseaston697@gmail.com', 'student', '+254754376221'),
('1eb7b6c4-e506-4b5f-8add-6675cc0fced3', '1eb7b6c4-e506-4b5f-8add-6675cc0fced3', 'Lewis', 'Waitiki', 'lewiswaitiki9@gmail.com', 'student', '+254718832651'),
('5b711e81-332a-499f-9ffe-43658f3b5676', '5b711e81-332a-499f-9ffe-43658f3b5676', 'Dally', 'Rover', 'dallyrover@gmail.com', 'student', '+254712345678');

-- Sample Supervisors
INSERT INTO supervisors (id, user_id, department, title) VALUES
('5994583b-40d2-436c-9570-231504cb09c1', '5994583b-40d2-436c-9570-231504cb09c1', 'Computer Science', 'Prof'),
('85d1b466-86d5-4fbc-90e8-fa8fd5ad994c', '85d1b466-86d5-4fbc-90e8-fa8fd5ad994c', 'Computer Science', 'Prof.'),
('9f4864a8-b5bb-4c5c-ad6d-c7d518823649', '9f4864a8-b5bb-4c5c-ad6d-c7d518823649', 'Computer Science', 'Prof.'),
('b12afdaf-88bf-4f5b-b5de-c6afc4abe48e', 'b12afdaf-88bf-4f5b-b5de-c6afc4abe48e', 'Computer Science', 'Dr.');

-- Sample Students
INSERT INTO students (id, user_id, student_id, program, program_type, faculty, department, year_of_study, semester, phone_number) VALUES
('63659318-4769-4b4e-bc6b-15fcb5723a6f', '63659318-4769-4b4e-bc6b-15fcb5723a6f', '1046098', 'Computer Science', 'degree', 'Science', 'Computer Science', 3, '2', '+254754376221'),
('1eb7b6c4-e506-4b5f-8add-6675cc0fced3', '1eb7b6c4-e506-4b5f-8add-6675cc0fced3', '40091070', 'Computer Science', 'degree', 'Science', 'Computer Science', 4, '1', '+254718832651'),
('5b711e81-332a-499f-9ffe-43658f3b5676', '5b711e81-332a-499f-9ffe-43658f3b5676', '1056789', 'Computer Science', 'degree', 'Science', 'Computer Science', 4, '2', '+254712345678');

-- Sample Supervisor Assignments
INSERT INTO supervisor_assignments (id, student_id, supervisor_id, status) VALUES
('ac1c3a7e-5bd4-4bdd-a722-1796c2c0e0b6', '63659318-4769-4b4e-bc6b-15fcb5723a6f', '5994583b-40d2-436c-9570-231504cb09c1', 'active'),
('2ea9adc5-a67f-4988-a5a3-47644818bf7c', '63659318-4769-4b4e-bc6b-15fcb5723a6f', '85d1b466-86d5-4fbc-90e8-fa8fd5ad994c', 'pending');

-- Sample Verification Status
INSERT INTO verification_status (id, student_id, is_verified, verification_date, fee_verified, fee_verification_date, verification_details) VALUES
('4431673a-d140-4b05-b3aa-7a218b77434f', '63659318-4769-4b4e-bc6b-15fcb5723a6f', true, '2025-06-09 07:53:38.891+00', true, '2025-06-09 07:55:19.435+00', 
'{"eligible":true,"debugMode":false,"nameMatched":true,"nameProvided":"Easton Hans","requiredUnits":20,"completedUnits":26,"hasIncompleteUnits":false,"meetsUnitRequirement":true,"meetsYearRequirement":true}'),
('19676a41-adb3-425b-b4d9-198eb45049a3', '1eb7b6c4-e506-4b5f-8add-6675cc0fced3', false, '2025-07-03 19:31:15.134+00', false, '2025-07-03 19:27:43.322+00',
'{"eligible":false,"debugMode":false,"nameMatched":false,"nameProvided":"lewis waitiki","requiredUnits":20,"completedUnits":0,"nameInTranscript":"1046054","hasIncompleteUnits":false,"meetsUnitRequirement":false,"meetsYearRequirement":true}');

-- Sample Attachments
INSERT INTO attachments (id, student_id, company_id, supervisor_id, start_date, end_date, status, address) VALUES
('8e53b3e1-bc48-4d1b-ac94-95b0ceffc717', '63659318-4769-4b4e-bc6b-15fcb5723a6f', 'b1603348-fd38-48a0-8831-c8f9639eead2', '5994583b-40d2-436c-9570-231504cb09c1', '2025-07-02', '2025-08-31', 'approved', 'Nairobi, Westlands');

-- Sample Weekly Logs
INSERT INTO weekly_logs (id, student_id, week_number, date, day, task_assigned, attachee_remarks) VALUES
('08872101-e133-4ac4-a01c-4763a1bb3979', '63659318-4769-4b4e-bc6b-15fcb5723a6f', 1, '2025-07-03', 'Thursday', 'Updating customer details on company database', 'Gained valuable insights on what it takes to improve a company''s SEO');

-- Sample Evaluations
INSERT INTO evaluations (id, attachment_id, student_id, supervisor_id, evaluator_id, evaluation_date, 
    performance_rating, availability_of_documents, organization_of_logbook, adaptability, teamwork, 
    accomplishment, presence, communication_skills, mannerism, understanding_of_tasks, oral_presentation, 
    total, comments, overall_assessment) VALUES
('eval-001', '8e53b3e1-bc48-4d1b-ac94-95b0ceffc717', '63659318-4769-4b4e-bc6b-15fcb5723a6f', '5994583b-40d2-436c-9570-231504cb09c1', '5994583b-40d2-436c-9570-231504cb09c1', '2025-08-30',
    8, 9, 8, 7, 8, 8, 9, 8, 8, 8, 7, 88, 'Good performance overall', 'Student showed excellent dedication and learning ability');

-- Sample Reimbursements
INSERT INTO reimbursements (id, student_id, company_id, supervisor_id, amount, distance, rate, lunch, supervision_visits, status) VALUES
('0b352ddc-3c52-4694-be15-2080753877cf', '63659318-4769-4b4e-bc6b-15fcb5723a6f', 'b1603348-fd38-48a0-8831-c8f9639eead2', '5994583b-40d2-436c-9570-231504cb09c1', 3954.4, 14.772, 100, 1000, 1, 'approved'),
('8bdc6804-a540-4d34-945b-db9cd77f9c4f', '63659318-4769-4b4e-bc6b-15fcb5723a6f', 'b1603348-fd38-48a0-8831-c8f9639eead2', '85d1b466-86d5-4fbc-90e8-fa8fd5ad994c', 3954.4, 14.772, 100, 1000, 1, 'approved');

-- Sample Messages
INSERT INTO messages (id, sender_id, receiver_id, content, read) VALUES
('msg-001', '5994583b-40d2-436c-9570-231504cb09c1', '63659318-4769-4b4e-bc6b-15fcb5723a6f', 'Please submit your weekly log for review.', false),
('msg-002', '63659318-4769-4b4e-bc6b-15fcb5723a6f', '5994583b-40d2-436c-9570-231504cb09c1', 'Weekly log submitted. Thank you for the feedback.', true);