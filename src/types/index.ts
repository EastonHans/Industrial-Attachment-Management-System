
export type UserRole = "student" | "supervisor" | "admin";

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  createdAt: Date;
}

export interface Student extends User {
  role: "student";
  studentId: string;
  program: string;
  yearOfStudy: number;
}

export interface Supervisor extends User {
  role: "supervisor";
  department: string;
  title?: string;
}

export interface Admin extends User {
  role: "admin";
}

export interface Company {
  id: string;
  name: string;
  location: string;
  industry: string;
  description?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface Attachment {
  id: string;
  studentId: string;
  companyId: string;
  supervisorId?: string;
  startDate: Date;
  endDate: Date;
  status: 'pending' | 'approved' | 'ongoing' | 'completed' | 'rejected';
  createdAt: Date;
  updatedAt: Date;
}

export interface Report {
  id: string;
  attachmentId: string;
  reportType: 'weekly' | 'monthly' | 'final';
  weekNumber?: number;
  title: string;
  content: string;
  submissionDate: Date;
  status: 'pending' | 'reviewed' | 'approved' | 'rejected';
  feedback?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface Evaluation {
  id: string;
  attachmentId: string;
  evaluatorId: string;
  evaluationDate: Date;
  performanceRating?: number;
  comments?: string;
  createdAt: Date;
  updatedAt: Date;
}
