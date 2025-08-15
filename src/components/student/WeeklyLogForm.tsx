import { useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "../ui/card";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import { Button } from "../ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/services/djangoApi";
import { useAuth } from "@/contexts/AuthContext_django";

export default function WeeklyLogForm({ onSubmitted }: { onSubmitted?: () => void }) {
  const { toast } = useToast();
  const { currentUser } = useAuth();
  const [form, setForm] = useState({
    week_number: 1,
    date: "",
    day: "",
    task_assigned: "",
    attachee_remarks: ""
  });
  const [loading, setLoading] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("weekly_logs").insert({
        student_id: currentUser.id,
        week_number: Number(form.week_number),
        date: form.date,
        day: form.day,
        task_assigned: form.task_assigned,
        attachee_remarks: form.attachee_remarks
      });
      if (error) throw error;
      toast({ title: "Log Submitted", description: "Your weekly log has been submitted." });
      setForm({ week_number: 1, date: "", day: "", task_assigned: "", attachee_remarks: "" });
      onSubmitted?.();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Weekly Log Entry</CardTitle>
        <CardDescription>Fill in your weekly logbook entry below.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label>Week Number</label>
              <Input name="week_number" type="number" min={1} value={form.week_number} onChange={handleChange} required />
            </div>
            <div>
              <label>Date</label>
              <Input name="date" type="date" value={form.date} onChange={handleChange} required />
            </div>
            <div>
              <label>Day</label>
              <Input name="day" value={form.day} onChange={handleChange} required />
            </div>
          </div>
          <div>
            <label>Task Assigned</label>
            <Input name="task_assigned" value={form.task_assigned} onChange={handleChange} required />
          </div>
          <div>
            <label>Attachee Remarks</label>
            <Textarea name="attachee_remarks" value={form.attachee_remarks} onChange={handleChange} required />
          </div>
          <Button type="submit" disabled={loading}>{loading ? "Submitting..." : "Submit Log"}</Button>
        </form>
      </CardContent>
    </Card>
  );
} 