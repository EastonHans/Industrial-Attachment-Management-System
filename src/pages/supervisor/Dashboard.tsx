import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Bell, FileText, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext_django";
import { supabase, API_BASE_URL, tokenManager } from "@/services/djangoApi";
import { ProfileSettings } from "@/components/ProfileSettings";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import EvaluationForm from "@/components/supervisor/EvaluationForm";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { format } from 'date-fns';
import NavBar from "@/components/layout/NavBar";

type Profile = {
  id: string;
  first_name: string;
  last_name: string;
  phone_number?: string;
  created_at: string;
  updated_at: string;
};

type Supervisor = {
  id: string;
  user_id: string;
  created_at: string;
  updated_at: string;
  profile: Profile;
};

type Student = {
  id: string;
  user_id: string;
  student_id: string;
  program: string;
  year_of_study: number;
  semester: number;
  phone_number?: string;
  created_at: string;
  updated_at: string;
  profile: Profile;
};

type Report = {
  id: string;
  title: string;
  content: string;
  report_type: string;
  status: string;
  submission_date: string;
  attachment: {
    id: string;
    student: {
      id: string;
      student_id: string;
      profile: {
        id: string;
        first_name: string;
        last_name: string;
      };
    };
  };
};

// Type for Supabase join result
interface SupabaseStudentJoin {
  id: string;
  student_id: string;
  program: string;
  year_of_study: string;
  created_at?: string;
  updated_at?: string;
  profile: Profile[] | Profile;
}

// Utility to get the first object from any array or nested array
function getFirst<T>(val: T | T[] | (T | T[])[]): T | null {
  if (Array.isArray(val)) {
    if (val.length === 0) return null;
    return getFirst(val[0]);
  }
  return val ?? null;
}

// Add helper functions at the top of the file
function getCompanyName(attachment: any): string {
  if (!attachment) return 'No company info submitted';
  // Django API returns company object directly
  if (attachment.company?.name) return attachment.company.name;
  return 'No company info submitted';
}
function getCompanyLocation(attachment: any): string {
  if (!attachment) return 'No company info submitted';
  // Django API returns company object directly
  if (attachment.company?.location) return attachment.company.location;
  if (attachment.company?.address) return attachment.company.address;
  return 'No company info submitted';
}

const SupervisorDashboard = () => {
  const { toast } = useToast();
  const [selectedStudent, setSelectedStudent] = useState<any>(null);
  const { logout, currentUser } = useAuth();
  const [loading, setLoading] = useState(true);
  const [supervisor, setSupervisor] = useState<Supervisor | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [evaluationForm, setEvaluationForm] = useState({
    availability_of_documents: 0,
    organization_of_logbook: 0,
    adaptability: 0,
    teamwork: 0,
    accomplishment: 0,
    presence: 0,
    communication_skills: 0,
    mannerism: 0,
    understanding_of_tasks: 0,
    oral_presentation: 0,
    comments: "",
    overall_assessment: "Average",
  });
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [showStudentModal, setShowStudentModal] = useState(false);
  const [evalStudentId, setEvalStudentId] = useState<string | null>(null);
  const [evalWeek, setEvalWeek] = useState<number>(1);
  const [evalLog, setEvalLog] = useState<any>(null);
  const [studentLogs, setStudentLogs] = useState<any[]>([]);
  const [logsOpen, setLogsOpen] = useState(false);
  const [evaluations, setEvaluations] = useState<any[]>([]);
  const [selectedEvaluation, setSelectedEvaluation] = useState<any | null>(null);
  const [studentAttachment, setStudentAttachment] = useState<any>(null);
  const [messageContent, setMessageContent] = useState("");
  const [messageSending, setMessageSending] = useState(false);
  const [showMessageModal, setShowMessageModal] = useState(false);
  const messageInputRef = useRef(null);
  const [attachmentsByStudent, setAttachmentsByStudent] = useState<Record<string, any>>({});
  const [supervisorEvaluations, setSupervisorEvaluations] = useState<Record<string, any>>({});

  useEffect(() => {
    const fetchSupervisorData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching supervisor data for user:", currentUser.id);
        
        // Fetch supervisor details using Django API by user_id
        const token = tokenManager.getAccessToken();
        console.log('🔒 Supervisor Dashboard: Current user ID:', currentUser.id, 'Token exists:', !!token, token ? `Token preview: ${token.substring(0, 20)}...` : 'No token');
        
        // First, get the supervisor by user_id instead of supervisor id
        const supervisorListResponse = await fetch(`${API_BASE_URL}/supervisors/?user_id=${currentUser.id}`, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });
        
        console.log('🔒 Supervisor List API Response:', supervisorListResponse.status, supervisorListResponse.statusText);
        
        // Handle supervisor lookup results
        let currentSupervisorData = null;
        if (supervisorListResponse.ok) {
          const supervisorList = await supervisorListResponse.json();
          if (supervisorList.results && supervisorList.results.length > 0) {
            currentSupervisorData = supervisorList.results[0];
            setSupervisor(currentSupervisorData);
            console.log("Supervisor data:", currentSupervisorData);
          } else {
            throw new Error('No supervisor found for this user');
          }
        } else {
          const supervisorError = { message: `HTTP ${supervisorListResponse.status}` };
          console.error("Error fetching supervisor:", supervisorError);
          
          // If supervisor not found (404), it means user was deleted from database
          if (supervisorError.message?.includes("not found") || supervisorError.message?.includes("404")) {
            console.warn("Supervisor not found in database - user may have been deleted");
            toast({
              title: "Account Not Found",
              description: "Your account appears to have been removed. Please contact the administrator.",
              variant: "destructive",
            });
            // Clear session and redirect to login
            logout();
            return;
          }
          
          throw supervisorError;
        }
        
        if (!currentSupervisorData) {
          throw new Error('Supervisor data not available for fetching assignments');
        }
        
        const assignmentsResponse = await fetch(`${API_BASE_URL}/supervisor-assignments/?supervisor=${currentSupervisorData.id}`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        
        let assignmentsData = null;
        let assignmentsError = null;
        
        if (assignmentsResponse.ok) {
          assignmentsData = await assignmentsResponse.json();
        } else {
          assignmentsError = { message: `HTTP ${assignmentsResponse.status}` };
        }

        if (assignmentsError) {
          console.error("Error fetching assignments:", assignmentsError);
          
          // Handle case where supervisor assignments endpoint returns 404
          if (assignmentsError.message?.includes("not found") || assignmentsError.message?.includes("404")) {
            console.warn("Supervisor assignments not found - user may not have any assignments or may have been deleted");
            // Don't throw error, just log and continue with empty assignments
            setStudents([]);
          } else {
            throw assignmentsError;
          }
        } else if (assignmentsData) {
          console.log("Assignments data:", assignmentsData);
          const assignments = assignmentsData.results || assignmentsData;
          const studentsList = assignments
            .map((assignment: any) => {
              const student = assignment.student_detail;
              if (!student || typeof student !== 'object') return null;
              return {
                id: student.id,
                user_id: student.user_id,
                student_id: student.student_id,
                program: student.program,
                program_type: student.program_type,
                faculty: student.faculty,
                department: student.department,
                year_of_study: student.year_of_study,
                semester: student.semester,
                phone_number: student.phone_number,
                created_at: student.created_at || '',
                updated_at: student.updated_at || '',
                profile: {
                  id: student.user?.id || '',
                  first_name: student.user?.first_name || '',
                  last_name: student.user?.last_name || '',
                  phone_number: student.phone_number || '',
                  email: student.user?.email || '',
                  created_at: '',
                  updated_at: '',
                },
              };
            })
            .filter(Boolean) as Student[];
          setStudents(studentsList);
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

    fetchSupervisorData();
  }, [currentUser, toast]);

  useEffect(() => {
    const fetchEvaluations = async () => {
      if (!currentUser || !supervisor?.id) return;
      try {
        const response = await fetch(`${API_BASE_URL}/evaluations/?evaluator=${currentUser.id}`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          const evaluationsList = data.results || data;
          setEvaluations(evaluationsList);
          
          // Also fetch evaluations where this supervisor was the evaluator
          const evaluatorResponse = await fetch(`${API_BASE_URL}/evaluations/?evaluator=${currentUser.id}`, {
            headers: {
              'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          });
          
          if (evaluatorResponse.ok) {
            const evaluatorData = await evaluatorResponse.json();
            const supervisorEvals = evaluatorData.results || evaluatorData;
            const evalMap: Record<string, any> = {};
            supervisorEvals.forEach((evaluation: any) => {
              const studentId = evaluation.student?.id || evaluation.student;
              if (studentId) {
                evalMap[studentId] = evaluation;
              }
            });
            setSupervisorEvaluations(evalMap);
          }
        }
      } catch (error) {
        console.error('Error fetching evaluations:', error);
      }
    };
    fetchEvaluations();
  }, [currentUser, supervisor]);


  useEffect(() => {
    if (students.length === 0) return;
    const fetchAllAttachments = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/attachments/`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (response.ok) {
          const attachments = await response.json();
          const attachmentsList = attachments.results || attachments;
          const map: Record<string, any> = {};
          attachmentsList.forEach((att: any) => { 
            // Handle different possible student data structures
            const studentId = att.student?.id || att.student_id || att.student;
            if (studentId) {
              map[studentId] = att;
            }
            console.log('Processing attachment:', {
              attachmentId: att.id,
              studentId: studentId,
              studentObject: att.student,
              companyName: att.company?.name
            });
          });
          console.log('Final attachments mapping:', map);
          console.log('Current students:', students.map((s: any) => ({ id: s.id, name: s.profile?.first_name })));
          setAttachmentsByStudent(map);
        }
      } catch (error) {
        console.error('Error fetching attachments:', error);
      }
    };
    fetchAllAttachments();
  }, [students]);

  const handleReviewReport = (reportId: string) => {
    toast({
      title: "Report Opened",
      description: `You are now reviewing report ${reportId}`,
    });
  };

  const handleViewStudent = async (studentId: string) => {
    if (selectedStudent && selectedStudent.id === studentId) {
      setSelectedStudent(null);
      setStudentLogs([]);
      setLogsOpen(false);
      setStudentAttachment(null);
    } else {
      const student = students.find(s => s.id === studentId);
      setSelectedStudent(student || null);
      setLogsOpen(false);
      setStudentLogs([]);
      setStudentAttachment(null);
      if (student) {
        // Fetch logs using Django API
        try {
          const logsResponse = await fetch(`${API_BASE_URL}/weekly-logs/?student=${student.id}`, {
            headers: {
              'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          });
          if (logsResponse.ok) {
            const logsData = await logsResponse.json();
            const logsList = logsData.results || logsData;
            setStudentLogs(logsList || []);
          }
        } catch (error) {
          console.error('Error fetching weekly logs:', error);
          setStudentLogs([]);
        }
        
        // Use existing attachment data from attachmentsByStudent
        const attachment = attachmentsByStudent[student.id];
        console.log('Setting student attachment:', {
          studentId: student.id,
          studentName: student.profile?.first_name,
          attachmentFound: !!attachment,
          attachmentCompany: attachment?.company?.name,
          availableAttachments: Object.keys(attachmentsByStudent)
        });
        setStudentAttachment(attachment || null);
      }
    }
  };

  const openEvaluationModal = (studentId: string, week: number) => {
    setEvalStudentId(studentId);
    setEvalWeek(week);
    setShowEvalModal(true);
    // Fetch the log entry for this student and week using Django API
    fetch(`${API_BASE_URL}/weekly-logs/?student=${studentId}&week_number=${week}`, {
      headers: {
        'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
    })
    .then(response => response.json())
    .then(data => {
      const logsList = data.results || data;
      setEvalLog(logsList.length > 0 ? logsList[0] : null);
    })
    .catch(error => {
      console.error('Error fetching weekly log:', error);
      setEvalLog(null);
    });
  };

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

  if (!supervisor) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="mb-4">No supervisor profile found.</p>
          <Button onClick={() => logout()}>Sign Out</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <NavBar title="Supervisor Dashboard" />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-1/4">
            <Card>
              <CardHeader>
                <CardTitle>{supervisor.user?.first_name || 'Unknown'} {supervisor.user?.last_name || 'Supervisor'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Department</p>
                    <p className="text-sm text-muted-foreground">{supervisor.department || 'Not specified'}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Students Assigned</p>
                    <p className="text-sm text-muted-foreground">{students.length}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="w-full md:w-3/4">
            <Tabs defaultValue="students" className="w-full">
              <TabsList className="grid grid-cols-4 mb-8">
                <TabsTrigger value="students">Students</TabsTrigger>
                <TabsTrigger value="evaluations">Evaluations</TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>
              
              {/* Students Tab */}
              <TabsContent value="students">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="flex items-center">
                          <Users className="mr-2 h-5 w-5" />
                          Assigned Students
                        </CardTitle>
                        <CardDescription>
                          View and manage students assigned to you for supervision
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {students.length === 0 ? (
                      <p className="text-center text-muted-foreground py-4">No students assigned yet.</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Student ID</TableHead>
                            <TableHead>Name</TableHead>
                            <TableHead>Phone</TableHead>
                            <TableHead>Program</TableHead>
                            <TableHead>Year</TableHead>
                            <TableHead>My Evaluation</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Company Location</TableHead>
                            <TableHead>Attachment Period</TableHead>
                            <TableHead>Actions</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((student) => (
                            <TableRow key={student.id}>
                              <TableCell>{student.student_id}</TableCell>
                              <TableCell>
                                {student.user?.first_name || student.profile?.first_name || 'N/A'} {student.user?.last_name || student.profile?.last_name || ''}
                              </TableCell>
                              <TableCell>
                                {student.phone_number || student.user?.phone_number || student.profile?.phone_number || 'N/A'}
                              </TableCell>
                              <TableCell>{student.program}</TableCell>
                              <TableCell>{student.year_of_study}</TableCell>
                              <TableCell>
                                {supervisorEvaluations[student.id] ? (
                                  <Badge variant="outline">
                                    {((supervisorEvaluations[student.id].total / 110) * 50).toFixed(1)}/50
                                    <span className="text-xs ml-1">(50%)</span>
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">Not evaluated</span>
                                )}
                              </TableCell>
                              <TableCell>{getCompanyName(attachmentsByStudent[student.id])}</TableCell>
                              <TableCell>{getCompanyLocation(attachmentsByStudent[student.id])}</TableCell>
                              <TableCell>
                                {/* First check for actual attachment dates, then fallback to planned period */}
                                {attachmentsByStudent[student.id]?.start_date && attachmentsByStudent[student.id]?.end_date ? (
                                  `${new Date(attachmentsByStudent[student.id].start_date).toLocaleDateString()} - ${new Date(attachmentsByStudent[student.id].end_date).toLocaleDateString()}`
                                ) : student.attachment_period ? (
                                  `${student.attachment_period} (Planned)`
                                ) : (
                                  'Not set'
                                )}
                              </TableCell>
                              <TableCell>
                                <div className="flex gap-2 items-center">
                                  <Button 
                                    variant="outline" 
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={() => {
                                      if (selectedStudent && selectedStudent.id === student.id) {
                                        setSelectedStudent(null);
                                        setStudentLogs([]);
                                        setLogsOpen(false);
                                      } else {
                                        setSelectedStudent(student);
                                        setLogsOpen(false);
                                        setStudentLogs([]);
                                      }
                                    }}
                                  >
                                    <Users className="h-3 w-3" />
                                    View
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={async () => {
                                      setEvalStudentId(student.id);
                                      setShowEvalModal(true);
                                      try {
                                        const response = await fetch(`${API_BASE_URL}/weekly-logs/?student=${student.id}`, {
                                          headers: {
                                            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                                            'Content-Type': 'application/json',
                                          },
                                        });
                                        if (response.ok) {
                                          const data = await response.json();
                                          setEvalLog(data.results || data || []);
                                        }
                                      } catch (error) {
                                        console.error('Error fetching weekly logs:', error);
                                        setEvalLog([]);
                                      }
                                    }}
                                  >
                                    <ClipboardList className="h-3 w-3" />
                                    Evaluate
                                  </Button>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                    onClick={() => { setSelectedStudent(student); setShowMessageModal(true); }}
                                  >
                                    <Bell className="h-3 w-3" />
                                    Message
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                {selectedStudent && (
                  <Card className="mt-6">
                    <CardHeader>
                      <CardTitle>Student Details</CardTitle>
                      <CardDescription>
                        {selectedStudent.profile.first_name} {selectedStudent.profile.last_name}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-sm font-medium">Student ID</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedStudent.student_id}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Program</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedStudent.program}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Year of Study</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedStudent.year_of_study}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Email</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedStudent.profile.email}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Phone Number</p>
                            <p className="text-sm text-muted-foreground">
                              {selectedStudent.profile.phone_number || 'N/A'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Company</p>
                            <p className="text-sm text-muted-foreground">
                              {getCompanyName(studentAttachment)}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Company Location</p>
                            <p className="text-sm text-muted-foreground">
                              {getCompanyLocation(studentAttachment)}
                            </p>
                          </div>
                        </div>
                        <div>
                          <p className="text-sm font-medium mb-2">Progress</p>
                          <div className="flex items-center gap-2">
                            <Button 
                              variant="outline" 
                              size="sm" 
                              onClick={async () => {
                                if (!logsOpen) {
                                  try {
                                    const response = await fetch(`${API_BASE_URL}/weekly-logs/?student=${selectedStudent.id}`, {
                                      headers: {
                                        'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                                        'Content-Type': 'application/json',
                                      },
                                    });
                                    if (response.ok) {
                                      const data = await response.json();
                                      const logsList = data.results || data;
                                      // Sort by week_number
                                      logsList.sort((a: any, b: any) => a.week_number - b.week_number);
                                      setStudentLogs(logsList || []);
                                    }
                                  } catch (error) {
                                    console.error('Error fetching weekly logs:', error);
                                    setStudentLogs([]);
                                  }
                                }
                                setLogsOpen((prev) => !prev);
                              }}
                            >
                              <ClipboardList className="mr-2 h-4 w-4" />
                              View Logs
                            </Button>
                          </div>
                          {logsOpen && (
                            <div className="mt-4">
                              <h3 className="text-lg font-semibold mb-2">Weekly Logs</h3>
                              {studentLogs.length === 0 ? (
                                <p className="text-muted-foreground">No logs found for this student.</p>
                              ) : (
                                <Accordion type="multiple" className="w-full">
                                  {(
                                    Object.entries(studentLogs.reduce((acc: Record<string, any[]>, log: any) => {
                                      if (!acc[log.week_number]) acc[log.week_number] = [];
                                      acc[log.week_number].push(log);
                                      return acc;
                                    }, {} as Record<string, any[]>)) as [string, any[]][]
                                  ).map(([week, logs]) => (
                                    <AccordionItem key={week} value={String(week)}>
                                      <AccordionTrigger>
                                        Week {week}
                                      </AccordionTrigger>
                                      <AccordionContent>
                                        <ul className="ml-4 list-disc">
                                          {logs.map((log: any) => (
                                            <li key={log.id}>
                                              {format(new Date(log.date), 'EEEE do MMMM yyyy')}
                                              {log.day ? ` (${log.day})` : ''}
                                              {log.task_assigned && (
                                                <div><b>Task Assigned:</b> {log.task_assigned}</div>
                                              )}
                                              {log.attachee_remarks && (
                                                <div><b>Attachee Remarks:</b> {log.attachee_remarks}</div>
                                              )}
                                              {log.trainer_remarks && (
                                                <div><b>Trainer Remarks:</b> {log.trainer_remarks}</div>
                                              )}
                                              {log.supervisor_remarks && (
                                                <div><b>Supervisor Remarks:</b> {log.supervisor_remarks}</div>
                                              )}
                                            </li>
                                          ))}
                                        </ul>
                                      </AccordionContent>
                                    </AccordionItem>
                                  ))}
                                </Accordion>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>
              
              {/* Evaluations Tab */}
              <TabsContent value="evaluations">
                <Card>
                  <CardHeader>
                    <div className="flex justify-between items-center">
                      <div>
                        <CardTitle className="flex items-center">
                          <ClipboardList className="mr-2 h-5 w-5" />
                          Evaluation History
                        </CardTitle>
                        <CardDescription>
                          View all evaluations you have submitted
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Student</TableHead>
                          <TableHead>Date</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Overall</TableHead>
                          <TableHead>Actions</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {evaluations.length === 0 ? (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-muted-foreground">No evaluations found.</TableCell>
                          </TableRow>
                        ) : (
                          evaluations.map(ev => (
                            <TableRow key={ev.id}>
                              <TableCell>{ev.student?.user?.first_name || ''} {ev.student?.user?.last_name || ''}</TableCell>
                              <TableCell>{ev.created_at ? format(new Date(ev.created_at), 'yyyy-MM-dd') : '-'}</TableCell>
                              <TableCell>{ev.total || '-'}</TableCell>
                              <TableCell>{ev.overall_assessment || '-'}</TableCell>
                              <TableCell>
                                <Button size="sm" variant="outline" onClick={() => setSelectedEvaluation(ev)}>View</Button>
                              </TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings">
                <ProfileSettings role="supervisor" />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Evaluation Modal */}
      <Dialog open={showEvalModal} onOpenChange={setShowEvalModal}>
        <DialogContent style={{ maxWidth: '900px', width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
          <DialogHeader>
            <DialogTitle>Evaluate Student</DialogTitle>
          </DialogHeader>
          {evalStudentId && (
            <EvaluationForm
              studentId={evalStudentId}
              onSubmitted={() => setShowEvalModal(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* View Students Modal */}
      <Dialog open={showStudentModal} onOpenChange={setShowStudentModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Student Details</DialogTitle>
          </DialogHeader>
          {selectedStudent && (
            <div>
              <p><b>Name:</b> {selectedStudent.profile.first_name || 'N/A'} {selectedStudent.profile.last_name || ''}</p>
              <p><b>Phone:</b> {selectedStudent.profile.phone_number || "N/A"}</p>
              <p><b>Company:</b> {selectedStudent.profile.company?.[0]?.name || "N/A"}</p>
            </div>
          )}
          <Button onClick={() => setShowStudentModal(false)}>Close</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={!!selectedEvaluation} onOpenChange={() => setSelectedEvaluation(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evaluation Details</DialogTitle>
          </DialogHeader>
          {selectedEvaluation && (
            <div className="space-y-2">
              <div><b>Student:</b> {selectedEvaluation.student?.user?.first_name || ''} {selectedEvaluation.student?.user?.last_name || ''}</div>
              <div><b>Date:</b> {selectedEvaluation.created_at ? format(new Date(selectedEvaluation.created_at), 'yyyy-MM-dd') : '-'}</div>
              <div><b>Total:</b> {selectedEvaluation.total || '-'}</div>
              <div><b>Overall Assessment:</b> {selectedEvaluation.overall_assessment || '-'}</div>
              <div><b>Comments:</b> {selectedEvaluation.comments || '-'}</div>
              <div className="mt-2">
                <b>Assessment Breakdown:</b>
                <ul className="list-disc ml-6">
                  {Object.entries(selectedEvaluation).filter(([k]) => k.endsWith('_of_documents') || k.endsWith('_logbook') || k.endsWith('_skills') || k.endsWith('_tasks') || k === 'adaptability' || k === 'teamwork' || k === 'accomplishment' || k === 'presence' || k === 'mannerism' || k === 'oral_presentation').map(([k, v]) => (
                    <li key={k}><b>{k.replace(/_/g, ' ')}:</b> {v}</li>
                  ))}
                </ul>
              </div>
            </div>
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
                  const response = await fetch(`${API_BASE_URL}/messages/`, {
                    method: 'POST',
                    headers: {
                      'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                      'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                      receiver_id: selectedStudent.user_id || selectedStudent.profile?.id,
                      content: messageContent.trim(),
                    })
                  });
                  
                  if (response.ok) {
                    setMessageContent("");
                    setShowMessageModal(false);
                    toast({ title: "Message sent!" });
                  } else {
                    throw new Error('Failed to send message');
                  }
                } catch (err: any) {
                  toast({ title: "Error sending message", description: err.message, variant: "destructive" });
                } finally {
                  setMessageSending(false);
                }
              }}
              className="space-y-4"
            >
              <Label>To: {selectedStudent.profile?.first_name} {selectedStudent.profile?.last_name}</Label>
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
    </div>
  );
};

export default SupervisorDashboard;
