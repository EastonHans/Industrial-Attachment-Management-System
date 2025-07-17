import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileText, ClipboardList, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { verifyTranscript } from "@/utils/transcriptUtils";
import { generateIntroductoryLetter, generateInsuranceLetter, downloadLetter } from "@/utils/letterGenerator";
import { assignSupervisors } from "@/utils/supervisorAssignment";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ProfileSettings } from "@/components/ProfileSettings";
import { extractTextFromFile, parseBalanceFromText } from '@/utils/feeStatementUtils';
import { calculateDistance, getCoordinates } from '@/utils/locationUtils';
import AddressAutocomplete from '@/components/ui/AddressAutocomplete';
import { ReimbursementService } from "@/services/reimbursementService";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import WeeklyLogForm from "@/components/student/WeeklyLogForm";
import { NotificationPopover } from "@/components/ui/notification-popover";

// Add these constants at the top of the file
const DEFAULT_RATE = Number(import.meta.env.VITE_PUBLIC_REIMBURSEMENT_RATE) || 20;
const DEFAULT_LUNCH = Number(import.meta.env.VITE_PUBLIC_REIMBURSEMENT_LUNCH) || 200;

const StudentDashboard = () => {
  const { toast } = useToast();
  const [isEligible, setIsEligible] = useState<boolean | null>(null);
  const [progress, setProgress] = useState(0);
  const { currentUser, logout } = useAuth();
  const [studentDetails, setStudentDetails] = useState<any>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAttachmentDialogOpen, setIsAttachmentDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [assignedSupervisors, setAssignedSupervisors] = useState<any[]>([]);
  const [attachmentDetails, setAttachmentDetails] = useState({
    company_name: "",
    company_address: "",
    start_date: "",
    end_date: "",
    description: ""
  });
  const [reportDetails, setReportDetails] = useState({
    title: "",
    content: "",
    type: "weekly"
  });
  const [attachmentForm, setAttachmentForm] = useState({
    company_name: "",
    company_location: "",
    company_phone: "",
    company_email: "",
    company_website: "",
    supervisor_name: "",
    supervisor_email: "",
    start_date: "",
    end_date: "",
    attachment_period: ""
  });
  const [feeBalance, setFeeBalance] = useState("");
  const [feeStatementFile, setFeeStatementFile] = useState<File | null>(null);
  const [feeVerified, setFeeVerified] = useState<boolean | null>(null);
  const [feeCheckInProgress, setFeeCheckInProgress] = useState(false);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [reportForm, setReportForm] = useState({
    title: "",
    content: "",
    report_type: "weekly"
  });
  const [isEditing, setIsEditing] = useState(false);
  const [existingAttachment, setExistingAttachment] = useState<any>(null);
  const [weeklyLogs, setWeeklyLogs] = useState<any[]>([]);
  const [messages, setMessages] = useState<any[]>([]);
  const [replyContent, setReplyContent] = useState("");
  const [replySending, setReplySending] = useState(false);
  const [showReplyModal, setShowReplyModal] = useState(false);
  const [replyTo, setReplyTo] = useState<any>(null);
  const replyInputRef = useRef(null);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load verification status on component mount
  useEffect(() => {
    console.log('Current user ID on mount:', currentUser?.id); // Debug user ID
    const loadVerificationStatus = async () => {
      if (!currentUser?.id) return;

      try {
        const { data, error } = await supabase
          .from('verification_status')
          .select('*')
          .eq('student_id', currentUser.id)
          .single();

        if (error) {
          console.error('Error loading verification status:', error);
          return;
        }

        if (data) {
          setIsEligible(data.is_verified);
          setFeeVerified(data.fee_verified ?? null);
          
          // If student is eligible, try to assign supervisors
          if (data.is_verified) {
            try {
              console.log('Student is already eligible, attempting to assign supervisors');
              await assignSupervisors(currentUser.id);
              console.log('Supervisors assigned successfully');
            } catch (error: any) {
              console.error("Error assigning supervisors:", error);
              // Only show error if it's not about existing assignments
              if (!error.message.includes("Student already has supervisors assigned")) {
                if (error.message.includes("No active supervisors available")) {
                  toast({
                    title: "Supervisor Assignment Pending",
                    description: "You are eligible, but there are no active supervisors available. Please contact the administrator.",
                    variant: "default",
                  });
                } else if (error.message.includes("Not enough active supervisors")) {
                  toast({
                    title: "Supervisor Assignment Pending",
                    description: "You are eligible, but there are not enough active supervisors. Please contact the administrator.",
                    variant: "default",
                  });
                } else {
                  toast({
                    title: "Supervisor Assignment Failed",
                    description: "You are eligible, but there was an error assigning supervisors. Please contact support.",
                    variant: "destructive",
                  });
                }
              }
            }
          }
        }
      } catch (error) {
        console.error('Error in loadVerificationStatus:', error);
      }
    };

    loadVerificationStatus();
  }, [currentUser?.id]);

  // Load student details
  useEffect(() => {
    const loadStudentDetails = async () => {
      if (!currentUser?.id) return;

      try {
        const { data, error } = await supabase
          .from('students')
          .select('*')
          .eq('id', currentUser.id)
          .single();

        if (error) {
          console.error('Error loading student details:', error);
          return;
        }

        if (data) {
          setStudentDetails(data);
        }
      } catch (error) {
        console.error('Error in loadStudentDetails:', error);
      }
    };

    loadStudentDetails();
  }, [currentUser?.id]);

  // Load assigned supervisors
  useEffect(() => {
    const loadAssignedSupervisors = async () => {
      if (!currentUser?.id) return;

      try {
        console.log('Loading assigned supervisors for student:', currentUser.id);
        const { data, error } = await supabase
          .from('supervisor_assignments')
          .select(`
            id,
            status,
            supervisor:supervisors (
              id,
              department,
              title,
              profile:profiles (
                first_name,
                last_name,
                email
              )
            )
          `)
          .eq('student_id', currentUser.id);

        if (error) {
          console.error('Error loading assigned supervisors:', error);
          return;
        }

        console.log('Assigned supervisors data:', data);
        if (data) {
          setAssignedSupervisors(data);
        }
      } catch (error) {
        console.error('Error in loadAssignedSupervisors:', error);
      }
    };

    loadAssignedSupervisors();
  }, [currentUser?.id]);

  // Fetch attachments and reports for the current student
  useEffect(() => {
    const fetchLogs = async () => {
      if (!currentUser?.id) return;
      // Fetch attachments
      const { data: attachmentsData } = await supabase
        .from("attachments")
        .select("*, company:companies(*)")
        .eq("student_id", currentUser.id)
        .order("created_at", { ascending: false });
      setAttachments(attachmentsData || []);
    };
    fetchLogs();
  }, [currentUser?.id, isAttachmentDialogOpen, isReportDialogOpen]);

  // Check if student already has an attachment
  useEffect(() => {
    const checkExistingAttachment = async () => {
      if (!currentUser?.id) return;
      const { data } = await supabase
        .from("attachments")
        .select("*, company:companies(*)")
        .eq("student_id", currentUser.id)
        .single();
      if (data) {
        setExistingAttachment(data);
        setIsEditing(true);
        // Pre-fill the form with existing data
        setAttachmentForm({
          company_name: data.company?.name || "",
          company_location: data.company?.location || "",
          company_phone: data.company?.contact_phone || "",
          company_email: data.company?.contact_email || "",
          company_website: "",
          supervisor_name: "",
          supervisor_email: "",
          start_date: data.start_date || "",
          end_date: data.end_date || "",
          attachment_period: data.attachment_period || ""
        });
      }
    };
    checkExistingAttachment();
  }, [currentUser?.id]);

  // Fetch weekly logs for the current student
  useEffect(() => {
    const fetchWeeklyLogs = async () => {
      if (!currentUser?.id) return;
      const { data } = await supabase
        .from("weekly_logs")
        .select("*")
        .eq("student_id", currentUser.id)
        .order("date", { ascending: false });
      setWeeklyLogs(data || []);
    };
    fetchWeeklyLogs();
  }, [currentUser?.id]);

  // Fetch received messages for student
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

  // Handle file selection
  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      setSelectedFile(event.target.files[0]);
      // Automatically start processing when a file is selected
      handleUploadTranscript(event.target.files[0]);
    }
  };

  // Trigger file input click
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // Verify transcript with the actual file
  const handleUploadTranscript = async (file: File) => {
    if (!file || !currentUser?.id) return;

    toast({
      title: "Processing Transcript",
      description: "Your transcript is being analyzed for eligibility...",
    });
    
    // Show progress indicator
    let currentProgress = 10;
    setProgress(currentProgress);
    
    const progressInterval = setInterval(() => {
      if (currentProgress < 90) {
        currentProgress += 10;
        setProgress(currentProgress);
      }
    }, 500);
    
    try {
      // Verify the transcript with the actual file
      if (!studentDetails) {
        clearInterval(progressInterval);
        toast({
          title: "Verification Failed",
          description: "Student details are not available.",
          variant: "destructive",
        });
        return;
      }
      
      const fullName = `${currentUser?.firstName || ''} ${currentUser?.lastName || ''}`;
      console.log(`Starting transcript verification for student: ${fullName}`);
      
      const result = await verifyTranscript(
        file,
        fullName.trim(),
        studentDetails.program,
        studentDetails.year_of_study
      );
      
      setProgress(100);
      clearInterval(progressInterval);
      
      console.log("Transcript verification result:", result);
      
      // Save verification status to Supabase
      const { error: upsertError } = await supabase
        .from('verification_status')
        .upsert({
          student_id: currentUser.id,
          is_verified: result.eligible,
          verification_details: result,
          verification_date: new Date().toISOString()
        }, { onConflict: 'student_id' });

      if (upsertError) {
        console.error('Error saving verification status:', upsertError);
        toast({
          title: "Error",
          description: "Failed to save verification status. Please try again.",
          variant: "destructive",
        });
        return;
      }
      
      setIsEligible(result.eligible);
      
      // If student is eligible, automatically assign supervisors
      if (result.eligible) {
        try {
          console.log('Attempting to assign supervisors for eligible student:', currentUser.id);
          await assignSupervisors(currentUser.id);
          console.log('Supervisors assigned successfully');
          toast({
            title: "Supervisors Assigned",
            description: "Two supervisors have been automatically assigned to you.",
          });
        } catch (error: any) {
          console.error("Error assigning supervisors:", error);
          // Show a more informative error message
          if (error.message.includes("No active supervisors available")) {
            toast({
              title: "Supervisor Assignment Pending",
              description: "You are eligible, but there are no active supervisors available. Please contact the administrator.",
              variant: "default",
            });
          } else if (error.message.includes("Not enough active supervisors")) {
            toast({
              title: "Supervisor Assignment Pending",
              description: "You are eligible, but there are not enough active supervisors. Please contact the administrator.",
              variant: "default",
            });
          } else {
            toast({
              title: "Supervisor Assignment Failed",
              description: "You are eligible, but there was an error assigning supervisors. Please contact support.",
              variant: "destructive",
            });
          }
        }
      }
      
      // Show detailed verification results
      if (result.eligible) {
        toast({
          title: "Verification Successful",
          description: "You are eligible for industrial attachment.",
        });
      } else {
        let failureReason = "You do not meet the requirements for industrial attachment.\n";
        
        if (!result.nameMatched) {
          failureReason += "• Name on transcript doesn't match your account.\n";
        }
        
        if (!result.meetsYearRequirement) {
          failureReason += "• You haven't reached the required year and semester.\n";
        }
        
        if (!result.meetsUnitRequirement) {
          failureReason += `• You have ${result.completedUnits} units but need ${result.requiredUnits}.\n`;
        }
        
        if (result.hasIncompleteUnits) {
          failureReason += "• You have incomplete units (marked with I, X, or Z).\n";
        }
        
        toast({
          title: "Verification Failed",
          description: failureReason,
          variant: "destructive",
        });
      }
    } catch (error: any) {
      clearInterval(progressInterval);
      setProgress(0);
      console.error("Error verifying transcript:", error);
      toast({
        title: "Verification Error",
        description: error.message || "Failed to process transcript",
        variant: "destructive",
      });
    }
  };

  // Handle downloading introductory letter
  const handleDownloadIntroductoryLetter = () => {
    if (!currentUser || !studentDetails) return;
    const letter = generateIntroductoryLetter(
      `${currentUser.firstName} ${currentUser.lastName}`,
      currentUser.id,
      studentDetails.program,
      studentDetails.year_of_study,
      attachmentForm.attachment_period || "[Period]"
    );
    downloadLetter(letter, 'introductory_letter.pdf');
    toast({
      title: "Download Started",
      description: "Your introductory letter is being downloaded...",
    });
  };

  // Handle downloading insurance letter
  const handleDownloadInsuranceLetter = () => {
    if (!currentUser || !studentDetails) return;
    const letter = generateInsuranceLetter(
      `${currentUser.firstName} ${currentUser.lastName}`,
      currentUser.id,
      studentDetails.program
    );
    downloadLetter(letter, 'insurance_cover_letter.pdf');
    toast({
      title: "Download Started",
      description: "Your insurance cover letter is being downloaded...",
    });
  };

  // Handle tab navigation
  const navigateToTab = (tabValue: string) => {
    const tabElement = document.querySelector(`button[value="${tabValue}"]`) as HTMLButtonElement;
    if (tabElement) {
      tabElement.click();
    }
  };

  // Google Maps JS API helper for driving distance
  const getDrivingDistance = (origin: string, destination: string): Promise<number> => {
    return new Promise((resolve, reject) => {
      if (!window.google || !window.google.maps || !window.google.maps.DirectionsService) {
        reject(new Error("Google Maps DirectionsService not available"));
        return;
      }
      const directionsService = new window.google.maps.DirectionsService();
      directionsService.route(
        {
          origin,
          destination,
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK" && result.routes[0] && result.routes[0].legs[0]) {
            const distance = result.routes[0].legs[0].distance.value / 1000; // in km
            resolve(distance);
          } else {
            reject(new Error("Could not get driving distance"));
          }
        }
      );
    });
  };

  // Update handleAttachmentSubmit to use new fields and reimbursement logic
  const handleAttachmentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    const details = {
      company_name: attachmentForm.company_name,
      company_location: attachmentForm.company_location,
      company_phone: attachmentForm.company_phone,
      company_email: attachmentForm.company_email,
      company_website: attachmentForm.company_website,
      supervisor_name: attachmentForm.supervisor_name,
      supervisor_email: attachmentForm.supervisor_email,
      start_date: attachmentForm.start_date,
      end_date: attachmentForm.end_date,
      attachment_period: attachmentForm.attachment_period
    };
    if (!details.company_location || !details.company_name) {
      toast({ title: "Required", description: "Please fill all required fields.", variant: "destructive" });
      return;
    }
    try {
      // 1. Upsert company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .upsert({
          name: details.company_name,
          location: details.company_location,
          contact_phone: details.company_phone,
          contact_email: details.company_email,
        })
        .select()
        .single();
      if (companyError) throw companyError;
      // 2. Create attachment
      const { data: attachment, error: attachmentError } = await supabase
        .from("attachments")
        .insert({
          student_id: currentUser.id,
          company_id: company.id,
          start_date: details.start_date || null,
          end_date: details.end_date || null,
          status: "approved",
          attachment_period: details.attachment_period
        })
        .select()
        .single();
      if (attachmentError) throw attachmentError;
      // 3. Ensure supervisors are assigned
      let { data: supervisorAssignments, error: supervisorError } = await supabase
        .from("supervisor_assignments")
        .select("supervisor_id")
        .eq("student_id", currentUser.id);
      let supervisorIds = (supervisorAssignments || []).map((a: any) => a.supervisor_id);
      if (!supervisorIds.length) {
        // Try to assign supervisors if none are assigned
        try {
          await assignSupervisors(currentUser.id);
          // Fetch again
          const { data: newAssignments } = await supabase
            .from("supervisor_assignments")
            .select("supervisor_id")
            .eq("student_id", currentUser.id);
          supervisorIds = (newAssignments || []).map((a: any) => a.supervisor_id);
        } catch (err) {
          toast({ title: "Supervisor Assignment Failed", description: "Could not assign supervisors. Please contact admin.", variant: "destructive" });
          console.error("Supervisor assignment error:", err);
          return;
        }
      }
      if (!supervisorIds.length) {
        toast({ title: "No supervisors assigned", description: "Cannot create reimbursements without assigned supervisors.", variant: "destructive" });
        console.error("No supervisors found for reimbursement.");
        return;
      }
      // 4. Calculate distance and create reimbursement for supervisors
      const cueaAddress = "Catholic University of Eastern Africa, Bogani East Road, Nairobi, Kenya";
      let distance = await getDrivingDistance(cueaAddress, details.company_location);
      if (!distance) {
        // fallback to Haversine if Directions API fails
        const cueaCoords = { lat: -1.2921, lng: 36.8219 };
        const companyCoords = await getCoordinates(details.company_location);
        if (!companyCoords) throw new Error("Could not get company coordinates");
        distance = calculateDistance(
          cueaCoords.lat,
          cueaCoords.lng,
          companyCoords.lat,
          companyCoords.lng
        ) * 2;
      }
      const amount = (DEFAULT_RATE * (distance * 2)) + DEFAULT_LUNCH;
      const reimbursements = supervisorIds.map((supervisorId: string) => ({
        supervisor_id: supervisorId,
        student_id: currentUser.id,
        company_id: company.id,
        amount,
        rate: DEFAULT_RATE,
        lunch: DEFAULT_LUNCH,
        distance,
        status: "approved",
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }));
      const { error: reimbursementError } = await supabase
        .from("reimbursements")
        .insert(reimbursements);
      if (reimbursementError) {
        toast({ title: "Reimbursement Error", description: reimbursementError.message, variant: "destructive" });
        console.error("Reimbursement creation error:", reimbursementError);
        return;
      }
      toast({ title: "Success", description: "Attachment details submitted and reimbursements created." });
      setIsAttachmentDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      console.error("Attachment submit error:", error);
    }
  };

  // Handle edit submission
  const handleEditAttachment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id || !existingAttachment) return;
    try {
      // Update company details
      const { error: companyError } = await supabase
        .from("companies")
        .update({
          name: attachmentForm.company_name,
          location: attachmentForm.company_location,
          contact_phone: attachmentForm.company_phone,
          contact_email: attachmentForm.company_email,
        })
        .eq("id", existingAttachment.company_id);
      if (companyError) throw companyError;
      // Update attachment details
      const { error: attachmentError } = await supabase
        .from("attachments")
        .update({
          start_date: attachmentForm.start_date || null,
          end_date: attachmentForm.end_date || null,
          attachment_period: attachmentForm.attachment_period
        })
        .eq("id", existingAttachment.id);
      if (attachmentError) throw attachmentError;
      toast({ title: "Success", description: "Attachment details updated successfully." });
      // Refresh the attachments list
      const { data: attachmentsData } = await supabase
        .from("attachments")
        .select("*, company:companies(*)")
        .eq("student_id", currentUser.id)
        .order("created_at", { ascending: false });
      setAttachments(attachmentsData || []);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  // Handle fee statement upload and verification
  const handleFeeStatementUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;
    const file = e.target.files[0];
    setFeeStatementFile(file);
    setFeeCheckInProgress(true);
    setFeeError(null);
    try {
      // Fetch current verification status for this student
      const { data: currentStatus, error: statusError } = await supabase
        .from('verification_status')
        .select('fee_verified, is_verified')
        .eq('student_id', currentUser.id)
        .maybeSingle();

      if (statusError) {
        console.error('Error fetching verification status:', statusError);
      }

      const text = await extractTextFromFile(file);
      const balance = parseBalanceFromText(text);

      // Default to false if not present
      const is_verified = currentStatus?.is_verified ?? false;

      if (balance !== null && balance === 0) {
        setFeeVerified(true);
        setFeeError(null);
        // Persist fee verification status to Supabase
        await supabase
          .from('verification_status')
          .upsert({
            student_id: currentUser.id,
            fee_verified: true,
            is_verified, // always include!
            fee_verification_date: new Date().toISOString(),
          }, { onConflict: 'student_id' });
        toast({ title: "Fee Statement Verified", description: "Your fee balance is zero. You may proceed." });
      } else if (balance !== null) {
        setFeeVerified(false);
        setFeeError(`Your fee balance is not zero (Balance: ${balance}). Please clear your balance before proceeding.`);
        // Only update to false if not previously verified
        if (!currentStatus?.fee_verified) {
          await supabase
            .from('verification_status')
            .upsert({
              student_id: currentUser.id,
              fee_verified: false,
              is_verified, // always include!
              fee_verification_date: new Date().toISOString(),
            }, { onConflict: 'student_id' });
        }
        toast({ title: "Fee Statement Not Verified", description: `Your fee balance is not zero (Balance: ${balance}).`, variant: "destructive" });
      } else {
        setFeeVerified(false);
        setFeeError("Could not find a balance in your fee statement. Please upload a valid statement.");
        if (!currentStatus?.fee_verified) {
          await supabase
            .from('verification_status')
            .upsert({
              student_id: currentUser.id,
              fee_verified: false,
              is_verified, // always include!
              fee_verification_date: new Date().toISOString(),
            }, { onConflict: 'student_id' });
        }
        toast({ title: "Fee Statement Not Verified", description: "Could not find a balance in your fee statement.", variant: "destructive" });
      }
    } catch (err: any) {
      setFeeVerified(false);
      setFeeError("Failed to process fee statement: " + err.message);
      toast({ title: "Fee Statement Error", description: err.message, variant: "destructive" });
    }
    setFeeCheckInProgress(false);
  };

  const getPeriodForDate = (date: string) => {
    if (!date) return "";
    const month = new Date(date).getMonth() + 1;
    if (month >= 1 && month <= 4) return "Jan-Apr";
    if (month >= 5 && month <= 8) return "May-Aug";
    if (month >= 9 && month <= 12) return "Sep-Dec";
    return "";
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
          <h1 className="text-xl font-semibold text-gray-900">Student Dashboard</h1>
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
                <CardTitle>{currentUser ? `${currentUser.firstName} ${currentUser.lastName}` : "Loading..."}</CardTitle>
                <CardDescription>
                  Student ID: {studentDetails?.student_id || "Loading..."}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium">Attachment Status</p>
                    <p className="text-sm text-muted-foreground">
                      {isEligible === null
                        ? "Not Verified"
                        : isEligible
                        ? "Eligible"
                        : "Not Eligible"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Fee Statement</p>
                    <p className="text-sm text-muted-foreground">
                      {feeVerified === null ? "Not Verified" : feeVerified ? "Verified" : "Not Verified"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Program</p>
                    <p className="text-sm text-muted-foreground">{studentDetails?.program || "Loading..."}</p>
                  </div>
                  <div>
                    <p className="text-sm font-medium">Year & Semester</p>
                    <p className="text-sm text-muted-foreground">
                      Year {studentDetails?.year_of_study || "..."}, Semester 2
                    </p>
                  </div>
                  {assignedSupervisors.length > 0 && (
                    <div>
                      <p className="text-sm font-medium">Assigned Supervisors</p>
                      <div className="mt-2 space-y-2">
                        {assignedSupervisors.map((assignment) => (
                          <div key={assignment.id} className="text-sm text-muted-foreground">
                            <p>{assignment.supervisor.profile.first_name} {assignment.supervisor.profile.last_name} - {assignment.supervisor.title} ({assignment.supervisor.department})</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {studentDetails?.phone_number && (
                    <div>Phone Number: {studentDetails.phone_number}</div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content */}
          <div className="w-full md:w-3/4">
            <Tabs defaultValue="eligibility" className="w-full">
              <TabsList className="grid grid-cols-4 mb-8">
                <TabsTrigger value="eligibility">Eligibility</TabsTrigger>
                <TabsTrigger value="attachment" disabled={!(isEligible && feeVerified)}>
                  Attachment
                </TabsTrigger>
                <TabsTrigger value="weeklylog" disabled={!(isEligible && feeVerified)}>
                  Weekly Log
                </TabsTrigger>
                <TabsTrigger value="settings">Settings</TabsTrigger>
              </TabsList>

              {/* Eligibility Tab: show letter download if eligible, else show verification */}
              <TabsContent value="eligibility">
                {isEligible && feeVerified ? (
                  <div className="flex flex-col items-center justify-center gap-6 py-16">
                    <h2 className="text-2xl font-bold">Congratulations! You are eligible for attachment.</h2>
                    <div className="flex gap-4">
                      <Button onClick={handleDownloadIntroductoryLetter}>
                        <Download className="mr-2 h-4 w-4" /> Download Introductory Letter
                      </Button>
                      <Button onClick={handleDownloadInsuranceLetter} variant="outline">
                        <Download className="mr-2 h-4 w-4" /> Download Insurance Letter
                      </Button>
                    </div>
                    <p className="text-muted-foreground text-center max-w-xl">
                      Please download and print your letters. Submit them to your attachment institution as required.
                    </p>
                  </div>
                ) : (
                  <Card>
                    <CardHeader>
                      <CardTitle>Eligibility Verification</CardTitle>
                      <CardDescription>
                        Upload your transcript and fee statement to verify your eligibility for industrial attachment
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-6">
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="mt-4">
                            <p className="text-sm text-gray-500">
                              {selectedFile 
                                ? `Selected: ${selectedFile.name}` 
                                : "Drag and drop your transcript file, or"}
                            </p>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              onChange={handleFileChange}
                            />
                            <Button 
                              variant="outline" 
                              className="mt-2"
                              onClick={triggerFileInput}
                            >
                              Browse Files
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            PDF, JPEG or PNG up to 10MB
                          </p>
                        </div>
                        
                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                          <Upload className="mx-auto h-12 w-12 text-gray-400" />
                          <div className="mt-4">
                            <p className="text-sm text-gray-500">
                              {feeStatementFile 
                                ? `Selected: ${feeStatementFile.name}` 
                                : "Drag and drop your fee statement, or"}
                            </p>
                            <input
                              type="file"
                              accept=".pdf,.jpg,.jpeg,.png"
                              className="hidden"
                              id="fee-statement-upload"
                              onChange={handleFeeStatementUpload}
                            />
                            <Button 
                              variant="outline" 
                              className="mt-2"
                              onClick={() => document.getElementById('fee-statement-upload')?.click()}
                            >
                              Browse Files
                            </Button>
                          </div>
                          <p className="mt-2 text-xs text-gray-500">
                            PDF, JPEG or PNG up to 10MB
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              {/* Attachment Tab */}
              <TabsContent value="attachment">
                <Card>
                  <CardHeader>
                    <CardTitle>Attachment Details</CardTitle>
                    <CardDescription>
                      {isEditing 
                        ? "Edit your company details for your attachment process."
                        : "Submit your company details to begin your attachment process."
                      }
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {(!attachmentForm.attachment_period || (attachmentForm.start_date && getPeriodForDate(attachmentForm.start_date) !== attachmentForm.attachment_period)) && (
                      <div className="mb-4 p-3 bg-yellow-100 border border-yellow-300 rounded text-yellow-800">
                        { !attachmentForm.attachment_period
                          ? "Please select your attachment period. This is required."
                          : `Warning: The selected period (${attachmentForm.attachment_period}) does not match the start date (${attachmentForm.start_date}).` }
                      </div>
                    )}
                    {isEditing ? (
                      <form onSubmit={handleEditAttachment} className="space-y-4 mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium">Name of Institution *</label>
                            <input type="text" className="input" value={attachmentForm.company_name} onChange={e => setAttachmentForm(f => ({ ...f, company_name: e.target.value }))} required />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Physical Location *</label>
                            <input type="text" className="input" value={attachmentForm.company_location} onChange={e => setAttachmentForm(f => ({ ...f, company_location: e.target.value }))} required />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Telephone *</label>
                            <input type="text" className="input" value={attachmentForm.company_phone} onChange={e => setAttachmentForm(f => ({ ...f, company_phone: e.target.value }))} required />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Email</label>
                            <input type="email" className="input" value={attachmentForm.company_email} onChange={e => setAttachmentForm(f => ({ ...f, company_email: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Start Date</label>
                            <input type="date" className="input" value={attachmentForm.start_date} onChange={e => setAttachmentForm(f => ({ ...f, start_date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">End Date</label>
                            <input type="date" className="input" value={attachmentForm.end_date} onChange={e => setAttachmentForm(f => ({ ...f, end_date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Attachment Period *</label>
                            <select
                              className="input"
                              value={attachmentForm.attachment_period}
                              onChange={e => setAttachmentForm(f => ({ ...f, attachment_period: e.target.value }))}
                              required
                            >
                              <option value="">Select Period</option>
                              <option value="Jan-Apr">Jan - Apr</option>
                              <option value="May-Aug">May - Aug</option>
                              <option value="Sep-Dec">Sep - Dec</option>
                            </select>
                          </div>
                        </div>
                        <Button type="submit">Update Attachment Details</Button>
                      </form>
                    ) : (
                      <form onSubmit={handleAttachmentSubmit} className="space-y-4 mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium">Name of Institution *</label>
                            <input type="text" className="input" value={attachmentForm.company_name} onChange={e => setAttachmentForm(f => ({ ...f, company_name: e.target.value }))} required />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Physical Location *</label>
                            <input type="text" className="input" value={attachmentForm.company_location} onChange={e => setAttachmentForm(f => ({ ...f, company_location: e.target.value }))} required />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Telephone *</label>
                            <input type="text" className="input" value={attachmentForm.company_phone} onChange={e => setAttachmentForm(f => ({ ...f, company_phone: e.target.value }))} required />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Email</label>
                            <input type="email" className="input" value={attachmentForm.company_email} onChange={e => setAttachmentForm(f => ({ ...f, company_email: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Website</label>
                            <input type="text" className="input" value={attachmentForm.company_website} onChange={e => setAttachmentForm(f => ({ ...f, company_website: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Name of Institution Supervisor</label>
                            <input type="text" className="input" value={attachmentForm.supervisor_name} onChange={e => setAttachmentForm(f => ({ ...f, supervisor_name: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Supervisor Email</label>
                            <input type="email" className="input" value={attachmentForm.supervisor_email} onChange={e => setAttachmentForm(f => ({ ...f, supervisor_email: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Start Date</label>
                            <input type="date" className="input" value={attachmentForm.start_date} onChange={e => setAttachmentForm(f => ({ ...f, start_date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">End Date</label>
                            <input type="date" className="input" value={attachmentForm.end_date} onChange={e => setAttachmentForm(f => ({ ...f, end_date: e.target.value }))} />
                          </div>
                          <div>
                            <label className="block text-sm font-medium">Attachment Period *</label>
                            <select
                              className="input"
                              value={attachmentForm.attachment_period}
                              onChange={e => setAttachmentForm(f => ({ ...f, attachment_period: e.target.value }))}
                              required
                            >
                              <option value="">Select Period</option>
                              <option value="Jan-Apr">Jan - Apr</option>
                              <option value="May-Aug">May - Aug</option>
                              <option value="Sep-Dec">Sep - Dec</option>
                            </select>
                          </div>
                        </div>
                        <Button type="submit">Submit Attachment Details</Button>
                      </form>
                    )}
                    <h3 className="font-semibold mb-2">Previous Attachments</h3>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Institution</TableHead>
                          <TableHead>Location</TableHead>
                          <TableHead>Phone</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Start Date</TableHead>
                          <TableHead>End Date</TableHead>
                          <TableHead>Date</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {attachments.length === 0 ? (
                          <TableRow><TableCell colSpan={7}>No attachments found.</TableCell></TableRow>
                        ) : (
                          attachments.map(att => (
                            <TableRow key={att.id}>
                              <TableCell>{att.company?.name || '-'}</TableCell>
                              <TableCell>{att.company?.location || '-'}</TableCell>
                              <TableCell>{att.company?.contact_phone || '-'}</TableCell>
                              <TableCell>{att.status}</TableCell>
                              <TableCell>{att.start_date || '-'}</TableCell>
                              <TableCell>{att.end_date || '-'}</TableCell>
                              <TableCell>{att.created_at ? new Date(att.created_at).toLocaleDateString() : '-'}</TableCell>
                            </TableRow>
                          ))
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Weekly Log Tab */}
              <TabsContent value="weeklylog">
                <WeeklyLogForm onSubmitted={() => {
                  // Refresh logs after submission
                  supabase
                    .from("weekly_logs")
                    .select("*")
                    .eq("student_id", currentUser?.id)
                    .order("date", { ascending: false })
                    .then(({ data }) => setWeeklyLogs(data || []));
                }} />
                <div className="mt-8">
                  <h3 className="font-semibold mb-2">Previous Weekly Logs</h3>
                  <div className="space-y-2">
                    {weeklyLogs.length === 0 ? (
                      <p className="text-muted-foreground">No logs found.</p>
                    ) : (
                      <table className="min-w-full border text-sm">
                        <thead>
                          <tr>
                            <th>Date</th>
                            <th>Day</th>
                            <th>Week</th>
                            <th>Task Assigned</th>
                            <th>Attachee Remarks</th>
                          </tr>
                        </thead>
                        <tbody>
                          {weeklyLogs.map(log => (
                            <tr key={log.id}>
                              <td>{log.date}</td>
                              <td>{log.day}</td>
                              <td>{log.week_number}</td>
                              <td>{log.task_assigned}</td>
                              <td>{log.attachee_remarks}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </div>
              </TabsContent>

              {/* Settings Tab */}
              <TabsContent value="settings">
                <ProfileSettings role="student" />
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Inbox</CardTitle>
                    <CardDescription>Messages sent to you</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {messages.length === 0 ? (
                      <p className="text-muted-foreground">No messages received.</p>
                    ) : (
                      <ul className="space-y-2">
                        {messages.map(msg => (
                          <li key={msg.id} className="border rounded p-2">
                            <div className="font-semibold">From: {msg.sender?.first_name} {msg.sender?.last_name}</div>
                            <div className="text-sm text-muted-foreground">{msg.content}</div>
                            <div className="text-xs text-gray-400">{msg.created_at ? new Date(msg.created_at).toLocaleString() : ""}</div>
                            <Button size="sm" variant="outline" className="mt-2" onClick={() => { setReplyTo(msg); setShowReplyModal(true); }}>Reply</Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </main>

      {/* Reply Modal */}
      <Dialog open={showReplyModal} onOpenChange={setShowReplyModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reply to {replyTo?.sender?.first_name} {replyTo?.sender?.last_name}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!replyContent.trim() || !replyTo?.sender?.id) return;
              setReplySending(true);
              try {
                await supabase.from("messages").insert({
                  sender_id: currentUser.id,
                  receiver_id: replyTo.sender.id,
                  content: replyContent.trim(),
                });
                setReplyContent("");
                setShowReplyModal(false);
                setReplyTo(null);
                toast({ title: "Reply sent!" });
              } catch (err) {
                toast({ title: "Error sending reply", description: err.message, variant: "destructive" });
              } finally {
                setReplySending(false);
              }
            }}
            className="space-y-4"
          >
            <Label>To: {replyTo?.sender?.first_name} {replyTo?.sender?.last_name}</Label>
            <textarea
              ref={replyInputRef}
              className="w-full border rounded p-2"
              rows={5}
              placeholder="Type your reply..."
              value={replyContent}
              onChange={e => setReplyContent(e.target.value)}
              required
            />
            <Button type="submit" disabled={replySending}>{replySending ? "Sending..." : "Send Reply"}</Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default StudentDashboard;

