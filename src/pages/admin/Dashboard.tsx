import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Users, ClipboardCheck, BarChart, DollarSign, Bell, Building, UserCheck, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext_django";
import { supabase, API_BASE_URL, tokenManager } from "@/services/djangoApi";
import { ProfileSettings } from "@/components/ProfileSettings";
import { Label } from "@/components/ui/label";
import { generateIntroductoryLetter, downloadLetter } from "@/utils/letterGenerator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { DeleteConfirmationModal } from "@/components/ui/delete-confirmation-modal";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { ChartContainer } from "@/components/ui/chart";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart as LucideBarChart } from "lucide-react";
import { PieChart, Pie, Cell, Legend } from "recharts";
import NavBar from "@/components/layout/NavBar";
import { automaticDataIntegrityChecker } from "@/utils/automaticDataIntegrity";
import { processTemplateFile, replacePlaceholders } from "@/utils/templateProcessor";

// Helper functions for company data access
function getCompanyName(student: any): string {
  if (!student) return '-';
  // Try attachments first
  if (student.attachments?.[0]?.company?.name) return student.attachments[0].company.name;
  // Fallback to direct company property
  if (student.company?.name) return student.company.name;
  return '-';
}

function getCompanyLocation(student: any): string {
  if (!student) return '-';
  // Try attachments first
  if (student.attachments?.[0]?.company?.location) return student.attachments[0].company.location;
  if (student.attachments?.[0]?.company?.address) return student.attachments[0].company.address;
  // Fallback to direct company property
  if (student.company?.location) return student.company.location;
  if (student.company?.address) return student.company.address;
  return '-';
}

type Student = {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
  };
  student_id: string;
  program: string;
  program_type: string;
  faculty: string;
  department: string;
  year_of_study: number;
  semester: number;
  attachment_period: string;
  phone_number: string;
  final_grade?: number;
  grade_calculation_details?: any;
  verification_status?: {
    id: string;
    is_verified: boolean;
    verification_date: string;
    fee_verified: boolean;
  };
  attachments: Array<{
    id: string;
    attachment_period: string;
    company: {
      id: string;
      name: string;
      location: string;
    };
  }>;
  created_at: string;
  updated_at: string;
};

type SupervisorWithStudents = {
  id: string;
  user: {
    id: string;
    email: string;
    first_name: string;
    last_name: string;
    role: string;
    is_active: boolean;
  };
  department?: string;
  title?: string;
  students_count?: number;
  assigned_students?: Array<{
    id: string;
    student_id: string;
    program: string;
    year_of_study: number;
    user: {
      first_name: string;
      last_name: string;
      email: string;
    };
    phone_number?: string;
    company?: {
      name: string;
      location: string;
    };
    attachment_period?: string;
  }>;
  created_at: string;
  updated_at: string;
};

type Reimbursement = {
  id: string;
  student_id: string;
  company_id: string;
  supervisor_id: string;
  amount: number;
  distance: number;
  rate: number;
  lunch: number;
  status: string;
  created_at: string;
  updated_at: string;
  student?: {
    user: {
      first_name: string;
      last_name: string;
      email: string;
    };
  };
  company?: {
    name: string;
    location: string;
  };
  supervisor?: {
    user: {
      first_name: string;
      last_name: string;
      email: string;
    };
  };
};

const AdminDashboard = () => {
  const { toast } = useToast();
  const [selectedTab, setSelectedTab] = useState("students");
  const [searchTerm, setSearchTerm] = useState("");
  const { logout, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [supervisors, setSupervisors] = useState<SupervisorWithStudents[]>([]);
  const [reimbursements, setReimbursements] = useState<Reimbursement[]>([]);
  const [globalRate, setGlobalRate] = useState(() => {
    const stored = localStorage.getItem('globalRate');
    const defaultRate = 20;
    if (!stored) {
      localStorage.setItem('globalRate', defaultRate.toString());
    }
    return stored ? Number(stored) : defaultRate;
  });
  const [globalLunch, setGlobalLunch] = useState(() => {
    const stored = localStorage.getItem('globalLunch');
    const defaultLunch = 200;
    if (!stored) {
      localStorage.setItem('globalLunch', defaultLunch.toString());
    }
    return stored ? Number(stored) : defaultLunch;
  });
  const [supervisorForm, setSupervisorForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    title: "",
  });
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [letterTemplate, setLetterTemplate] = useState<string>(`<div style="font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto;">
    <div style="text-align: center; margin-bottom: 30px;">
      <h2 style="margin: 0; color: #003366;">THE CATHOLIC UNIVERSITY OF EASTERN AFRICA</h2>
      <h3 style="margin: 5px 0; color: #003366;">{{faculty}}</h3>
      <h4 style="margin: 5px 0; color: #666;">{{department}}</h4>
    </div>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 0;"><strong>Date:</strong> {{date}}</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 0;"><strong>To Whom It May Concern,</strong></p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 0;">Dear Sir/Madam,</p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <p style="margin: 0;"><strong>Re: Attachment/Internship for: {{name}}</strong></p>
      <p style="margin: 0;"><strong>Registration No.: {{admno}}</strong></p>
    </div>
    
    <div style="margin-bottom: 20px;">
      <p>The above named is a {{current_year}} year student taking a {{total_years}} {{degree_type}} programme at The Catholic University of Eastern Africa in the {{faculty}}, {{department}}. The student is taking a Bachelor of Science in {{program}}.</p>
      
      <p>The Faculty believes that through Industrial attachments/internships the students will be able to tap a wide range of experience, skills and knowledge that would be difficult to replicate in a classroom setting or through written material alone.</p>
      
      <p>To expedite the process, we are therefore, requesting you to consider our student for attachment within the months of {{attachment_period}} 2024 when on long vacation and perhaps, let us know how we can proceed to establish the envisaged inter-organization linkage.</p>
      
      <p>I highly recommend the student for any attachment that may exist in your esteemed firm.</p>
    </div>
    
    <div style="margin-top: 50px;">
      <p style="margin: 0;">______________________________</p>
      <p style="margin: 5px 0;"><strong>Dr. Elicah Wabululu</strong></p>
      <p style="margin: 0;">Industrial Attachment Coordinator</p>
    </div>
  </div>`);
  const [uploadedLetterFile, setUploadedLetterFile] = useState<File | null>(null);
  const [letterFileContent, setLetterFileContent] = useState<string>("");
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [showUpdateModal, setShowUpdateModal] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(false);
  const [selectedSupervisor, setSelectedSupervisor] = useState<SupervisorWithStudents | null>(null);
  const [showEditSupervisorModal, setShowEditSupervisorModal] = useState(false);
  const [showViewSupervisorModal, setShowViewSupervisorModal] = useState(false);
  const [showAddStudentModal, setShowAddStudentModal] = useState(false);
  const [showAddSupervisorModal, setShowAddSupervisorModal] = useState(false);
  const [showSupervisors, setShowSupervisors] = useState(true);
  const [showAssigned, setShowAssigned] = useState(true);
  const [attachmentPeriodFilter, setAttachmentPeriodFilter] = useState<string>("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [messageContent, setMessageContent] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const messageInputRef = useRef(null);
  const [expandedSupervisors, setExpandedSupervisors] = useState<{ [id: string]: boolean }>({});
  const [supervisorStudentsPage, setSupervisorStudentsPage] = useState(0);
  const STUDENTS_PER_PAGE = 5;
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [deleteModal, setDeleteModal] = useState<{
    isOpen: boolean;
    type: 'student' | 'supervisor' | null;
    id: string;
    name: string;
    isLoading: boolean;
    assignedStudentsCount?: number;
  }>({ isOpen: false, type: null, id: '', name: '', isLoading: false, assignedStudentsCount: 0 });

  // Persist to localStorage when changed
  useEffect(() => {
    localStorage.setItem('globalRate', String(globalRate));
  }, [globalRate]);
  useEffect(() => {
    localStorage.setItem('globalLunch', String(globalLunch));
  }, [globalLunch]);

  // Helper function to get user name from Django API structure
  const getUserName = (user?: { first_name?: string; last_name?: string }) => {
    if (user) {
      return `${user.first_name || ''} ${user.last_name || ''}`.trim() || '-';
    }
    return '-';
  };

  // Legacy helper for backward compatibility
  const getProfileName = (profileArr?: Array<{ first_name?: string; last_name?: string }>) => {
    if (Array.isArray(profileArr) && profileArr[0]) {
      return getUserName(profileArr[0]);
    }
    return '-';
  };

  // Function to export reimbursements to CSV
  const exportReimbursements = () => {
    try {
      // Prepare data for export
      const exportData = filteredReimbursements.map((r) => {
        const supervisorProfileArr = r.supervisor?.profile as any[];
        const supervisorName = Array.isArray(supervisorProfileArr) && supervisorProfileArr.length > 0 && supervisorProfileArr[0] != null
          ? `${(supervisorProfileArr[0] as any).first_name || ''} ${(supervisorProfileArr[0] as any).last_name || ''}`.trim() || '-'
          : (r.supervisor?.profile && !Array.isArray(r.supervisor.profile) && typeof r.supervisor.profile === 'object' && 'first_name' in r.supervisor.profile ? `${(r.supervisor.profile as any).first_name} ${(r.supervisor.profile as any).last_name}`.trim() : '-');
        
        const studentProfileArr = r.student?.profile as any[];
        const studentName = Array.isArray(studentProfileArr) && studentProfileArr.length > 0 && studentProfileArr[0] != null
          ? `${(studentProfileArr[0] as any).first_name || ''} ${(studentProfileArr[0] as any).last_name || ''}`.trim() || '-'
          : (r.student?.profile && !Array.isArray(r.student.profile) && typeof r.student.profile === 'object' && 'first_name' in r.student.profile ? `${(r.student.profile as any).first_name} ${(r.student.profile as any).last_name}`.trim() : '-');
        
        const companyArr = r.company as any[];
        const companyName = Array.isArray(companyArr) && companyArr.length > 0 && companyArr[0] != null
          ? (companyArr[0] as any).name || '-' : (r.company && !Array.isArray(r.company) && typeof r.company === 'object' && 'name' in r.company ? (r.company as any).name : '-');
        
        const studentFee = 1000;
        const supervisionVisits = r.supervision_visits || 1;
        const displayAmount = (globalRate * ((r.distance || 0) * 2)) + studentFee + (globalLunch * supervisionVisits);
        
        return {
          'Supervisor': supervisorName,
          'Student': studentName,
          'Company': companyName,
          'Distance (km)': r.distance || 0,
          'Travel Rate (KSH/km)': globalRate,
          'Student Fee (KSH)': studentFee,
          'Supervision Visits': supervisionVisits,
          'Lunch per Visit (KSH)': globalLunch,
          'Total Amount (KSH)': displayAmount,
          'Status': r.status || 'pending',
          'Created Date': new Date(r.created_at).toLocaleDateString()
        };
      });

      // Convert to CSV
      if (exportData.length === 0) {
        toast({ title: "No data to export", variant: "destructive" });
        return;
      }

      const headers = Object.keys(exportData[0]);
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => `"${row[header as keyof typeof row]}"`).join(',')
        )
      ].join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', `reimbursements_${new Date().toISOString().split('T')[0]}.csv`);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      toast({ title: "Reimbursements exported successfully!" });
    } catch (error) {
      console.error('Export error:', error);
      toast({ title: "Export failed", description: "Please try again", variant: "destructive" });
    }
  };

  // Function to calculate distance between two points using Haversine formula
  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Earth's radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // Function to get coordinates from address using Google Maps Geocoding API
  const getCoordinates = async (address: string) => {
    try {
      const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        console.error('Google Maps API key not configured');
        return null;
      }
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${apiKey}`
      );
      const data = await response.json();
      if (data.results && data.results[0]) {
        const { lat, lng } = data.results[0].geometry.location;
        return { lat, lng };
      }
      throw new Error("Could not geocode address");
    } catch (error) {
      console.error("Error geocoding address:", error);
      return null;
    }
  };

  // Function to calculate and create reimbursements
  const calculateReimbursements = async (studentId: string, companyAddress: string, supervisors: any[]) => {
    try {
      // CUEA coordinates
      const cueaCoords = { lat: -1.2921, lng: 36.8219 };
      // Get company coordinates
      const companyCoords = await getCoordinates(companyAddress);
      if (!companyCoords) {
        throw new Error("Could not get company coordinates");
      }
      // Calculate distance (to and fro)
      const distance = calculateDistance(
        cueaCoords.lat,
        cueaCoords.lng,
        companyCoords.lat,
        companyCoords.lng
      ) * 2;
      // Calculate reimbursement amount
      // Formula: (rate * distance) + 1000 per student + (lunch * actual supervision visits)
      const studentFee = 1000; // KSH 1000 per student
      const supervisionVisits = 1; // Default to 1 visit - will be updated based on actual visits
      const amount = (globalRate * distance) + studentFee + (globalLunch * supervisionVisits);
      // Create reimbursements for each supervisor
      const reimbursements = supervisors.map(supervisorId => ({
        supervisor_id: supervisorId,
        student_id: studentId,
        amount: amount,
        rate: globalRate,
        lunch: globalLunch,
        supervision_visits: supervisionVisits,
        status: "pending",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      const { error: reimbursementError } = await supabase
        .from("reimbursements")
        .insert(reimbursements);
      if (reimbursementError) throw reimbursementError;
      return true;
    } catch (error) {
      console.error("Error calculating reimbursements:", error);
      return false;
    }
  };

  // Extract fetchDashboardData as a separate function for reuse
  const fetchDashboardData = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }

    try {
      console.log("Fetching admin dashboard data from Django API");

      // Fetch students
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select();

      if (studentsError) {
        console.error("Error fetching students:", studentsError);
        throw studentsError;
      }

      if (studentsData) {
        console.log("Students data:", studentsData);
        setStudents(studentsData.results || studentsData);
      }

      // Fetch supervisors
      const { data: supervisorsData, error: supervisorsError } = await supabase
        .from("supervisors")
        .select();

      if (supervisorsError) {
        console.error("Error fetching supervisors:", supervisorsError);
        throw supervisorsError;
      }

      if (supervisorsData) {
        console.log("Supervisors data:", supervisorsData);
        // For each supervisor, fetch their assigned students using Django API
        const supervisorsWithDetails = await Promise.all(
          (supervisorsData.results || supervisorsData).map(async (supervisor: any) => {
            try {
              // Fetch assignments for this supervisor from Django API
              const assignmentsResponse = await fetch(`${API_BASE_URL}/supervisor-assignments/?supervisor=${supervisor.id}`, {
                headers: {
                  'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                  'Content-Type': 'application/json',
                },
              });
              
              let assignments = [];
              if (assignmentsResponse.ok) {
                const assignmentsData = await assignmentsResponse.json();
                // Handle paginated response format
                assignments = assignmentsData.results || assignmentsData;
              }
              
              // Extract student details from assignments (already included in Django API response)
              const assignedStudents = assignments.map((assignment: any) => {
                const student = assignment.student_detail;
                return {
                  ...student,
                  assignment_id: assignment.id,
                  // Add user info to student for consistency
                  user: student.user
                };
              });

              return {
                ...supervisor,
                students_count: assignedStudents.length,
                assigned_students: assignedStudents
              };
            } catch (error) {
              console.error(`Error fetching assignments for supervisor ${supervisor.id}:`, error);
              return {
                ...supervisor,
                students_count: 0,
                assigned_students: []
              };
            }
          })
        );
        setSupervisors(supervisorsWithDetails);
      }

      // Fetch reimbursements using Django API
      try {
        const reimbursementsResponse = await fetch(`${API_BASE_URL}/reimbursements/`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (reimbursementsResponse.ok) {
          const reimbursementsData = await reimbursementsResponse.json();
          console.log("Reimbursements data:", reimbursementsData);
          setReimbursements(reimbursementsData?.results || reimbursementsData || []);
        } else {
          console.error("Error fetching reimbursements:", reimbursementsResponse.status);
        }
      } catch (error) {
        console.log("Continuing without reimbursements data", error);
      }
    } catch (error: any) {
      console.error("Dashboard data fetch error:", error);
      setError(error.message);
      toast({
        title: "Error",
        description: "Failed to load dashboard data: " + error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
    
    // Initialize automatic data integrity checker
    automaticDataIntegrityChecker.start();
    
    // Cleanup function to stop checker when component unmounts
    return () => {
      automaticDataIntegrityChecker.stop();
    };
  }, [currentUser, toast]);

  useEffect(() => {
    const saved = localStorage.getItem("introLetterTemplate");
    if (saved) setLetterTemplate(saved);
  }, []);

  const saveTemplate = () => {
    localStorage.setItem("introLetterTemplate", letterTemplate);
    toast({ title: "Template saved!" });
  };

  const generateCustomIntroLetter = (studentName: string, regNo: string, studentData?: any) => {
    // Create placeholders object
    const placeholders: Record<string, string> = {
      name: studentName,
      admno: regNo,
      registration_number: regNo,
      student_name: studentName,
      reg_no: regNo,
      date: new Date().toLocaleDateString('en-US', { 
        year: 'numeric', 
        month: 'long', 
        day: 'numeric' 
      })
    };

    // Add student-specific placeholders if data is available
    if (studentData) {
      // Year and program info
      const yearText = studentData.year_of_study === 1 ? '1st' : 
                      studentData.year_of_study === 2 ? '2nd' : 
                      studentData.year_of_study === 3 ? '3rd' : 
                      `${studentData.year_of_study}th`;
      
      const totalYears = studentData.program_type === 'diploma' ? 'two-year' : 'four-year';
      const degreeType = studentData.program_type === 'diploma' ? 'Diploma' : 'Degree';
      
      Object.assign(placeholders, {
        current_year: yearText,
        year: yearText,
        total_years: totalYears,
        degree_type: degreeType,
        program_name: studentData.program || 'Information Technology Program',
        program: studentData.program || 'Information Technology Program',
        course: studentData.program || 'Information Technology Program',
        faculty: studentData.faculty || 'Faculty of Science',
        department: studentData.department || 'Department of Computer and Information Science'
      });
    } else {
      // Default values when no student data is available
      Object.assign(placeholders, {
        current_year: '3rd',
        year: '3rd',
        total_years: 'four-year',
        degree_type: 'Degree',
        faculty: 'Faculty of Science',
        department: 'Department of Computer and Information Science',
        program_name: 'Information Technology Program',
        program: 'Information Technology Program',
        course: 'Information Technology Program'
      });
    }
    
    // Session/period placeholder (default to current period)
    const currentMonth = new Date().getMonth() + 1;
    const defaultSession = currentMonth >= 1 && currentMonth <= 4 ? 'January-April' :
                          currentMonth >= 5 && currentMonth <= 8 ? 'May-August' :
                          'September-December';
    placeholders.session = defaultSession;
    placeholders.attachment_period = defaultSession;
    
    return replacePlaceholders(letterTemplate, placeholders);
  };

  const handleApproveStudent = async (studentId: string) => {
    try {
      const student = students.find(s => s.id === studentId);
      const company = Array.isArray(student?.attachment?.company) ? student.attachment.company[0] : student?.attachment?.company;
      if (!company?.location) {
        throw new Error("Student has no company location");
      }
      // Fetch assigned supervisors
      const { data: assignments, error: assignmentsError } = await supabase
        .supervisor_assignments
        .select("supervisor_id")
        .eq("student_id", studentId);
      if (assignmentsError) throw assignmentsError;
      const supervisorIds = assignments.map(a => a.supervisor_id);
      // Calculate reimbursements
      const success = await calculateReimbursements(studentId, company.location, supervisorIds);
      if (!success) {
        throw new Error("Failed to calculate reimbursements");
      }
      // Update verification status
      const { error } = await supabase
        .from("verification_status")
        .upsert({
          student_id: studentId,
          is_verified: true,
          verification_date: new Date().toISOString(),
          verification_details: { status: "approved", reason: "Verified by admin" },
          fee_verified: student?.verification_status?.fee_verified ?? null,
          fee_verification_date: student?.verification_status?.fee_verification_date ?? null,
        });
      if (error) throw error;
      // Update local state
      setStudents(students.map(student => 
        student.id === studentId
          ? {
              ...student,
              verification_status: {
                id: student.verification_status?.id || crypto.randomUUID(),
                student_id: studentId,
                is_verified: true,
                verification_date: new Date().toISOString(),
                verification_details: { status: "approved", reason: "Verified by admin" },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                fee_verified: student?.verification_status?.fee_verified ?? null,
                fee_verification_date: student?.verification_status?.fee_verification_date ?? null,
              }
            } as Student
          : student
      ));
      toast({
        title: "Student Verified",
        description: `Student ${studentId} has been verified and reimbursements calculated.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to verify student: " + error.message,
        variant: "destructive",
      });
    }
  };

  // Add new function to handle communication with student
  const handleCommunicateWithStudent = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Here you would typically open a dialog to send a message
    // For now, we'll just show a toast
    toast({
      title: "Send Message",
      description: `Send a message to ${String(student.profile?.[0]?.first_name)} ${String(student.profile?.[0]?.last_name)}`,
    });
  };

  // Add new function to handle attachment details update
  const handleUpdateAttachmentDetails = async (studentId: string) => {
    const student = students.find(s => s.id === studentId);
    if (!student) return;

    // Here you would typically open a dialog to update attachment details
    // For now, we'll just show a toast
    toast({
      title: "Update Attachment",
      description: `Update attachment details for ${String(student.profile?.[0]?.first_name)} ${String(student.profile?.[0]?.last_name)}`,
    });
  };

  const handleRejectStudent = async (studentId: string) => {
    try {
      const { error } = await supabase
        .from("verification_status")
        .upsert({
          student_id: studentId,
          is_verified: false,
          verification_date: new Date().toISOString(),
          verification_details: { status: "rejected", reason: "Rejected by admin" }
        });

      if (error) throw error;

      // Update local state
      setStudents(students.map(student => 
        student.id === studentId
          ? {
              ...student,
              verification_status: {
                id: student.verification_status?.id || crypto.randomUUID(),
                student_id: studentId,
                is_verified: false,
                verification_date: new Date().toISOString(),
                verification_details: { status: "rejected", reason: "Rejected by admin" },
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
                fee_verified: student?.verification_status?.fee_verified ?? null,
                fee_verification_date: student?.verification_status?.fee_verification_date ?? null,
              }
            } as Student
          : student
      ));

      toast({
        title: "Student Rejected",
        description: `Student ${studentId} verification has been rejected.`,
        variant: "destructive",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to reject student: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleApproveReimbursement = async (reimbursementId: string) => {
    try {
      const { error } = await supabase
        .from("reimbursements")
        .update({ status: "approved" })
        .eq("id", reimbursementId);

      if (error) throw error;

      // Update local state
      setReimbursements(reimbursements.map(reimbursement =>
        reimbursement.id === reimbursementId
          ? { ...reimbursement, status: "approved" }
          : reimbursement
      ));

      toast({
        title: "Reimbursement Approved",
        description: `Reimbursement ${reimbursementId} has been approved.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to approve reimbursement: " + error.message,
        variant: "destructive",
      });
    }
  };

  const handleEditSupervisor = (supervisorId: string) => {
    const supervisor = supervisors.find(s => s.id === supervisorId);
    if (!supervisor) return;
    setSelectedSupervisor(supervisor);
    setShowEditSupervisorModal(true);
  };

  const handleViewSupervisor = (supervisorId: string) => {
    console.log("Viewing supervisor:", supervisorId);
    // TODO: Implement view supervisor functionality
  };

  // Function to open delete confirmation modal
  const openDeleteConfirmation = (type: 'student' | 'supervisor', id: string, name: string) => {
    // For supervisors, check if they have assigned students
    const supervisor = supervisors.find(s => s.id === id);
    const assignedStudentsCount = supervisor?.assigned_students?.length || 0;
    
    setDeleteModal({
      isOpen: true,
      type,
      id,
      name,
      isLoading: false,
      assignedStudentsCount
    });
  };

  // Function to handle confirmed deletion
  const handleConfirmDelete = async () => {
    if (!deleteModal.type || !deleteModal.id) return;

    setDeleteModal(prev => ({ ...prev, isLoading: true }));

    try {
      if (deleteModal.type === 'student') {
        // Get the user ID from the student record first
        const student = students.find(s => s.id === deleteModal.id);
        if (!student?.user?.id) {
          throw new Error('Student user ID not found');
        }
        
        // Delete the USER record (Django CASCADE will delete Student, Profile automatically)
        const deleteResponse = await supabase
          .from('users')
          .delete();
        
        const { error } = await deleteResponse.eq('id', student.user.id);

        if (error) throw error;

        // Refresh dashboard data to ensure consistency
        await fetchDashboardData();
        
        toast({
          title: "Student Deleted",
          description: "Student record and user account have been successfully deleted.",
        });
      } else if (deleteModal.type === 'supervisor') {
        // Get the user ID from the supervisor record first  
        const supervisor = supervisors.find(s => s.id === deleteModal.id);
        if (!supervisor?.user?.id) {
          throw new Error('Supervisor user ID not found');
        }
        
        // Delete the USER record (Django CASCADE will delete Supervisor, Profile automatically)
        const deleteResponse = await supabase
          .from('users')
          .delete();
        
        const { error } = await deleteResponse.eq('id', supervisor.user.id);

        if (error) throw error;

        // Refresh dashboard data to ensure consistency after cascade deletion
        await fetchDashboardData();
        
        toast({
          title: "Supervisor Deleted",
          description: `Supervisor and all associated data (${deleteModal.assignedStudentsCount || 0} assignments, evaluations, reimbursements) have been successfully deleted.`,
        });
      }

      // Close modal
      setDeleteModal({ isOpen: false, type: null, id: '', name: '', isLoading: false, assignedStudentsCount: 0 });
    } catch (error: any) {
      console.error('Error deleting record:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete record. Please try again.",
        variant: "destructive",
      });
      setDeleteModal(prev => ({ ...prev, isLoading: false }));
    }
  };

  // Function to close delete modal
  const closeDeleteModal = () => {
    if (!deleteModal.isLoading) {
      setDeleteModal({ isOpen: false, type: null, id: '', name: '', isLoading: false, assignedStudentsCount: 0 });
    }
  };

  // Get all supervisor names for the filter dropdown
  const allSupervisorNames = Array.from(new Set(supervisors.map(sup => getUserName(sup.user)))).filter(name => name !== '-');

  // Update filteredStudents to apply period, status, and search filters
  const filteredStudents = students.filter(student => {
    // Period filter - use actual period if available, fall back to planned period
    const displayedPeriod = student.attachments?.[0]?.attachment_period || student.attachment_period;
    const matchesPeriod = attachmentPeriodFilter === '' || attachmentPeriodFilter === 'all' || (displayedPeriod === attachmentPeriodFilter);
    
    // Status filter
    const isVerified = student.verification_status?.is_verified === true && student.verification_status?.fee_verified === true;
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'verified' && isVerified) || 
      (statusFilter === 'pending' && !isVerified);
    
    // Search term filter
    const studentName = getUserName(student.user);
    const matchesSearch = studentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (student.student_id && student.student_id.toLowerCase().includes(searchTerm.toLowerCase()));
    
    return matchesPeriod && matchesStatus && matchesSearch;
  });
  const filteredSupervisors = supervisors.filter(supervisor =>
    getUserName(supervisor.user).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (supervisor.id && supervisor.id.toLowerCase().includes(searchTerm.toLowerCase()))
  );
  const filteredReimbursements = reimbursements.filter(r => {
    const supervisorProfileArr = r.supervisor?.profile as any[];
    const supervisorName = Array.isArray(supervisorProfileArr) && supervisorProfileArr.length > 0 && supervisorProfileArr[0] != null
      ? `${(supervisorProfileArr[0] as any).first_name || ''} ${(supervisorProfileArr[0] as any).last_name || ''}`.trim() || '-'
      : (r.supervisor?.profile && !Array.isArray(r.supervisor.profile) && typeof r.supervisor.profile === 'object' && 'first_name' in r.supervisor.profile ? `${(r.supervisor.profile as any).first_name} ${(r.supervisor.profile as any).last_name}`.trim() : '-');
    const studentProfileArr = r.student?.profile as any[];
    const studentName = Array.isArray(studentProfileArr) && studentProfileArr.length > 0 && studentProfileArr[0] != null
      ? `${(studentProfileArr[0] as any).first_name || ''} ${(studentProfileArr[0] as any).last_name || ''}`.trim() || '-'
      : (r.student?.profile && !Array.isArray(r.student.profile) && typeof r.student.profile === 'object' && 'first_name' in r.student.profile ? `${(r.student.profile as any).first_name} ${(r.student.profile as any).last_name}`.trim() : '-');
    const companyArr = r.company as any[];
    const companyName = Array.isArray(companyArr) && companyArr.length > 0 && companyArr[0] != null
      ? (companyArr[0] as any).name || '-' : (r.company && !Array.isArray(r.company) && typeof r.company === 'object' && 'name' in r.company ? (r.company as any).name : '-');
    return (
      (typeof studentName === 'string' && studentName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (typeof supervisorName === 'string' && supervisorName.toLowerCase().includes(searchTerm.toLowerCase())) ||
      (typeof companyName === 'string' && companyName.toLowerCase().includes(searchTerm.toLowerCase()))
    );
  });

  // Update filteredSupervisorsForAssigned to apply search filter only
  const filteredSupervisorsForAssigned = supervisors.filter(sup => {
    const name = getUserName(sup.user);
    const matchesSearch = supervisorSearch === '' || name.toLowerCase().includes(supervisorSearch.toLowerCase());
    return matchesSearch;
  });


  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading dashboard...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-500 mb-4">Error loading dashboard: {error}</p>
          <Button onClick={() => window.location.reload()}>Retry</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar title="Admin Dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Students</p>
                  <p className="text-2xl font-bold">{students.length}</p>
                </div>
                <div className="p-2 bg-primary/10 rounded-full">
                  <Users className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Verified Students</p>
                  <p className="text-2xl font-bold">
                    {students.filter(s =>
                      s.verification_status?.is_verified === true &&
                      s.verification_status?.fee_verified === true
                    ).length}
                  </p>
                </div>
                <div className="p-2 bg-green-100 rounded-full">
                  <ClipboardCheck className="h-6 w-6 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Active Supervisors</p>
                  <p className="text-2xl font-bold">{supervisors.length}</p>
                </div>
                <div className="p-2 bg-blue-100 rounded-full">
                  <UserCheck className="h-6 w-6 text-blue-600" />
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="pt-6">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm font-medium text-muted-foreground">Total Reimbursements</p>
                  <p className="text-2xl font-bold">
                    Ksh {reimbursements.reduce((acc, curr) => {
                      const studentFee = 1000;
                      const calculatedAmount = (globalRate * (parseFloat(curr.distance) || 0)) + globalLunch + studentFee;
                      return acc + calculatedAmount;
                    }, 0).toLocaleString()}
                  </p>
                </div>
                <div className="p-2 bg-purple-100 rounded-full">
                  <DollarSign className="h-6 w-6 text-purple-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Tabs */}
        <Tabs defaultValue="students" className="w-full" onValueChange={setSelectedTab}>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6">
            <TabsList className="mb-4 sm:mb-0">
              <TabsTrigger value="students">Students</TabsTrigger>
              <TabsTrigger value="supervisors">Supervisors</TabsTrigger>
              <TabsTrigger value="reimbursements">Reimbursements</TabsTrigger>
              <TabsTrigger value="statistics">Statistics</TabsTrigger>
              <TabsTrigger value="settings">Settings</TabsTrigger>
            </TabsList>
            
            <div className="w-full sm:w-auto flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <Input 
                placeholder={
                  selectedTab === 'students' ? 'Search students...' :
                  selectedTab === 'supervisors' ? 'Search supervisors...' :
                  selectedTab === 'reimbursements' ? 'Search reimbursements...' :
                  selectedTab === 'statistics' ? 'Search statistics...' :
                  selectedTab === 'settings' ? 'Search settings...' :
                  'Search...'
                }
                className="w-full sm:w-64"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          
          {/* Students Tab */}
          <TabsContent value="students">
            <Card className="mb-8">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <Users className="mr-2 h-5 w-5" />
                      Students Management
                    </CardTitle>
                    <CardDescription>
                      Manage student verifications and attachment details
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Select value={attachmentPeriodFilter} onValueChange={setAttachmentPeriodFilter}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Attachment Period" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Periods</SelectItem>
                        <SelectItem value="Jan-Apr">Jan - Apr</SelectItem>
                        <SelectItem value="May-Aug">May - Aug</SelectItem>
                        <SelectItem value="Sep-Dec">Sep - Dec</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button variant="outline" onClick={() => setShowAddStudentModal(true)}>Add Student</Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Table className="rounded shadow border">
                  <TableHeader className="bg-gray-50 font-semibold">
                    <TableRow>
                      <TableHead className="px-4 py-2">ID</TableHead>
                      <TableHead className="px-4 py-2">Name</TableHead>
                      <TableHead className="px-4 py-2">Program</TableHead>
                      <TableHead className="px-4 py-2">Year</TableHead>
                      <TableHead className="px-4 py-2">Status</TableHead>
                      <TableHead className="px-4 py-2">Final Grade</TableHead>
                      <TableHead className="px-4 py-2">Attachment Period</TableHead>
                      <TableHead className="px-4 py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="px-4 py-2">{student.student_id || "-"}</TableCell>
                        <TableCell className="px-4 py-2">{getUserName(student.user)}</TableCell>
                        <TableCell className="px-4 py-2">{student.program || "-"}</TableCell>
                        <TableCell className="px-4 py-2">{student.year_of_study || "-"}</TableCell>
                        <TableCell className="px-4 py-2">
                          <Badge variant={
                            student.verification_status?.is_verified === true && student.verification_status?.fee_verified === true
                              ? "default"
                              : "outline"
                          }>
                            {student.verification_status?.is_verified === true && student.verification_status?.fee_verified === true
                              ? "Eligible"
                              : "Not Eligible"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {student.final_grade ? (
                            <Badge variant="secondary" className="font-mono">
                              {student.final_grade}/100
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground text-sm">Not graded</span>
                          )}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          {student.attachments?.[0]?.attachment_period || student.attachment_period || "-"}
                        </TableCell>
                        <TableCell className="px-4 py-2">
                          <div className="flex gap-2">
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => { setSelectedStudent(student); setShowUpdateModal(true); }}
                            >
                              Update Details
                            </Button>
                            <Button 
                              variant="outline" 
                              size="sm"
                              onClick={() => { setSelectedStudent(student); setShowMessageModal(true); }}
                            >
                              Message
                            </Button>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => { setSelectedStudent(student); setShowViewModal(true); }}
                            >
                              View
                            </Button>
                            <Button 
                              variant="destructive" 
                              size="sm"
                              onClick={() => openDeleteConfirmation('student', student.id, getUserName(student.user))}
                            >
                              Delete
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Supervisors Tab */}
          <TabsContent value="supervisors">
            <Card className="mb-8">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <UserCheck className="mr-2 h-5 w-5" />
                      Supervisors Management
                    </CardTitle>
                    <CardDescription>
                      Manage supervisors and their student assignments
                    </CardDescription>
                  </div>
                  <Button onClick={() => setShowAddSupervisorModal(true)}>Add Supervisor</Button>
                </div>
              </CardHeader>
              <CardContent>
                <div>
                  <Button
                    variant={showSupervisors ? "secondary" : "outline"}
                    className="mb-4"
                    onClick={() => setShowSupervisors(s => !s)}
                  >
                    {showSupervisors ? "Hide Supervisors" : "Show Supervisors"}
                  </Button>
                  {showSupervisors && (
                    <Table className="rounded shadow border">
                      <TableHeader className="bg-gray-50 font-semibold">
                        <TableRow>
                          <TableHead className="px-4 py-2">Supervisor</TableHead>
                          <TableHead className="px-4 py-2">Department</TableHead>
                          <TableHead className="px-4 py-2">Assigned Students</TableHead>
                          <TableHead className="px-4 py-2">Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSupervisors.map(sup => (
                          <TableRow key={sup.id}>
                            <TableCell className="px-4 py-2">{getUserName(sup.user)}</TableCell>
                            <TableCell className="px-4 py-2">{sup.department || "-"}</TableCell>
                            <TableCell className="px-4 py-2">{sup.assigned_students?.length || 0}</TableCell>
                            <TableCell className="px-4 py-2">
                              <div className="flex gap-2">
                                <Button 
                                  variant="outline" 
                                  size="sm"
                                  onClick={() => handleEditSupervisor(sup.id)}
                                >
                                  Edit
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleViewSupervisor(sup.id)}
                                >
                                  View
                                </Button>
                                <Button 
                                  variant="destructive" 
                                  size="sm"
                                  onClick={() => openDeleteConfirmation('supervisor', sup.id, getUserName(sup.user))}
                                >
                                  Delete
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  )}
                </div>
                <div>
                  <Button
                    variant={showAssigned ? "secondary" : "outline"}
                    className="mb-4"
                    onClick={() => setShowAssigned(s => !s)}
                  >
                    {showAssigned ? "Hide Supervisors & Assigned Students" : "Show Supervisors & Assigned Students"}
                  </Button>
                  {showAssigned && (
                    <Card className="mb-6">
                      <CardHeader>
                        <CardTitle>Supervisors & Assigned Students</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="flex gap-4 mb-4">
                          <Input
                            className="w-64"
                            placeholder="Search supervisor..."
                            value={supervisorSearch}
                            onChange={e => setSupervisorSearch(e.target.value)}
                          />
                          <Select value={periodFilter} onValueChange={setPeriodFilter}>
                            <SelectTrigger className="w-40"><SelectValue placeholder="Attachment Period" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Periods</SelectItem>
                              <SelectItem value="Jan-Apr">Jan - Apr</SelectItem>
                              <SelectItem value="May-Aug">May - Aug</SelectItem>
                              <SelectItem value="Sep-Dec">Sep - Dec</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Table className="rounded shadow border">
                          <TableHeader className="bg-gray-50 font-semibold">
                            <TableRow>
                              <TableHead className="px-4 py-2">Supervisor</TableHead>
                              <TableHead className="px-4 py-2">Department</TableHead>
                              <TableHead className="px-4 py-2">Student</TableHead>
                              <TableHead className="px-4 py-2">Student ID</TableHead>
                              <TableHead className="px-4 py-2">Program</TableHead>
                              <TableHead className="px-4 py-2">Year</TableHead>
                              <TableHead className="px-4 py-2">Phone Number</TableHead>
                              <TableHead className="px-4 py-2">Attachment Period</TableHead>
                              <TableHead className="px-4 py-2">Company</TableHead>
                              <TableHead className="px-4 py-2">Company Location</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSupervisorsForAssigned.flatMap(sup => {
                              // Deduplicate assignments by assignment_id
                              const uniqueStudents = (sup.assigned_students || []).reduce((acc: any[], stu: any) => {
                                if (!acc.find(existing => existing.assignment_id === stu.assignment_id)) {
                                  acc.push(stu);
                                }
                                return acc;
                              }, []);

                              return uniqueStudents
                                .filter(stu => {
                                  const displayedPeriod = stu.attachments?.[0]?.attachment_period || stu.attachment_period;
                                  return periodFilter === 'all' || displayedPeriod === periodFilter;
                                })
                                .map(stu => {
                                  const studentName = getUserName(stu.user);
                                  const phoneNumber = stu.phone_number || stu.user?.phone_number || 'N/A';
                                  const attachmentPeriod = stu.attachments?.[0]?.attachment_period || stu.attachment_period || '-';
                                  const companyName = getCompanyName(stu);
                                  const companyLocation = getCompanyLocation(stu);
                                  
                                  return (
                                    <TableRow key={stu.assignment_id || `${sup.id}-${stu.id}-${stu.student_id}`}>
                                      <TableCell className="px-4 py-2">{getUserName(sup.user)}</TableCell>
                                      <TableCell className="px-4 py-2">{sup.department || "-"}</TableCell>
                                      <TableCell className="px-4 py-2">{studentName}</TableCell>
                                      <TableCell className="px-4 py-2">{stu.student_id || "-"}</TableCell>
                                      <TableCell className="px-4 py-2">{stu.program || "-"}</TableCell>
                                      <TableCell className="px-4 py-2">{stu.year_of_study || "-"}</TableCell>
                                      <TableCell className="px-4 py-2">{phoneNumber}</TableCell>
                                      <TableCell className="px-4 py-2">{attachmentPeriod}</TableCell>
                                      <TableCell className="px-4 py-2">{companyName}</TableCell>
                                      <TableCell className="px-4 py-2">{companyLocation}</TableCell>
                                    </TableRow>
                                  );
                                });
                            })}
                          </TableBody>
                        </Table>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
          
          {/* Reimbursements Tab */}
          <TabsContent value="reimbursements">
            <Card className="mb-8">
              <CardHeader>
                <div className="flex justify-between items-center">
                  <div>
                    <CardTitle className="flex items-center">
                      <DollarSign className="mr-2 h-5 w-5" />
                      Reimbursements
                    </CardTitle>
                    <CardDescription>
                      Manage student reimbursements for attachment expenses
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <Label htmlFor="globalRate">Rate per km:</Label>
                      <Input
                        id="globalRate"
                        type="number"
                        value={globalRate}
                        onChange={(e) => {
                          const newRate = Number(e.target.value);
                          setGlobalRate(newRate);
                          localStorage.setItem('globalRate', newRate.toString());
                        }}
                        className="w-24"
                        placeholder="e.g. 20"
                        title="Set the reimbursement rate per kilometer"
                      />
                      <span>KSH</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label htmlFor="globalLunch">Lunch:</Label>
                      <Input
                        id="globalLunch"
                        type="number"
                        value={globalLunch}
                        onChange={(e) => {
                          const newLunch = Number(e.target.value);
                          setGlobalLunch(newLunch);
                          localStorage.setItem('globalLunch', newLunch.toString());
                        }}
                        className="w-24"
                        placeholder="e.g. 200"
                        title="Set the daily lunch reimbursement"
                      />
                      <span>KSH</span>
                    </div>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={() => exportReimbursements()}>Export Reimbursements</Button>
                <Button onClick={async () => {
                  try {
                    // Fetch all reimbursements using Django API
                    const response = await fetch(`${API_BASE_URL}/reimbursements/`, {
                      headers: {
                        'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                        'Content-Type': 'application/json',
                      },
                    });
                    
                    if (!response.ok) throw new Error('Failed to fetch reimbursements');
                    const allReimbs = await response.json();
                    const reimbursementsList = allReimbs.results || allReimbs;
                    
                    // Update each reimbursement with new rates using correct formula
                    for (const r of reimbursementsList) {
                      const studentFee = 1000; // KSH 1000 per student for supervisors
                      const newAmount = (globalRate * r.distance) + globalLunch + studentFee;
                      
                      const updateResponse = await fetch(`${API_BASE_URL}/reimbursements/${r.id}/`, {
                        method: 'PATCH',
                        headers: {
                          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                          amount: newAmount,
                          rate: globalRate,
                          lunch: globalLunch
                        }),
                      });
                      
                      if (!updateResponse.ok) throw new Error(`Failed to update reimbursement ${r.id}`);
                    }
                    
                    // Refresh the reimbursements data
                    fetchDashboardData();
                    toast({ title: 'Reimbursements updated with new rates!' });
                  } catch (err) {
                    toast({ title: 'Error updating reimbursements', description: err.message, variant: 'destructive' });
                    console.error('Update reimbursements error:', err);
                  }
                }} className="ml-4">Update All Reimbursements</Button>
                {filteredReimbursements.length === 0 ? (
                  <div className="text-center py-8">
                    <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900">No Reimbursements</h3>
                    <p className="mt-1 text-sm text-gray-500">
                      There are no reimbursement requests at this time.
                    </p>
                  </div>
                ) : (
                  <Table className="rounded shadow border">
                    <TableHeader className="bg-gray-50 font-semibold">
                      <TableRow>
                        <TableHead className="px-4 py-2">Supervisor</TableHead>
                        <TableHead className="px-4 py-2">Student</TableHead>
                        <TableHead className="px-4 py-2">Company</TableHead>
                        <TableHead className="px-4 py-2">Supervision Visits</TableHead>
                        <TableHead className="px-4 py-2">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReimbursements.map((r, idx) => {
                        // Django API format: nested objects with user data
                        const supervisorName = r.supervisor?.user 
                          ? `${r.supervisor.user.first_name || ''} ${r.supervisor.user.last_name || ''}`.trim() || '-'
                          : '-';
                        const studentName = r.student?.user
                          ? `${r.student.user.first_name || ''} ${r.student.user.last_name || ''}`.trim() || '-'
                          : '-';
                        const companyName = r.company?.name || '-';
                        
                        // Calculate amount in real-time using current admin rates
                        const studentFee = 1000; // KSH 1000 per student for supervisors
                        const displayAmount = (globalRate * (parseFloat(r.distance) || 0)) + globalLunch + studentFee;
                        const supervisionVisits = r.supervision_visits || 1;
                        console.log('Reimbursement Debug:', {
                          r,
                          supervisor: r.supervisor,
                          student: r.student,
                          company: r.company
                        });
                        return (
                          <TableRow key={r.id || idx}>
                            <TableCell className="px-4 py-2">{supervisorName}</TableCell>
                            <TableCell className="px-4 py-2">{studentName}</TableCell>
                            <TableCell className="px-4 py-2">{companyName}</TableCell>
                            <TableCell className="px-4 py-2">{supervisionVisits}</TableCell>
                            <TableCell className="px-4 py-2">KSH {displayAmount != null ? displayAmount.toLocaleString() : '-'}</TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          

          {/* Statistics Tab */}
          <TabsContent value="statistics">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center">
                      <LucideBarChart className="mr-2 h-5 w-5" />
                      System Statistics
                    </CardTitle>
                    <CardDescription>
                      Overview of system usage and performance metrics
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div>
                  <h3 className="font-semibold mb-2">Students per Program</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ReBarChart data={Object.entries(students.reduce((acc, s) => { 
                      const program = s.program || 'Unknown';
                      acc[program] = (acc[program] || 0) + 1; 
                      return acc; 
                    }, {} as Record<string, number>)).map(([program, count]) => ({ program: String(program), count: Number(count) }))}>
                      <XAxis dataKey="program" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8884d8" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Student Eligibility Status</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Eligible", value: students.filter(s => s.verification_status?.is_verified && s.verification_status?.fee_verified).length },
                          { name: "Not Eligible", value: students.length - students.filter(s => s.verification_status?.is_verified && s.verification_status?.fee_verified).length }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#82ca9d"
                        label
                      >
                        <Cell fill="#4ade80" />
                        <Cell fill="#f87171" />
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Supervisors per Department</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ReBarChart data={Object.entries(supervisors.reduce((acc, s) => { 
                      const department = s.department || 'Unknown';
                      acc[department] = (acc[department] || 0) + 1; 
                      return acc; 
                    }, {} as Record<string, number>)).map(([department, count]) => ({ department: String(department), count: Number(count) }))}>
                      <XAxis dataKey="department" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#60a5fa" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Reimbursements by Status</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={[
                          { name: "Approved", value: reimbursements.filter(r => r.status === 'approved').length },
                          { name: "Pending", value: reimbursements.filter(r => r.status === 'pending').length }
                        ]}
                        dataKey="value"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        label
                      >
                        <Cell fill="#60a5fa" />
                        <Cell fill="#fbbf24" />
                      </Pie>
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Students per Attachment Period</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ReBarChart data={Object.entries(students.reduce((acc, s) => { 
                      const period = s.attachments?.[0]?.attachment_period || s.attachment_period || 'None'; 
                      acc[period] = (acc[period] || 0) + 1; 
                      return acc; 
                    }, {} as Record<string, number>)).map(([period, count]) => ({ period: String(period), count: Number(count) }))}>
                      <XAxis dataKey="period" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f87171" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
                
                {/* Enhanced Statistics */}
                <div>
                  <h3 className="font-semibold mb-2">Students per Department</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ReBarChart data={Object.entries(students.reduce((acc, s) => { 
                      const department = s.department || s.program || 'Unknown'; 
                      acc[department] = (acc[department] || 0) + 1; 
                      return acc; 
                    }, {} as Record<string, number>)).map(([department, count]) => ({ department: String(department), count: Number(count) }))}>
                      <XAxis dataKey="department" angle={-45} textAnchor="end" height={80} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#8b5cf6" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Students per Year of Study</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ReBarChart data={Object.entries(students.reduce((acc, s) => { 
                      const year = `Year ${s.year_of_study || 'Unknown'}`; 
                      acc[year] = (acc[year] || 0) + 1; 
                      return acc; 
                    }, {} as Record<string, number>)).map(([year, count]) => ({ year: String(year), count: Number(count) }))}>
                      <XAxis dataKey="year" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#10b981" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Supervisor Workload Distribution</h3>
                  <ResponsiveContainer width="100%" height={250}>
                    <ReBarChart data={supervisors.map(sup => ({
                      supervisor: getUserName(sup.user),
                      students: sup.students_count || 0
                    }))}>
                      <XAxis dataKey="supervisor" angle={-45} textAnchor="end" height={80} />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="students" fill="#f59e0b" />
                    </ReBarChart>
                  </ResponsiveContainer>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">Total Reimbursement Amount</h3>
                  <div className="text-center p-8">
                    <div className="text-4xl font-bold text-green-600">
                      KSH {reimbursements.reduce((total, r) => {
                        const studentFee = 1000;
                        const supervisionVisits = r.supervision_visits || 1;
                        const amount = (globalRate * ((r.distance || 0) * 2)) + studentFee + (globalLunch * supervisionVisits);
                        return total + amount;
                      }, 0).toLocaleString()}
                    </div>
                    <div className="text-lg text-gray-600 mt-2">
                      Total Financial Impact
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-4 text-sm">
                      <div className="bg-blue-50 p-3 rounded">
                        <div className="font-semibold text-blue-800">Approved</div>
                        <div className="text-blue-600">
                          KSH {reimbursements.filter(r => r.status === 'approved').reduce((total, r) => {
                            const studentFee = 1000;
                            const supervisionVisits = r.supervision_visits || 1;
                            const amount = (globalRate * ((r.distance || 0) * 2)) + studentFee + (globalLunch * supervisionVisits);
                            return total + amount;
                          }, 0).toLocaleString()}
                        </div>
                      </div>
                      <div className="bg-yellow-50 p-3 rounded">
                        <div className="font-semibold text-yellow-800">Pending</div>
                        <div className="text-yellow-600">
                          KSH {reimbursements.filter(r => r.status === 'pending').reduce((total, r) => {
                            const studentFee = 1000;
                            const supervisionVisits = r.supervision_visits || 1;
                            const amount = (globalRate * ((r.distance || 0) * 2)) + studentFee + (globalLunch * supervisionVisits);
                            return total + amount;
                          }, 0).toLocaleString()}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div>
                  <h3 className="font-semibold mb-2">System Health Overview</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-green-50 p-4 rounded">
                      <div className="text-2xl font-bold text-green-600">{students.filter(s => s.verification_status?.is_verified && s.verification_status?.fee_verified).length}</div>
                      <div className="text-green-800">Verified Students</div>
                      <div className="text-sm text-green-600">Ready for Attachment</div>
                    </div>
                    <div className="bg-orange-50 p-4 rounded">
                      <div className="text-2xl font-bold text-orange-600">{students.filter(s => !s.verification_status?.is_verified || !s.verification_status?.fee_verified).length}</div>
                      <div className="text-orange-800">Pending Verification</div>
                      <div className="text-sm text-orange-600">Awaiting Review</div>
                    </div>
                    <div className="bg-blue-50 p-4 rounded">
                      <div className="text-2xl font-bold text-blue-600">{supervisors.reduce((total, sup) => total + (sup.students_count || 0), 0)}</div>
                      <div className="text-blue-800">Total Assignments</div>
                      <div className="text-sm text-blue-600">Student-Supervisor Pairs</div>
                    </div>
                    <div className="bg-purple-50 p-4 rounded">
                      <div className="text-2xl font-bold text-purple-600">{supervisors.filter(sup => (sup.students_count || 0) >= 15).length}</div>
                      <div className="text-purple-800">High Workload</div>
                      <div className="text-sm text-purple-600">Supervisors with 15+ Students</div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings">
            <ProfileSettings role="admin" />
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Introductory Letter Template</CardTitle>
                <CardDescription>
                  Customize the introductory letter. Use <code>{`{{name}}`}</code> for the student's name and <code>{`{{admno}}`}</code> for their admission number.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {/* File Upload Section */}
                  <div>
                    <h4 className="font-semibold mb-2">Upload Template File</h4>
                    <p className="text-sm text-gray-600 mb-3">
                      Upload a Word document (.docx) or text file (.txt) to use as a template. 
                      Use <code>{`{{name}}`}</code> for student name and <code>{`{{admno}}`}</code> for admission number.
                    </p>
                    <input
                      type="file"
                      accept=".docx,.txt,.doc"
                      onChange={async (e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setUploadedLetterFile(file);
                          try {
                            const result = await processTemplateFile(file);
                            if (result.success) {
                              setLetterFileContent(result.content);
                              // Use full template with headers and footers if available, otherwise use HTML content
                              setLetterTemplate(result.fullTemplate || result.htmlContent || result.content);
                              toast({ 
                                title: "File uploaded!", 
                                description: `Template loaded from ${file.name}${result.header ? ' (with header)' : ''}${result.footer ? ' (with footer)' : ''}. ${result.error ? `Note: ${result.error}` : ''}`
                              });
                            } else {
                              toast({ 
                                title: "Upload failed", 
                                description: result.error || "Could not read file content.", 
                                variant: "destructive" 
                              });
                            }
                          } catch (error) {
                            toast({ 
                              title: "Error", 
                              description: "Unexpected error processing file.", 
                              variant: "destructive" 
                            });
                          }
                        }
                      }}
                      className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
                    />
                    {uploadedLetterFile && (
                      <p className="text-sm text-green-600 mt-2">
                        Uploaded: {uploadedLetterFile.name}
                      </p>
                    )}
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-semibold mb-2">Edit Template</h4>
                    <ReactQuill
                      theme="snow"
                      value={letterTemplate}
                      onChange={setLetterTemplate}
                      className="mb-2"
                      style={{ background: 'white' }}
                    />
                    <div className="flex gap-2 mt-2">
                      <Button onClick={saveTemplate}>Save Template</Button>
                      <Button variant="outline" onClick={() => setLetterTemplate("")}>Reset</Button>
                      {letterFileContent && (
                        <Button 
                          variant="outline" 
                          onClick={() => {
                            setLetterTemplate(letterFileContent);
                            toast({ title: "Template restored from uploaded file" });
                          }}
                        >
                          Restore from File
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-semibold mb-2">Preview</h4>
                    <p className="text-sm text-gray-600 mb-2">
                      This is how the letter will look for student "John Doe" with admission number "1056980":
                    </p>
                    <div className="bg-gray-100 p-4 rounded text-sm whitespace-pre-wrap border" dangerouslySetInnerHTML={{ 
                      __html: generateCustomIntroLetter("John Doe", "1056980", {
                        year_of_study: 2,
                        program_type: 'diploma',
                        faculty: 'Faculty of Science',
                        department: 'Department of Computer and Information Science',
                        program: 'Diploma in Information Technology'
                      })
                    }} />
                  </div>

                  <div className="border-t pt-6">
                    <h4 className="font-semibold mb-2">Available Placeholders</h4>
                    <div className="bg-blue-50 p-3 rounded">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h5 className="font-medium text-sm mb-2">Student Information:</h5>
                          <ul className="text-xs space-y-1">
                            <li><code>{`{{name}}`}</code> - Student's full name</li>
                            <li><code>{`{{admno}}`}</code> - Student's admission number</li>
                            <li><code>{`{{registration_number}}`}</code> - Same as admno</li>
                            <li><code>{`{{current_year}}`}</code> - Year of study (1st, 2nd, 3rd, etc.)</li>
                          </ul>
                        </div>
                        <div>
                          <h5 className="font-medium text-sm mb-2">Program Information:</h5>
                          <ul className="text-xs space-y-1">
                            <li><code>{`{{program_name}}`}</code> - Program name</li>
                            <li><code>{`{{degree_type}}`}</code> - Diploma or Degree</li>
                            <li><code>{`{{total_years}}`}</code> - Program duration</li>
                            <li><code>{`{{faculty}}`}</code> - Faculty name</li>
                            <li><code>{`{{department}}`}</code> - Department name</li>
                          </ul>
                        </div>
                      </div>
                      <div className="mt-3 pt-3 border-t border-blue-200">
                        <h5 className="font-medium text-sm mb-2">System Generated:</h5>
                        <ul className="text-xs space-y-1">
                          <li><code>{`{{date}}`}</code> - Current date (auto-generated)</li>
                          <li><code>{`{{session}}`}</code> - Current academic session (auto-calculated)</li>
                        </ul>
                      </div>
                      <p className="text-xs text-blue-600 mt-3">
                        All placeholders are automatically filled when students download their letters.
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Modals */}
        <Dialog open={showUpdateModal} onOpenChange={setShowUpdateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Update Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as typeof e.target & {
                    firstName: { value: string };
                    lastName: { value: string };
                    program: { value: string };
                    year: { value: string };
                  };
                  const updatedProfile = {
                    first_name: form.firstName.value,
                    last_name: form.lastName.value,
                  };
                  const updatedStudent = {
                    program: form.program.value,
                    year_of_study: form.year.value,
                  };
                  // Update profile
                  const profileId = selectedStudent.profile?.[0]?.id;
                  if (profileId) {
                    await supabase
                      .from("profiles")
                      .update(updatedProfile)
                      .eq("id", profileId);
                  }
                  // Update student
                  await supabase
                    .from("students")
                    .update(updatedStudent)
                    .eq("id", selectedStudent.id);
                  // Update local state
                  setStudents((prev) =>
                    prev.map((s) =>
                      s.id === selectedStudent.id
                        ? {
                            ...s,
                            ...updatedStudent,
                            profile: [{ ...s.profile?.[0], ...updatedProfile }],
                          }
                        : s
                    )
                  );
                  toast({ title: "Student updated!" });
                  setShowUpdateModal(false);
                }}
                className="space-y-4"
              >
                <div>
                  <Label>First Name</Label>
                  <Input name="firstName" defaultValue={String(getProfileName(selectedStudent.profile ?? []) || "-")} required />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input name="lastName" defaultValue={String(getProfileName(selectedStudent.profile ?? []) || "-")} required />
                </div>
                <div>
                  <Label>Program</Label>
                  <Input name="program" defaultValue={String(selectedStudent.program || "-")} required />
                </div>
                <div>
                  <Label>Year of Study</Label>
                  <Input name="year" defaultValue={String(selectedStudent.year_of_study || "-")} required />
                </div>
                <Button type="submit">Save</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={showMessageModal} onOpenChange={setShowMessageModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Send Message</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!messageContent.trim()) return;
                  setMessageSending(true);
                  try {
                    await supabase.from("messages").insert({
                      sender_id: currentUser.id,
                      receiver_id: selectedStudent.user.id,
                      content: messageContent.trim(),
                    });
                    setMessageContent("");
                    setShowMessageModal(false);
                    toast({ title: "Message sent!" });
                  } catch (err: any) {
                    toast({ title: "Error sending message", description: err.message, variant: "destructive" });
                  } finally {
                    setMessageSending(false);
                  }
                }}
                className="space-y-4"
              >
                <Label>To: {getUserName(selectedStudent.user)}</Label>
                <textarea
                  ref={messageInputRef}
                  className="w-full border rounded p-2"
                  rows={5}
                  placeholder="Type your message..."
                  value={messageContent}
                  onChange={e => setMessageContent(e.target.value)}
                  required
                />
                <Button type="submit" disabled={messageSending}>{messageSending ? "Sending..." : "Send"}</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
        <Dialog open={showViewModal} onOpenChange={setShowViewModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Student Details</DialogTitle>
            </DialogHeader>
            {selectedStudent && (
              <div className="space-y-2">
                <div><b>Name:</b> {getUserName(selectedStudent.user)}</div>
                <div><b>Student ID:</b> {selectedStudent.student_id || "-"}</div>
                <div><b>Program:</b> {selectedStudent.program || "-"}</div>
                <div><b>Year of Study:</b> {selectedStudent.year_of_study || "-"}</div>
                <div><b>Email:</b> {selectedStudent.user?.email || "-"}</div>
                <div><b>Phone:</b> {selectedStudent.phone_number || selectedStudent.user?.phone_number || "N/A"}</div>
                <div><b>Company:</b> {getCompanyName(selectedStudent)}</div>
                <div><b>Company Location:</b> {getCompanyLocation(selectedStudent)}</div>
                <div><b>Status:</b> {selectedStudent.verification_status?.is_verified ? "Verified" : selectedStudent.verification_status ? "Rejected" : "Pending"}</div>
              </div>
            )}
            <Button onClick={() => setShowViewModal(false)}>Close</Button>
          </DialogContent>
        </Dialog>
        {/* Supervisor Edit Modal */}
        <Dialog open={showEditSupervisorModal} onOpenChange={setShowEditSupervisorModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Supervisor Details</DialogTitle>
            </DialogHeader>
            {selectedSupervisor && (
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const form = e.target as typeof e.target & {
                    firstName: { value: string };
                    lastName: { value: string };
                    department: { value: string };
                    title: { value: string };
                    email: { value: string };
                  };
                  const updatedProfile = {
                    first_name: form.firstName.value,
                    last_name: form.lastName.value,
                    email: form.email.value,
                  };
                  const updatedSupervisor = {
                    department: form.department.value,
                    title: form.title.value,
                  };
                  // Update profile
                  const profileId = selectedSupervisor.profile?.[0]?.id;
                  if (profileId) {
                    await supabase
                      .from("profiles")
                      .update(updatedProfile)
                      .eq("id", profileId);
                  }
                  // Update supervisor
                  await supabase
                    .from("supervisors")
                    .update(updatedSupervisor)
                    .eq("id", selectedSupervisor.id);
                  // Update local state
                  setSupervisors((prev) =>
                    prev.map((s) =>
                      s.id === selectedSupervisor.id
                        ? {
                            ...s,
                            ...updatedSupervisor,
                            profile: [{ ...s.profile?.[0], ...updatedProfile }],
                          }
                        : s
                    )
                  );
                  toast({ title: "Supervisor updated!" });
                  setShowEditSupervisorModal(false);
                }}
                className="space-y-4"
              >
                <div>
                  <Label>First Name</Label>
                  <Input name="firstName" defaultValue={String(getProfileName(selectedSupervisor.profile ?? []) || "-")} required />
                </div>
                <div>
                  <Label>Last Name</Label>
                  <Input name="lastName" defaultValue={String(getProfileName(selectedSupervisor.profile ?? []) || "-")} required />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input name="email" type="email" defaultValue={selectedSupervisor.profile?.[0]?.email || ""} required />
                </div>
                <div>
                  <Label>Department</Label>
                  <Input name="department" defaultValue={selectedSupervisor.department || ""} required />
                </div>
                <div>
                  <Label>Title</Label>
                  <Input name="title" defaultValue={selectedSupervisor.title || ""} required />
                </div>
                <Button type="submit">Save</Button>
              </form>
            )}
          </DialogContent>
        </Dialog>
        {/* Supervisor View Modal */}
        <Dialog open={showViewSupervisorModal} onOpenChange={setShowViewSupervisorModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Supervisor Details</DialogTitle>
            </DialogHeader>
            {selectedSupervisor && (
              <div className="space-y-2">
                <div><b>Name:</b> {getUserName(selectedSupervisor.user)}</div>
                <div><b>Email:</b> {selectedSupervisor.user?.email || "-"}</div>
                <div><b>Department:</b> {selectedSupervisor.department || "-"}</div>
                <div><b>Title:</b> {selectedSupervisor.title || "-"}</div>
                <div><b>Assigned Students:</b></div>
                <ul className="list-disc pl-5">
                  {selectedSupervisor.assigned_students?.length ? (
                    selectedSupervisor.assigned_students.slice(supervisorStudentsPage * STUDENTS_PER_PAGE, (supervisorStudentsPage + 1) * STUDENTS_PER_PAGE).map(stu => (
                      <li key={stu.id} className="mb-2">
                        {String(getProfileName(stu.profile ?? []) || "-")} ({stu.student_id})<br />
                        Program: {String(stu.program || "-")}, Year: {String(stu.year_of_study || "-")}<br />
                        Phone: {stu.profile?.[0]?.phone_number || "N/A"}<br />
                        Company: {stu.company?.[0]?.name || "N/A"} ({stu.company?.[0]?.location || "N/A"})
                      </li>
                    ))
                  ) : (
                    <li>No students assigned.</li>
                  )}
                </ul>
                {selectedSupervisor.assigned_students && selectedSupervisor.assigned_students.length > STUDENTS_PER_PAGE && (
                  <div className="flex gap-2 mt-2">
                    <Button size="sm" variant="outline" disabled={supervisorStudentsPage === 0} onClick={() => setSupervisorStudentsPage(p => Math.max(0, p - 1))}>Prev</Button>
                    <Button size="sm" variant="outline" disabled={(supervisorStudentsPage + 1) * STUDENTS_PER_PAGE >= selectedSupervisor.assigned_students.length} onClick={() => setSupervisorStudentsPage(p => p + 1)}>Next</Button>
                  </div>
                )}
              </div>
            )}
            <Button onClick={() => setShowViewSupervisorModal(false)}>Close</Button>
          </DialogContent>
        </Dialog>
        <Dialog open={showAddStudentModal} onOpenChange={setShowAddStudentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Student</DialogTitle>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as typeof e.target & {
                firstName: { value: string };
                lastName: { value: string };
                email: { value: string };
                password: { value: string };
                studentId: { value: string };
                program: { value: string };
                yearOfStudy: { value: string };
                phoneNumber: { value: string };
              };
              try {
                // Create user via Django API
                const registrationData = {
                  email: form.email.value,
                  password: form.password.value,
                  password_confirm: form.password.value,
                  first_name: form.firstName.value,
                  last_name: form.lastName.value,
                  role: 'student',
                  student_id: form.studentId.value,
                  program: form.program.value,
                  year_of_study: parseInt(form.yearOfStudy.value),
                  phone_number: form.phoneNumber.value,
                };
                
                const response = await fetch(`${API_BASE_URL}/auth/register/`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(registrationData),
                });
                
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.detail || errorData.message || 'Registration failed');
                }
                toast({ 
                  title: 'Student added successfully!', 
                  description: `${form.firstName.value} ${form.lastName.value} has been added. Email: ${form.email.value}. Please provide them with their login credentials.` 
                });
                setShowAddStudentModal(false);
                // Refresh dashboard data
                window.location.reload();
              } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
              }
            }} className="space-y-4">
              <Input name="firstName" placeholder="First Name" required />
              <Input name="lastName" placeholder="Last Name" required />
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="password" type="password" placeholder="Password" required />
              <Input name="studentId" placeholder="Student ID" required />
              <Input name="program" placeholder="Program" required />
              <Input name="yearOfStudy" type="number" min={1} max={6} placeholder="Year of Study" required />
              <Input name="phoneNumber" placeholder="Phone Number" required />
              <Button type="submit">Add Student</Button>
            </form>
          </DialogContent>
        </Dialog>
        <Dialog open={showAddSupervisorModal} onOpenChange={setShowAddSupervisorModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add Supervisor</DialogTitle>
            </DialogHeader>
            <form onSubmit={async (e) => {
              e.preventDefault();
              const form = e.target as typeof e.target & {
                firstName: { value: string };
                lastName: { value: string };
                email: { value: string };
                password: { value: string };
                department: { value: string };
                title: { value: string };
                phoneNumber: { value: string };
              };
              try {
                // Create user via Django API
                const registrationData = {
                  email: form.email.value,
                  password: form.password.value,
                  password_confirm: form.password.value,
                  first_name: form.firstName.value,
                  last_name: form.lastName.value,
                  role: 'supervisor',
                  department: form.department.value,
                  title: form.title.value,
                  phone_number: form.phoneNumber.value,
                };
                
                const response = await fetch(`${API_BASE_URL}/auth/register/`, {
                  method: 'POST',
                  headers: {
                    'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify(registrationData),
                });
                
                if (!response.ok) {
                  const errorData = await response.json();
                  throw new Error(errorData.detail || errorData.message || 'Registration failed');
                }
                
                toast({ 
                  title: 'Supervisor added successfully!', 
                  description: `${form.firstName.value} ${form.lastName.value} has been added. Email: ${form.email.value}. Please provide them with their login credentials.` 
                });
                setShowAddSupervisorModal(false);
                // Refresh dashboard data
                window.location.reload();
              } catch (error: any) {
                toast({ title: 'Error', description: error.message, variant: 'destructive' });
              }
            }} className="space-y-4">
              <Input name="firstName" placeholder="First Name" required />
              <Input name="lastName" placeholder="Last Name" required />
              <Input name="email" type="email" placeholder="Email" required />
              <Input name="password" type="password" placeholder="Password" required />
              <Input name="department" placeholder="Department" required />
              <Input name="title" placeholder="Title" required />
              <Input name="phoneNumber" placeholder="Phone Number" required />
              <Button type="submit">Add Supervisor</Button>
            </form>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Modal */}
        <DeleteConfirmationModal
          isOpen={deleteModal.isOpen}
          onClose={closeDeleteModal}
          onConfirm={handleConfirmDelete}
          title={`Delete ${deleteModal.type === 'student' ? 'Student' : 'Supervisor'}`}
          description={`Are you sure you want to delete this ${deleteModal.type}? This action cannot be undone and will remove all associated data.`}
          itemName={deleteModal.name}
          isLoading={deleteModal.isLoading}
          assignedStudentsCount={deleteModal.assignedStudentsCount}
          deleteType={deleteModal.type}
        />
      </main>
    </div>
  );
};

export default AdminDashboard;
