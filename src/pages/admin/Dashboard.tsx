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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ProfileSettings } from "@/components/ProfileSettings";
import { Label } from "@/components/ui/label";
import { generateIntroductoryLetter, downloadLetter } from "@/utils/letterGenerator";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import ReactQuill from 'react-quill';
import 'react-quill/dist/quill.snow.css';
import { ChartContainer } from "@/components/ui/chart";
import { BarChart as ReBarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { BarChart as LucideBarChart } from "lucide-react";
import { PieChart, Pie, Cell, Legend } from "recharts";
import { NotificationPopover } from "@/components/ui/notification-popover";

type Student = Database["public"]["Tables"]["students"]["Row"] & {
  profile?: Array<Database["public"]["Tables"]["profiles"]["Row"]>;
  verification_status?: Database["public"]["Tables"]["verification_status"]["Row"];
  attachment?: (Database["public"]["Tables"]["attachments"]["Row"] & {
    company?: Array<Database["public"]["Tables"]["companies"]["Row"]>;
  });
};

type SupervisorWithStudents = {
  id: string;
  department: string;
  title?: string;
  students_count?: number;
  profile?: Array<{ id: string; first_name: string; last_name: string; email: string; phone_number?: string }>;
  assigned_students?: Array<{
    id: string;
    student_id: string;
    program: string;
    year_of_study: string;
    profile?: Array<{ first_name: string; last_name: string; email: string; phone_number?: string }>;
    company?: Array<{ name: string; location: string }>;
  }>;
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
  student?: Student;
  company?: Array<Database["public"]["Tables"]["companies"]["Row"]>;
  supervisor?: {
    id: string;
    profile?: Array<{
      first_name: string;
      last_name: string;
      email: string;
    }>;
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
    return stored ? Number(stored) : 20;
  });
  const [globalLunch, setGlobalLunch] = useState(() => {
    const stored = localStorage.getItem('globalLunch');
    return stored ? Number(stored) : 200;
  });
  const [supervisorForm, setSupervisorForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    department: "",
    title: "",
  });
  const [supervisorPassword, setSupervisorPassword] = useState("");
  const [letterTemplate, setLetterTemplate] = useState<string>("");
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
  const [messageContent, setMessageContent] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const messageInputRef = useRef(null);
  const [expandedSupervisors, setExpandedSupervisors] = useState<{ [id: string]: boolean }>({});
  const [supervisorStudentsPage, setSupervisorStudentsPage] = useState(0);
  const STUDENTS_PER_PAGE = 5;
  const [supervisorFilter, setSupervisorFilter] = useState<string>('all');
  const [periodFilter, setPeriodFilter] = useState<string>('all');
  const [supervisorSearch, setSupervisorSearch] = useState('');
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Persist to localStorage when changed
  useEffect(() => {
    localStorage.setItem('globalRate', String(globalRate));
  }, [globalRate]);
  useEffect(() => {
    localStorage.setItem('globalLunch', String(globalLunch));
  }, [globalLunch]);

  // Add helper function at the top of the component
  const getProfileName = (profileArr?: Array<{ first_name?: string; last_name?: string }>) => {
    if (Array.isArray(profileArr) && profileArr[0]) {
      return `${profileArr[0].first_name || ''} ${profileArr[0].last_name || ''}`.trim() || '-';
    }
    return '-';
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
      const apiKey = "AIzaSyDckZpKLFR7Oij4fkJ20oiFfguED3YaWIw";
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
      const amount = (globalRate * distance) + globalLunch;
      // Create reimbursements for each supervisor
      const reimbursements = supervisors.map(supervisorId => ({
        supervisor_id: supervisorId,
        student_id: studentId,
        amount: amount,
        rate: globalRate,
        lunch: globalLunch,
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

  useEffect(() => {
    const fetchDashboardData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching admin dashboard data");

        // Fetch students with their verification status and attachments
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select(`
            *,
            profile:profiles(*),
            verification_status:verification_status!left(*),
            attachment:attachments(
              *,
              company:companies(*)
            )
          `)
          .order('created_at', { ascending: false });

        if (studentsError) {
          console.error("Error fetching students:", studentsError);
          throw studentsError;
        }

        if (studentsData) {
          console.log("Students data:", studentsData);
          // Transform the data to match our Student type
          const transformedStudents = studentsData.map(student => ({
            ...student,
            profile: Array.isArray(student.profile) ? student.profile : (student.profile ? [student.profile] : []),
            verification_status: student.verification_status?.[0] || null,
            attachment: Array.isArray(student.attachment) ? student.attachment : (student.attachment ? [student.attachment] : []),
          }));
          setStudents(transformedStudents as Student[]);
        }

        // Fetch supervisors with their student count and assigned students
        const { data: supervisorsData, error: supervisorsError } = await supabase
          .from("supervisors")
          .select(`
            *,
            profile:profiles(*)
          `);

        if (supervisorsError) {
          console.error("Error fetching supervisors:", supervisorsError);
          throw supervisorsError;
        }

        let supervisorsWithDetails = [];
        if (supervisorsData) {
          supervisorsWithDetails = await Promise.all(
            supervisorsData.map(async (supervisor) => {
              // Fetch assigned students for each supervisor
              const { data: assignments, error: assignmentsError } = await supabase
                .from("supervisor_assignments")
                .select(`
                  id,
                  student_id,
                  student:students(
                    id,
                    student_id,
                    program,
                    year_of_study,
                    profile:profiles(*),
                    attachment:attachments(
                      *,
                      company:companies(*)
                    )
                  )
                `)
                .eq("supervisor_id", supervisor.id);
              if (assignmentsError) {
                console.error("Error fetching assigned students:", assignmentsError);
                return { ...supervisor, students_count: 0, assigned_students: [] };
              }
              // Map assigned students
              const assigned_students = (assignments || []).map(a => {
                const stu = Array.isArray(a.student) ? a.student[0] : a.student;
                const attachment = Array.isArray(stu?.attachment) ? stu.attachment[0] : stu?.attachment;
                const company = Array.isArray(attachment?.company) ? attachment.company[0] : attachment?.company;
                return {
                  id: stu?.id || '',
                  student_id: stu?.student_id || '',
                  program: stu?.program || '',
                  year_of_study: stu?.year_of_study || '',
                  profile: Array.isArray(stu?.profile) ? stu.profile : (stu?.profile ? [stu.profile] : []),
                  assignedCompanyName: company?.name || '-',
                  assignedCompanyLocation: company?.location || '-',
                  attachment_period: attachment?.attachment_period || '-',
                };
              });
              return {
                ...supervisor,
                profile: Array.isArray(supervisor.profile) ? supervisor.profile : (supervisor.profile ? [supervisor.profile] : []),
                students_count: assigned_students.length,
                assigned_students,
              };
            })
          );
          setSupervisors(supervisorsWithDetails as SupervisorWithStudents[]);
        }

        // Fetch reimbursements
        const { data: reimbursementsData, error: reimbursementsError } = await supabase
          .from("reimbursements")
          .select(`
            *,
            student:students!reimbursements_student_id_fkey(
              *,
              profile:profiles(*)
            ),
            company:companies!reimbursements_company_id_fkey(*),
            supervisor:supervisors!reimbursements_supervisor_id_fkey(
              *,
              profile:profiles(*)
            )
          `);

        if (reimbursementsError) {
          console.error("Error fetching reimbursements:", reimbursementsError);
          console.log("Continuing without reimbursements data");
        } else {
          console.log("Reimbursements data:", reimbursementsData);
          setReimbursements(reimbursementsData || []);
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

    fetchDashboardData();
  }, [currentUser, toast]);

  useEffect(() => {
    const saved = localStorage.getItem("introLetterTemplate");
    if (saved) setLetterTemplate(saved);
  }, []);

  const saveTemplate = () => {
    localStorage.setItem("introLetterTemplate", letterTemplate);
    toast({ title: "Template saved!" });
  };

  const generateCustomIntroLetter = (studentName: string, regNo: string) => {
    let content = letterTemplate;
    content = content.replace(/\{\{name\}\}/gi, studentName);
    content = content.replace(/\{\{admno\}\}/gi, regNo);
    return content;
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
        .from("supervisor_assignments")
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
    const supervisor = supervisors.find(s => s.id === supervisorId);
    if (!supervisor) return;
    setSelectedSupervisor(supervisor);
    setShowViewSupervisorModal(true);
  };

  // Get all supervisor names for the filter dropdown
  const allSupervisorNames = Array.from(new Set(supervisors.flatMap(sup => getProfileName(sup.profile ?? [])))).filter(Boolean);

  // Update filteredStudents to apply supervisor and period filters
  const filteredStudents = students.filter(student => {
    // Supervisor filter: check if any assigned supervisor matches
    const assignedSupervisors = supervisors.filter(sup =>
      (sup.assigned_students || []).some(stu => stu.id === student.id)
    );
    const supervisorNames = assignedSupervisors.map(sup => getProfileName(sup.profile ?? []));
    const matchesSupervisor = supervisorFilter === 'all' || supervisorNames.includes(supervisorFilter);
    // Period filter
    const matchesPeriod = periodFilter === 'all' || (student.attachment?.[0]?.attachment_period === periodFilter);
    // Existing search term filter
    const matchesSearch = getProfileName(student.profile ?? []).toLowerCase().includes(searchTerm.toLowerCase()) ||
      (typeof student.student_id === 'string' && student.student_id.toLowerCase().includes(searchTerm.toLowerCase()));
    return matchesSupervisor && matchesPeriod && matchesSearch;
  });
  const filteredSupervisors = supervisors.filter(supervisor =>
    getProfileName(supervisor.profile ?? []).toLowerCase().includes(searchTerm.toLowerCase()) ||
    (typeof supervisor.id === 'string' && supervisor.id.toLowerCase().includes(searchTerm.toLowerCase()))
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

  // Update filteredSupervisorsForAssigned to apply both dropdown and search filters
  const filteredSupervisorsForAssigned = supervisors.filter(sup => {
    const name = getProfileName(sup.profile ?? []);
    const matchesDropdown = supervisorFilter === 'all' || name === supervisorFilter;
    const matchesSearch = supervisorSearch === '' || name.toLowerCase().includes(supervisorSearch.toLowerCase());
    return matchesDropdown && matchesSearch;
  });

  useEffect(() => {
    if (!currentUser) return;
    const fetchMessages = async () => {
      const { data } = await supabase
        .from("messages")
        .select("*, sender:profiles(id, first_name, last_name), read")
        .eq("receiver_id", currentUser.id)
        .order("created_at", { ascending: false });
      setMessages(data || []);
      setUnreadCount((data || []).filter((msg: any) => !msg.read).length);
    };
    fetchMessages();
  }, [currentUser]);

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
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Admin Dashboard</h1>
          <div className="flex items-center gap-4">
            <NotificationPopover
              messages={messages}
              unreadCount={unreadCount}
              onReply={async (msg, reply) => {
                await supabase.from("messages").insert({ sender_id: currentUser.id, receiver_id: msg.sender.id, content: reply });
                setUnreadCount(c => c + 1);
              }}
              onViewAll={() => {
                // Optionally navigate to settings/messages tab
                document.querySelector('button[value="settings"]')?.click();
              }}
            />
            <Button 
              variant="outline" 
              onClick={() => logout()}
            >
              Sign Out
            </Button>
          </div>
        </div>
      </header>

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
                      s.verification_status?.fee_verified === true &&
                      !!s.attachment?.[0]?.attachment_period
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
                    Ksh {reimbursements.reduce((acc, curr) => acc + curr.amount, 0).toLocaleString()}
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
                    <Select defaultValue="all">
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
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
                      <TableHead className="px-4 py-2">Attachment Period</TableHead>
                      <TableHead className="px-4 py-2">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredStudents.map((student) => (
                      <TableRow key={student.id}>
                        <TableCell className="px-4 py-2">{student.student_id}</TableCell>
                        <TableCell className="px-4 py-2">{String(getProfileName(student.profile ?? []) || "-")}</TableCell>
                        <TableCell className="px-4 py-2">{String(student.program || "-")}</TableCell>
                        <TableCell className="px-4 py-2">{student.year_of_study}</TableCell>
                        <TableCell className="px-4 py-2">
                          <Badge variant={
                            student.verification_status?.is_verified === true && student.verification_status?.fee_verified === true && !!student.attachment?.[0]?.attachment_period
                              ? "default"
                              : "outline"
                          }>
                            {student.verification_status?.is_verified === true && student.verification_status?.fee_verified === true && !!student.attachment?.[0]?.attachment_period
                              ? "Eligible"
                              : "Not Eligible"}
                          </Badge>
                        </TableCell>
                        <TableCell className="px-4 py-2">{student.attachment?.[0]?.attachment_period || "-"}</TableCell>
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
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {filteredSupervisors.map(sup => (
                          <TableRow key={sup.id}>
                            <TableCell className="px-4 py-2">{String(getProfileName(sup.profile ?? []) || "-")}</TableCell>
                            <TableCell className="px-4 py-2">{sup.department}</TableCell>
                            <TableCell className="px-4 py-2">{sup.assigned_students?.length || 0}</TableCell>
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
                          <Select value={supervisorFilter} onValueChange={setSupervisorFilter}>
                            <SelectTrigger className="w-48"><SelectValue placeholder="Filter by Supervisor" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="all">All Supervisors</SelectItem>
                              {allSupervisorNames.map(name => (
                                <SelectItem key={name} value={name}>{name}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
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
                              <TableHead className="px-4 py-2">Phone Number</TableHead>
                              <TableHead className="px-4 py-2">Program</TableHead>
                              <TableHead className="px-4 py-2">Year</TableHead>
                              <TableHead className="px-4 py-2">Company</TableHead>
                              <TableHead className="px-4 py-2">Company Location</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {filteredSupervisorsForAssigned.flatMap(sup =>
                              (sup.assigned_students || [])
                                .filter(stu => periodFilter === 'all' || stu.attachment_period === periodFilter)
                                .map(stu => {
                                  const studentName = Array.isArray(stu.profile)
                                    ? getProfileName(stu.profile)
                                    : getProfileName([stu.profile]);
                                  const phoneNumber = Array.isArray(stu.profile) && stu.profile.length > 0 && 'phone_number' in stu.profile[0] ? stu.profile[0].phone_number || 'N/A' : 'N/A';
                                  const assignedCompanyName = stu.assignedCompanyName || '-';
                                  const assignedCompanyLocation = stu.assignedCompanyLocation || '-';
                                  console.log('Assigned Student Debug:', {
                                    stu,
                                    company: stu.company
                                  });
                                  return (
                                    <TableRow key={sup.id + '-' + stu.id}>
                                      <TableCell className="px-4 py-2">{String(getProfileName(sup.profile ?? []) || "-")}</TableCell>
                                      <TableCell className="px-4 py-2">{sup.department}</TableCell>
                                      <TableCell className="px-4 py-2">{String(studentName || "-")}</TableCell>
                                      <TableCell className="px-4 py-2">{stu.student_id}</TableCell>
                                      <TableCell className="px-4 py-2">{phoneNumber}</TableCell>
                                      <TableCell className="px-4 py-2">{String(stu.program || "-")}</TableCell>
                                      <TableCell className="px-4 py-2">{stu.year_of_study}</TableCell>
                                      <TableCell className="px-4 py-2">{String(assignedCompanyName)}</TableCell>
                                      <TableCell className="px-4 py-2">{String(assignedCompanyLocation)}</TableCell>
                                    </TableRow>
                                  );
                                })
                            )}
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
                        onChange={(e) => setGlobalRate(Number(e.target.value))}
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
                        onChange={(e) => setGlobalLunch(Number(e.target.value))}
                        className="w-24"
                        placeholder="e.g. 200"
                        title="Set the daily lunch reimbursement"
                      />
                      <span>KSH</span>
                    </div>
                    <Select defaultValue="all">
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All</SelectItem>
                        <SelectItem value="approved">Approved</SelectItem>
                        <SelectItem value="pending">Pending</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <Button onClick={async () => {
                  try {
                    // Fetch all reimbursements
                    const { data: allReimbs, error } = await supabase.from('reimbursements').select('*');
                    if (error) throw error;
                    // For each, recalculate amount and update
                    for (const r of allReimbs) {
                      const newAmount = (globalRate * ((r.distance || 0) * 2)) + globalLunch;
                      const { error: updateError } = await supabase
                        .from('reimbursements')
                        .update({ amount: newAmount, rate: globalRate, lunch: globalLunch })
                        .eq('id', r.id);
                      if (updateError) throw updateError;
                    }
                    toast({ title: 'Reimbursements updated!' });
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
                        <TableHead className="px-4 py-2">Amount</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredReimbursements.map((r, idx) => {
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
                        const displayAmount = (globalRate * ((r.distance || 0) * 2)) + globalLunch;
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
                            <TableCell className="px-4 py-2">{displayAmount != null ? displayAmount.toLocaleString() : '-'}</TableCell>
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
                    <ReBarChart data={Object.entries(students.reduce((acc, s) => { acc[s.program] = (acc[s.program] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([program, count]) => ({ program: String(program), count: Number(count) }))}>
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
                          { name: "Eligible", value: students.filter(s => s.verification_status?.is_verified && s.verification_status?.fee_verified && s.attachment?.[0]?.attachment_period).length },
                          { name: "Not Eligible", value: students.length - students.filter(s => s.verification_status?.is_verified && s.verification_status?.fee_verified && s.attachment?.[0]?.attachment_period).length }
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
                    <ReBarChart data={Object.entries(supervisors.reduce((acc, s) => { acc[s.department] = (acc[s.department] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([department, count]) => ({ department: String(department), count: Number(count) }))}>
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
                    <ReBarChart data={Object.entries(students.reduce((acc, s) => { const period = s.attachment?.[0]?.attachment_period || '-'; acc[period] = (acc[period] || 0) + 1; return acc; }, {} as Record<string, number>)).map(([period, count]) => ({ period: String(period), count: Number(count) }))}>
                      <XAxis dataKey="period" />
                      <YAxis allowDecimals={false} />
                      <Tooltip />
                      <Bar dataKey="count" fill="#f87171" />
                    </ReBarChart>
                  </ResponsiveContainer>
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
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold mb-1">Preview:</h4>
                  <div className="bg-gray-100 p-2 rounded text-xs whitespace-pre-wrap" dangerouslySetInnerHTML={{ __html: generateCustomIntroLetter("John Doe", "STU2023001") }} />
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
                      receiver_id: selectedStudent.profile?.[0]?.id,
                      content: messageContent.trim(),
                    });
                    setMessageContent("");
                    setShowMessageModal(false);
                    toast({ title: "Message sent!" });
                  } catch (err) {
                    toast({ title: "Error sending message", description: err.message, variant: "destructive" });
                  } finally {
                    setMessageSending(false);
                  }
                }}
                className="space-y-4"
              >
                <Label>To: {String(getProfileName(selectedStudent.profile ?? []) || "-")}</Label>
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
                <div><b>Name:</b> {String(getProfileName(selectedStudent.profile ?? []) || "-")}</div>
                <div><b>Student ID:</b> {selectedStudent.student_id}</div>
                <div><b>Program:</b> {String(selectedStudent.program || "-")}</div>
                <div><b>Year of Study:</b> {String(selectedStudent.year_of_study || "-")}</div>
                <div><b>Email:</b> {selectedStudent.profile?.[0]?.email}</div>
                <div><b>Phone:</b> {selectedStudent.profile?.[0]?.phone_number || "N/A"}</div>
                <div><b>Company:</b> {selectedStudent.attachment?.[0]?.company?.[0]?.name || "N/A"}</div>
                <div><b>Company Location:</b> {selectedStudent.attachment?.[0]?.company?.[0]?.location || "N/A"}</div>
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
                <div><b>Name:</b> {String(getProfileName(selectedSupervisor.profile ?? []) || "-")}</div>
                <div><b>Email:</b> {selectedSupervisor.profile?.[0]?.email}</div>
                <div><b>Department:</b> {selectedSupervisor.department}</div>
                <div><b>Title:</b> {selectedSupervisor.title}</div>
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
                // 1. Create user in auth
                const { data: authData, error: signUpError } = await supabase.auth.signUp({
                  email: form.email.value,
                  password: form.password.value,
                  options: {
                    data: {
                      first_name: form.firstName.value,
                      last_name: form.lastName.value,
                      role: 'student',
                    },
                  },
                });
                if (signUpError) throw signUpError;
                if (!authData.user) throw new Error('User could not be created');
                // 2. Insert into profiles
                const { error: profileError } = await supabase.from('profiles').insert({
                  id: authData.user.id,
                  first_name: form.firstName.value,
                  last_name: form.lastName.value,
                  email: form.email.value,
                  phone_number: form.phoneNumber.value,
                  role: 'student',
                });
                if (profileError) throw profileError;
                // 3. Insert into students
                const { error: studentError } = await supabase.from('students').insert({
                  id: authData.user.id,
                  student_id: form.studentId.value,
                  program: form.program.value,
                  year_of_study: form.yearOfStudy.value,
                });
                if (studentError) throw studentError;
                toast({ title: 'Student added!' });
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
                // 1. Create user in auth
                const { data: authData, error: signUpError } = await supabase.auth.signUp({
                  email: form.email.value,
                  password: form.password.value,
                  options: {
                    data: {
                      first_name: form.firstName.value,
                      last_name: form.lastName.value,
                      role: 'supervisor',
                    },
                  },
                });
                if (signUpError) throw signUpError;
                if (!authData.user) throw new Error('User could not be created');
                // 2. Insert into profiles
                const { error: profileError } = await supabase.from('profiles').insert({
                  id: authData.user.id,
                  first_name: form.firstName.value,
                  last_name: form.lastName.value,
                  email: form.email.value,
                  phone_number: form.phoneNumber.value,
                  role: 'supervisor',
                });
                if (profileError) throw profileError;
                // 3. Insert into supervisors
                const { error: supervisorError } = await supabase.from('supervisors').insert({
                  id: authData.user.id,
                  department: form.department.value,
                  title: form.title.value,
                });
                if (supervisorError) throw supervisorError;
                toast({ title: 'Supervisor added!' });
                // TODO: Send email to supervisor with credentials (use Supabase Edge Functions or external provider)
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
      </main>
    </div>
  );
};

export default AdminDashboard;
