import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ClipboardList, Bell, FileText, Users } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Database } from "@/integrations/supabase/types";
import { ProfileSettings } from "@/components/ProfileSettings";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import EvaluationForm from "@/components/supervisor/EvaluationForm";
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { format } from 'date-fns';
import { NotificationPopover } from "@/components/ui/notification-popover";

type Supervisor = Database["public"]["Tables"]["supervisors"]["Row"] & {
  profile: Database["public"]["Tables"]["profiles"]["Row"];
};

type Student = Database["public"]["Tables"]["students"]["Row"] & {
  profile: Database["public"]["Tables"]["profiles"]["Row"];
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
  profile: Array<Database["public"]["Tables"]["profiles"]["Row"]> | Database["public"]["Tables"]["profiles"]["Row"];
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
function getCompanyName(company: any): string {
  if (!company) return 'No company info submitted';
  if (Array.isArray(company)) return company[0]?.name || 'N/A';
  return company.name || 'N/A';
}
function getCompanyLocation(company: any): string {
  if (!company) return 'No company info submitted';
  if (Array.isArray(company)) return company[0]?.location || company[0]?.address || 'N/A';
  return company.location || company.address || 'N/A';
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
  const [messages, setMessages] = useState<any[]>([]);
  const messageInputRef = useRef(null);
  const [attachmentsByStudent, setAttachmentsByStudent] = useState<Record<string, any>>({});
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    const fetchSupervisorData = async () => {
      if (!currentUser) {
        setLoading(false);
        return;
      }

      try {
        console.log("Fetching supervisor data for user:", currentUser.id);
        
        // Fetch supervisor details
        const { data: supervisorData, error: supervisorError } = await supabase
          .from("supervisors")
          .select(`
            *,
            profile:profiles(*)
          `)
          .eq("id", currentUser.id)
          .single();

        if (supervisorError) {
          console.error("Error fetching supervisor:", supervisorError);
          throw supervisorError;
        }

        if (!supervisorData) {
          throw new Error("Supervisor not found");
        }

        console.log("Supervisor data:", supervisorData);
        setSupervisor(supervisorData);

        // Fetch assigned students
        const { data: assignmentsData, error: assignmentsError } = await supabase
          .from("supervisor_assignments")
          .select(`
            id,
            status,
            student:students(
              id,
              student_id,
              program,
              year_of_study,
              profile:profiles(
                id,
                first_name,
                last_name,
                email,
                phone_number
              )
            )
          `)
          .eq("supervisor_id", currentUser.id);

        if (assignmentsError) {
          console.error("Error fetching assignments:", assignmentsError);
          throw assignmentsError;
        }

        if (assignmentsData) {
          console.log("Assignments data:", assignmentsData);
          const studentsList = assignmentsData
            .map(a => {
              let student = getFirst(a.student) as SupabaseStudentJoin | null;
              if (!student || typeof student !== 'object') return null;
              const profile = getFirst(student.profile) as Database["public"]["Tables"]["profiles"]["Row"] | null;
              return {
                id: student.id,
                student_id: student.student_id,
                program: student.program,
                year_of_study: student.year_of_study,
                created_at: student.created_at ?? '',
                updated_at: student.updated_at ?? '',
                profile: profile as Database["public"]["Tables"]["profiles"]["Row"],
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
      if (!currentUser) return;
      const { data, error } = await supabase
        .from('evaluations')
        .select(`*, student:students(id, student_id, profile:profiles(id, first_name, last_name)), created_at`)
        .eq('supervisor_id', currentUser.id)
        .order('created_at', { ascending: false });
      if (!error && data) setEvaluations(data);
    };
    fetchEvaluations();
  }, [currentUser]);

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

  useEffect(() => {
    if (students.length === 0) return;
    const fetchAllAttachments = async () => {
      const studentIds = students.map(s => s.id);
      const { data, error } = await supabase
        .from('attachments')
        .select('*, company:companies(name, location, address)')
        .in('student_id', studentIds);
      if (!error && data) {
        const map: Record<string, any> = {};
        data.forEach(att => { map[att.student_id] = att; });
        setAttachmentsByStudent(map);
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
        // Fetch logs
        const { data: logs } = await supabase
          .from("weekly_logs")
          .select("*")
          .eq("student_id", student.id)
          .order("date", { ascending: true });
        setStudentLogs(logs || []);
        // Fetch attachment and company
        const { data: attachment } = await supabase
          .from("attachments")
          .select("*, company:companies(name, location, address)")
          .eq("student_id", student.id)
          .single();
        console.log('Attachment:', attachment);
        if (attachment && attachment.company) {
          console.log('Company:', attachment.company);
        }
        setStudentAttachment(attachment || null);
      }
    }
  };

  const openEvaluationModal = (studentId: string, week: number) => {
    setEvalStudentId(studentId);
    setEvalWeek(week);
    setShowEvalModal(true);
    // Fetch the log entry for this student and week
    supabase
      .from("weekly_logs")
      .select("*")
      .eq("student_id", studentId)
      .eq("week_number", week)
      .single()
      .then(({ data }) => setEvalLog(data));
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
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Supervisor Dashboard</h1>
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
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-1/4">
            <Card>
              <CardHeader>
                <CardTitle>{supervisor.profile.first_name} {supervisor.profile.last_name}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Department</p>
                    <p className="text-sm text-muted-foreground">{supervisor.department}</p>
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
                            <TableHead>Program</TableHead>
                            <TableHead>Year</TableHead>
                            <TableHead>Company</TableHead>
                            <TableHead>Company Location</TableHead>
                            <TableHead>Action</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {students.map((student) => (
                            <TableRow key={student.id}>
                              <TableCell>{student.student_id}</TableCell>
                              <TableCell>{student.profile?.first_name || 'N/A'} {student.profile?.last_name || ''}</TableCell>
                              <TableCell>{student.program}</TableCell>
                              <TableCell>{student.year_of_study}</TableCell>
                              <TableCell>{getCompanyName(attachmentsByStudent[student.id]?.company)}</TableCell>
                              <TableCell>{getCompanyLocation(attachmentsByStudent[student.id]?.company)}</TableCell>
                              <TableCell>
                                <Button 
                                  variant="outline" 
                                  size="sm"
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
                                  View Details
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    setEvalStudentId(student.id);
                                    setShowEvalModal(true);
                                    supabase
                                      .from("weekly_logs")
                                      .select("*")
                                      .eq("student_id", student.id)
                                      .order("week_number", { ascending: true })
                                      .then(({ data }) => setEvalLog(data || []));
                                  }}
                                >
                                  Evaluate
                                </Button>
                              </TableCell>
                              <TableCell>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => { setSelectedStudent(student); setShowMessageModal(true); }}
                                >
                                  Message
                                </Button>
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
                              {studentAttachment?.company
                                ? (Array.isArray(studentAttachment.company)
                                    ? (studentAttachment.company[0]?.name || 'N/A')
                                    : (studentAttachment.company.name || 'N/A'))
                                : 'No company info submitted'}
                            </p>
                          </div>
                          <div>
                            <p className="text-sm font-medium">Company Location</p>
                            <p className="text-sm text-muted-foreground">
                              {studentAttachment?.company
                                ? (Array.isArray(studentAttachment.company)
                                    ? (studentAttachment.company[0]?.location || studentAttachment.company[0]?.address || 'N/A')
                                    : (studentAttachment.company.location || studentAttachment.company.address || 'N/A'))
                                : 'No company info submitted'}
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
                                  const { data } = await supabase
                                    .from("weekly_logs")
                                    .select("*")
                                    .eq("student_id", selectedStudent.id)
                                    .order("week_number", { ascending: true });
                                  setStudentLogs(data || []);
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
                              <TableCell>{ev.student?.profile?.first_name || ''} {ev.student?.profile?.last_name || ''}</TableCell>
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
              <div><b>Student:</b> {selectedEvaluation.student?.profile?.first_name || ''} {selectedEvaluation.student?.profile?.last_name || ''}</div>
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
                  await supabase.from("messages").insert({
                    sender_id: currentUser.id,
                    receiver_id: selectedStudent.profile?.id,
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
