import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { API_BASE_URL, tokenManager } from "@/services/djangoApi";
import { useAuth } from "@/contexts/AuthContext_django";

const assessmentAreas = [
  { key: "availability_of_documents", label: "Availability of required documents (5)", min: 1, max: 5 },
  { key: "organization_of_logbook", label: "Degree of organization of daily entries in the Log book (10)", min: 0, max: 10 },
  { key: "adaptability", label: "Level of adaptability of Attachee in the Organization/Institution (10)", min: 0, max: 10 },
  { key: "teamwork", label: "Ability to work in teams (10)", min: 0, max: 10 },
  { key: "accomplishment", label: "Accomplishment of assignments (10)", min: 0, max: 10 },
  { key: "presence", label: "Presence at designated areas (10)", min: 0, max: 10 },
  { key: "communication_skills", label: "Communication skills (10)", min: 0, max: 10 },
  { key: "mannerism", label: "Mannerism (10)", min: 0, max: 10 },
  { key: "understanding_of_tasks", label: "Student Understanding of Assignments/tasks given (15)", min: 0, max: 15 },
  { key: "oral_presentation", label: "Oral presentation (20)", min: 0, max: 20 },
];

const overallOptions = ["Excellent", "Good", "Average", "Fair", "Poor"];

function getSliderColor(val: number, min: number, max: number) {
  const percent = (val - min) / (max - min);
  if (percent < 0.33) return "bg-red-500";
  if (percent < 0.66) return "bg-yellow-500";
  return "bg-green-500";
}

export default function EvaluationForm({ studentId, weekNumber, onSubmitted }: { studentId: string, weekNumber?: number, onSubmitted?: () => void }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [form, setForm] = useState({
    availability_of_documents: 1,
    organization_of_logbook: 0,
    adaptability: 0,
    teamwork: 0,
    accomplishment: 0,
    presence: 0,
    communication_skills: 0,
    mannerism: 0,
    understanding_of_tasks: 0,
    oral_presentation: 0,
    overall_assessment: "Average",
    comments: ""
  });
  const [loading, setLoading] = useState(false);

  const total = assessmentAreas.reduce((sum, area) => sum + Number(form[area.key as keyof typeof form]), 0);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSliderChange = (key: string, value: number) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="shadow-lg border-2 border-blue-100">
      <CardHeader>
        <CardTitle className="text-blue-700">Student Evaluation</CardTitle>
        <CardDescription className="mb-2">Fill in the assessment for the student below.</CardDescription>
      </CardHeader>
      <CardContent style={{ maxHeight: '70vh', overflowY: 'auto' }}>
        <form onSubmit={async (e) => {
          e.preventDefault();
          if (!currentUser?.id) return;
          setLoading(true);
          try {
            // Fetch latest attachment for the student using Django API
            const attachmentResponse = await fetch(`${API_BASE_URL}/attachments/?student=${studentId}`, {
              headers: {
                'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (!attachmentResponse.ok) {
              toast({ title: "Error", description: "Failed to fetch attachment data. Cannot submit evaluation.", variant: "destructive" });
              setLoading(false);
              return;
            }
            
            const attachmentData = await attachmentResponse.json();
            const attachments = attachmentData.results || attachmentData;
            
            if (!attachments || attachments.length === 0) {
              toast({ title: "Error", description: "No attachment found for this student. Cannot submit evaluation.", variant: "destructive" });
              setLoading(false);
              return;
            }
            
            const attachment = attachments[0]; // Get the first attachment
            
            // Get supervisor profile ID first
            const supervisorResponse = await fetch(`${API_BASE_URL}/supervisors/?user_id=${currentUser.id}`, {
              headers: {
                'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                'Content-Type': 'application/json',
              },
            });
            
            if (!supervisorResponse.ok) {
              toast({ title: "Error", description: "Failed to get supervisor profile. Cannot submit evaluation.", variant: "destructive" });
              setLoading(false);
              return;
            }
            
            const supervisorData = await supervisorResponse.json();
            const supervisors = supervisorData.results || supervisorData;
            
            if (!supervisors || supervisors.length === 0) {
              toast({ title: "Error", description: "No supervisor profile found. Cannot submit evaluation.", variant: "destructive" });
              setLoading(false);
              return;
            }
            
            const supervisorProfile = supervisors[0];
            
            // Submit evaluation using Django API
            // Note: evaluator is automatically set by perform_create in the viewset
            const evaluationData = {
              student_id: studentId,
              supervisor_id: supervisorProfile.id,
              attachment_id: attachment.id,
              evaluation_date: new Date().toISOString().split('T')[0], // Today's date
              performance_rating: form.availability_of_documents, // Map to performance_rating field
              ...form,
              total,
            };
            
            const evaluationResponse = await fetch(`${API_BASE_URL}/evaluations/`, {
              method: 'POST',
              headers: {
                'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(evaluationData),
            });
            
            if (!evaluationResponse.ok) {
              const errorData = await evaluationResponse.json();
              throw new Error(errorData.detail || 'Failed to submit evaluation');
            }
            
            toast({ title: "Evaluation Submitted", description: "The evaluation has been submitted successfully." });
            onSubmitted?.();
          } catch (err: any) {
            toast({ title: "Error", description: err.message, variant: "destructive" });
          } finally {
            setLoading(false);
          }
        }} className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {assessmentAreas.map(area => {
              const val = Number(form[area.key as keyof typeof form]);
              const isOral = area.key === 'oral_presentation';
              return (
                <div key={area.key} className="mb-6 p-6 rounded-lg bg-gray-50 border flex flex-col justify-between min-h-[160px]">
                  <div className="flex items-center justify-between mb-4">
                    <label className="block font-medium text-gray-700 text-base leading-tight">{area.label}</label>
                    <span className={`ml-4 px-3 py-1 rounded text-sm font-bold ${getSliderColor(val, area.min, area.max)} text-white`}>{val}</span>
                  </div>
                  <input
                    type="range"
                    name={area.key}
                    min={area.min}
                    max={area.max}
                    value={val}
                    onChange={e => handleSliderChange(area.key, Number(e.target.value))}
                    className="w-full accent-blue-600"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-2">
                    {isOral
                      ? [0, 5, 10, 15, 20].map(tick => (
                          <span key={tick} className="w-6 text-center">{tick}</span>
                        ))
                      : Array.from({ length: area.max - area.min + 1 }, (_, i) => (
                          <span key={i} className="w-4 text-center">{area.min + i}</span>
                        ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mb-4">
            <label className="block font-medium mb-1">Total</label>
            <Input value={total} readOnly disabled />
          </div>
          <div className="mb-4">
            <label className="block font-medium mb-1">Overall Assessment</label>
            <select name="overall_assessment" value={form.overall_assessment} onChange={handleChange} required className="w-full border rounded p-2">
              {overallOptions.map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block font-medium mb-1">Additional Comments</label>
            <Textarea name="comments" value={form.comments} onChange={handleChange} />
          </div>
          <Button type="submit" disabled={loading} className="w-full text-lg">{loading ? "Submitting..." : "Submit Evaluation"}</Button>
        </form>
      </CardContent>
    </Card>
  );
} 