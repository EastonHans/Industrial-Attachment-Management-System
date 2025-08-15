import { useState, useEffect, useRef } from "react";
import DocumentVerificationTabs from "@/components/DocumentVerificationTabs";
import { Button } from "@/components/ui/button";
import { simpleTokenManager } from "@/utils/simpleTokenManager";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Upload, Download, FileText, ClipboardList, Bell } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext_django";
import { supabase, API_BASE_URL, tokenManager } from "@/services/djangoApi";
// import { processTranscriptFile } from "@/utils/enhancedTranscriptProcessor"; // Disabled, handled via backend API in DocumentVerificationTabs
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
import NavBar from "@/components/layout/NavBar";

// Get dynamic rates from localStorage (set by admin) or fallback to env
const getGlobalRate = () => Number(localStorage.getItem('globalRate')) || Number(import.meta.env.VITE_PUBLIC_REIMBURSEMENT_RATE) || 20;
const getGlobalLunch = () => Number(localStorage.getItem('globalLunch')) || Number(import.meta.env.VITE_PUBLIC_REIMBURSEMENT_LUNCH) || 200;

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
  const replyInputRef = useRef(null);

  // Function to refresh verification status (used as callback)
  const refreshVerificationStatus = async () => {
    if (!currentUser?.id) return;

    try {
      const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://localhost:8080/api';
      const token = simpleTokenManager.getAccessToken();
      const response = await fetch(`${API_BASE_URL}/documents/status/`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        console.error('Error loading verification status:', response.status);
        return;
      }

      const result = await response.json();
      
      if (result.success && result.verification_status) {
        const verificationData = result.verification_status;
        setIsEligible(verificationData.is_verified);
        setFeeVerified(verificationData.fee_verified ?? null);
      }
    } catch (error) {
      console.error('Error in refreshVerificationStatus:', error);
    }
  };

  // Load verification status on component mount
  useEffect(() => {
    console.log('Current user ID on mount:', currentUser?.id); // Debug user ID
    const loadVerificationStatus = async () => {
      if (!currentUser?.id) return;

      try {
        // Use Django API to get verification status
        const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || '/api';
        console.log('API_BASE_URL:', API_BASE_URL);
        const fullUrl = `${API_BASE_URL}/documents/status/`;
        console.log('Full URL:', fullUrl);
        const token = simpleTokenManager.getAccessToken();
        console.log('Token found:', token ? 'YES' : 'NO', token?.substring(0, 10) + '...');
        console.log('All localStorage keys:', Object.keys(localStorage));
        const response = await fetch(fullUrl, {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error('Error loading verification status:', response.status, errorText);
          return;
        }

        const result = await response.json();
        
        if (result.success && result.verification_status) {
          const verificationData = result.verification_status;
          setIsEligible(verificationData.is_verified);
          setFeeVerified(verificationData.fee_verified ?? null);
          
          // If student is eligible (both transcript and fee verified), try to assign supervisors
          if (verificationData.is_verified && verificationData.fee_verified) {
            try {
              console.log('Student is already eligible, attempting to assign supervisors');
              const result = await assignSupervisors(studentDetails?.id || currentUser.id);
              console.log('Supervisor assignment result:', result.message);
            } catch (error: any) {
              console.error("Error assigning supervisors:", error);
              // Show appropriate error messages
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
        // Use Django API to get student details
        const response = await fetch(`${API_BASE_URL}/students/`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (!response.ok) {
          console.error('Error loading student details:', response.status);
          return;
        }
        
        const data = await response.json();
        // Django ViewSet returns an array of results for current user
        if (data && data.results && Array.isArray(data.results) && data.results.length > 0) {
          setStudentDetails(data.results[0]);
        } else if (data && Array.isArray(data) && data.length > 0) {
          setStudentDetails(data[0]);
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
        console.log('Loading assigned supervisors for student:', studentDetails?.id || currentUser.id);
        // Use Django API to get supervisor assignments
        const response = await fetch(`${API_BASE_URL}/supervisor-assignments/?student=${studentDetails?.id || currentUser.id}`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          console.error('Error loading assigned supervisors:', response.status);
          return;
        }

        const data = await response.json();

        console.log('Assigned supervisors data:', data);
        if (data) {
          setAssignedSupervisors(data.results || data);
        }
      } catch (error) {
        console.error('Error in loadAssignedSupervisors:', error);
      }
    };

    loadAssignedSupervisors();
  }, [currentUser?.id, studentDetails?.id]);

  // Fetch attachments and reports for the current student
  useEffect(() => {
    const fetchLogs = async () => {
      if (!currentUser?.id) return;
      // Fetch attachments (Django filters automatically to current user)
      const { data: attachmentsData } = await supabase
        .from("attachments")
        .select("*, company:companies(*)")
        .order("created_at", { ascending: false });
      setAttachments(attachmentsData || []);
    };
    fetchLogs();
  }, [currentUser?.id, isAttachmentDialogOpen, isReportDialogOpen]);

  // Check if student already has an attachment
  useEffect(() => {
    const checkExistingAttachment = async () => {
      if (!currentUser?.id) return;
      // Get current user's attachment (Django filters automatically)
      const { data: attachmentData } = await supabase
        .from("attachments")
        .select("*, company:companies(*)");
      
      const data = Array.isArray(attachmentData) && attachmentData.length > 0 ? attachmentData[0] : null;
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
      // Get current user's weekly logs (Django filters automatically)
      const { data } = await supabase
        .from("weekly_logs")
        .select("*")
        .order("date", { ascending: false });
      setWeeklyLogs(data || []);
    };
    fetchWeeklyLogs();
  }, [currentUser?.id]);


  // Handle downloading introductory letter
  const handleDownloadIntroductoryLetter = () => {
    if (!currentUser || !studentDetails) return;
    const letter = generateIntroductoryLetter(
      `${currentUser.first_name} ${currentUser.last_name}`,
      studentDetails.student_id, // Use student_id instead of currentUser.id
      studentDetails.program,
      studentDetails.year_of_study.toString(),
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
      `${currentUser.first_name} ${currentUser.last_name}`,
      studentDetails.student_id, // Use student_id instead of currentUser.id
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

  // Load Google Maps API if not already loaded
  const loadGoogleMapsAPI = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      if (window.google && window.google.maps) {
        resolve();
        return;
      }

      const apiKey = import.meta.env.VITE_PUBLIC_GOOGLE_MAPS_API_KEY;
      if (!apiKey) {
        reject(new Error("Google Maps API key not configured"));
        return;
      }

      const script = document.createElement('script');
      script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places`;
      script.async = true;
      script.defer = true;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("Failed to load Google Maps API"));
      document.head.appendChild(script);
    });
  };

  // Google Maps JS API helper for driving distance
  const getDrivingDistance = async (origin: string, destination: string): Promise<number> => {
    // Ensure Google Maps API is loaded
    await loadGoogleMapsAPI();
    
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
    if (!currentUser?.id || !studentDetails?.id) {
      toast({ title: "Error", description: "Student information not loaded. Please refresh the page.", variant: "destructive" });
      return;
    }
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
    if (!details.company_location || !details.company_name || !details.start_date || !details.end_date) {
      toast({ title: "Required", description: "Please fill all required fields including start and end dates.", variant: "destructive" });
      return;
    }
    try {
      // Debug: Check token before making API call
      const token = tokenManager.getAccessToken();
      console.log('Token for company creation:', token ? 'Token exists' : 'No token found');
      
      // 1. Create or get company using Django API with token refresh handling
      console.log('Creating company with details:', {
        name: details.company_name,
        location: details.company_location,
        contact_phone: details.company_phone,
        contact_email: details.company_email,
      });
      
      let companyResponse = await fetch(`${API_BASE_URL}/companies/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: details.company_name,
          location: details.company_location,
          contact_phone: details.company_phone,
          contact_email: details.company_email,
        }),
      });
      
      console.log('Company creation response status:', companyResponse.status);
      
      // Handle token refresh if needed
      if (companyResponse.status === 401) {
        console.log('Token expired, attempting refresh...');
        // Try to refresh token using auth context
        try {
          // For now, redirect to login if token is invalid
          // TODO: Implement proper token refresh
          toast({
            title: "Session Expired",
            description: "Please log in again to continue.",
            variant: "destructive",
          });
          window.location.href = '/login';
          return;
        } catch (refreshError) {
          console.error('Token refresh failed:', refreshError);
          window.location.href = '/login';
          return;
        }
      }
      
      let company;
      if (companyResponse.ok) {
        company = await companyResponse.json();
        console.log('Company created successfully:', company);
      } else if (companyResponse.status === 400) {
        // Company might already exist, try to find it
        const errorData = await companyResponse.text();
        console.log('Company creation failed with 400:', errorData);
        
        const searchResponse = await fetch(`${API_BASE_URL}/companies/?name=${encodeURIComponent(details.company_name)}`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        if (searchResponse.ok) {
          const companies = await searchResponse.json();
          company = companies.results?.[0] || companies[0];
          console.log('Found existing company:', company);
        } else {
          const searchError = await searchResponse.text();
          console.log('Company search failed:', searchError);
        }
      } else {
        const errorData = await companyResponse.text();
        console.log('Company creation failed:', companyResponse.status, errorData);
      }
      
      if (!company) {
        console.log('No company object available for attachment creation');
        throw new Error('Failed to create or find company');
      }
      
      console.log('Using company for attachment:', company);
      
      // 2. Create attachment using Django API
      const attachmentData = {
        student_id: studentDetails.id,
        company_id: company.id,
        start_date: details.start_date,
        end_date: details.end_date,
      };
      console.log('Creating attachment with data:', attachmentData);
      const attachmentResponse = await fetch(`${API_BASE_URL}/attachments/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(attachmentData),
      });
      
      if (!attachmentResponse.ok) {
        const errorData = await attachmentResponse.text();
        throw new Error(`Failed to create attachment: ${errorData}`);
      }
      
      const attachment = await attachmentResponse.json();
      // 3. Ensure supervisors are assigned
      const supervisorResponse = await fetch(`${API_BASE_URL}/supervisor-assignments/?student=${studentDetails?.id || currentUser.id}`, {
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      let supervisorIds = [];
      if (supervisorResponse.ok) {
        const supervisorAssignments = await supervisorResponse.json();
        const assignments = supervisorAssignments.results || supervisorAssignments;
        supervisorIds = assignments.map((a: any) => a.supervisor);
      }
      if (!supervisorIds.length) {
        // Try to assign supervisors if none are assigned
        try {
          const result = await assignSupervisors(studentDetails?.id || currentUser.id);
          // Fetch again
          const newSupervisorResponse = await fetch(`${API_BASE_URL}/supervisor-assignments/?student=${studentDetails?.id || currentUser.id}`, {
            headers: {
              'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
          });
          if (newSupervisorResponse.ok) {
            const newAssignments = await newSupervisorResponse.json();
            const assignments = newAssignments.results || newAssignments;
            supervisorIds = assignments.map((a: any) => a.supervisor);
          }
        } catch (err: any) {
          // If supervisors are already assigned, that's actually fine
          if (err.message && err.message.includes("already has supervisors assigned")) {
            console.log("Supervisors already assigned, continuing...");
          } else {
            toast({ title: "Supervisor Assignment Failed", description: "Could not assign supervisors. Please contact admin.", variant: "destructive" });
            console.error("Supervisor assignment error:", err);
            return;
          }
        }
      }
      if (!supervisorIds.length) {
        toast({ title: "No supervisors assigned", description: "Cannot create reimbursements without assigned supervisors.", variant: "destructive" });
        console.error("No supervisors found for reimbursement.");
        return;
      }
      // 4. Calculate distance and create reimbursement for supervisors
      const cueaAddress = "Catholic University of Eastern Africa, Bogani East Road, Nairobi, Kenya";
      console.log("Calculating driving distance using Google Maps API...");
      const rawDistance = await getDrivingDistance(cueaAddress, details.company_location);
      console.log(`Raw driving distance calculated: ${rawDistance} km`);
      
      // Round distance to 2 decimal places for Django model validation
      const distance = Math.round(rawDistance * 100) / 100;
      console.log(`Rounded distance for database: ${distance} km`);
      
      // Get the latest admin-set rates from localStorage
      const currentRate = getGlobalRate();
      const currentLunch = getGlobalLunch();
      const studentFee = 1000; // KSH 1000 per student for supervisors
      console.log(`Using rates: ${currentRate} KSH/km, ${currentLunch} KSH lunch, ${studentFee} KSH student fee`);
      const amount = (currentRate * distance) + currentLunch + studentFee;
      console.log(`Calculated amount: (${currentRate} × ${distance}) + ${currentLunch} + ${studentFee} = ${amount} KSH`);
      // 4. Create reimbursements using Django API
      for (const supervisorId of supervisorIds) {
        const reimbursementData = {
          supervisor_id: supervisorId,
          student_id: studentDetails?.id || currentUser.id,
          company_id: company.id,
          amount,
          rate: currentRate,
          lunch: currentLunch,
          distance,
          status: "approved"
        };
        
        const reimbursementResponse = await fetch(`${API_BASE_URL}/reimbursements/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(reimbursementData),
        });
        
        if (!reimbursementResponse.ok) {
          const errorText = await reimbursementResponse.text();
          toast({ title: "Reimbursement Error", description: `Failed to create reimbursement: ${errorText}`, variant: "destructive" });
          console.error("Reimbursement creation error:", errorText);
          return;
        }
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
    
    // Get company ID from the nested structure
    const companyId = existingAttachment.company?.id || existingAttachment.company_id;
    if (!companyId) {
      toast({ title: "Error", description: "Company ID not found for update.", variant: "destructive" });
      return;
    }
    
    try {
      // Update company details using Django API
      const companyResponse = await fetch(`${API_BASE_URL}/companies/${companyId}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: attachmentForm.company_name,
          location: attachmentForm.company_location,
          contact_phone: attachmentForm.company_phone,
          contact_email: attachmentForm.company_email,
        }),
      });
      
      if (!companyResponse.ok) {
        const errorData = await companyResponse.text();
        throw new Error(`Failed to update company: ${errorData}`);
      }
      
      // Update attachment details using Django API
      const attachmentResponse = await fetch(`${API_BASE_URL}/attachments/${existingAttachment.id}/`, {
        method: 'PATCH',
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          start_date: attachmentForm.start_date,
          end_date: attachmentForm.end_date,
          attachment_period: attachmentForm.attachment_period
        }),
      });
      
      if (!attachmentResponse.ok) {
        const errorData = await attachmentResponse.text();
        throw new Error(`Failed to update attachment: ${errorData}`);
      }
      toast({ title: "Success", description: "Attachment details updated successfully." });
      // Refresh the attachments list using Django API
      const attachmentsListResponse = await fetch(`${API_BASE_URL}/attachments/`, {
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (attachmentsListResponse.ok) {
        const attachmentsData = await attachmentsListResponse.json();
        setAttachments(attachmentsData.results || attachmentsData || []);
      }
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
      // Fetch current verification status from Django API
      const response = await fetch(`${API_BASE_URL}/documents/status/`, {
        headers: {
          'Authorization': `Bearer ${simpleTokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      let currentStatus = null;
      if (response.ok) {
        const result = await response.json();
        if (result.success && result.verification_status) {
          currentStatus = result.verification_status;
        }
      }

      const text = await extractTextFromFile(file);
      const balance = parseBalanceFromText(text);

      // Default to false if not present
      const is_verified = currentStatus?.is_verified ?? false;

      if (balance !== null && balance === 0) {
        setFeeVerified(true);
        setFeeError(null);
        // Update fee verification status via Django API
        await fetch(`${API_BASE_URL}/verification-status/`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${simpleTokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            student: currentUser.id,
            fee_verified: true,
            is_verified: is_verified, // preserve transcript verification
            fee_verification_date: new Date().toISOString(),
          }),
        });
        toast({ title: "Fee Statement Verified", description: "Your fee balance is zero. You may proceed." });
      } else if (balance !== null) {
        setFeeVerified(false);
        setFeeError(`Your fee balance is not zero (Balance: ${balance}). Please clear your balance before proceeding.`);
        // Only update to false if not previously verified
        if (!currentStatus?.fee_verified) {
          await fetch(`${API_BASE_URL}/verification-status/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${simpleTokenManager.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              student: currentUser.id,
              fee_verified: false,
              is_verified: is_verified,
              fee_verification_date: new Date().toISOString(),
            }),
          });
        }
        toast({ title: "Fee Statement Not Verified", description: `Your fee balance is not zero (Balance: ${balance}).`, variant: "destructive" });
      } else {
        setFeeVerified(false);
        setFeeError("Could not find a balance in your fee statement. Please upload a valid statement.");
        if (!currentStatus?.fee_verified) {
          await fetch(`${API_BASE_URL}/verification-status/`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${simpleTokenManager.getAccessToken()}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              student: currentUser.id,
              fee_verified: false,
              is_verified: is_verified,
              fee_verification_date: new Date().toISOString(),
            }),
          });
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
    <>
      <main className="min-h-screen bg-gray-50">
        <NavBar title="Student Dashboard" />

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-1/4">
            <Card>
              <CardHeader>
                <CardTitle>{currentUser ? `${currentUser.first_name} ${currentUser.last_name}` : "Loading..."}</CardTitle>
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
                            <p>{assignment.supervisor_detail?.user?.first_name || 'Unknown'} {assignment.supervisor_detail?.user?.last_name || 'Supervisor'}</p>
                          </div>
                        ))}
                      </div>
                    </div>
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
                    </div>
                    <p className="text-muted-foreground text-center max-w-xl">
                      Please download and print your letter. Submit it to your attachment institution as required.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <Card>
                      <CardHeader>
                        <CardTitle>Document Verification</CardTitle>
                        <CardDescription>Upload your transcript and fee statement for eligibility verification.</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <DocumentVerificationTabs onVerificationUpdate={refreshVerificationStatus} />
                      </CardContent>
                    </Card>
                    
                  </div>
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

              </TabsContent>
            </Tabs>
          </div> {/* close main content */}
        </div>   {/* close flex row */}
        </div>   {/* close max-w-7xl container */}
      </main>

    </>
  );
};

export default StudentDashboard;

