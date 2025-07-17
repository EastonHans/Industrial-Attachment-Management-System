import { supabase } from "@/integrations/supabase/client";

interface Supervisor {
  id: string;
  students_count: number;
}

export const assignSupervisors = async (studentId: string) => {
  try {
    // First check if student already has supervisors assigned
    const { data: existingAssignments, error: checkError } = await supabase
      .from("supervisor_assignments")
      .select("id")
      .eq("student_id", studentId);

    if (checkError) throw checkError;

    if (existingAssignments && existingAssignments.length > 0) {
      throw new Error("Student already has supervisors assigned");
    }

    // Get all active supervisors
    const { data: supervisors, error: supervisorsError } = await supabase
      .from("supervisors")
      .select(`
        id,
        department,
        title,
        profile:profiles (
          first_name,
          last_name,
          email
        )
      `);

    if (supervisorsError) throw supervisorsError;

    if (!supervisors || supervisors.length === 0) {
      throw new Error("No supervisors available. Please contact the administrator.");
    }

    if (supervisors.length < 2) {
      throw new Error("Not enough supervisors available. Please contact the administrator.");
    }

    // Get student count for each supervisor
    const supervisorsWithCount = await Promise.all(
      supervisors.map(async (supervisor) => {
        const { count } = await supabase
          .from("supervisor_assignments")
          .select("*", { count: "exact" })
          .eq("supervisor_id", supervisor.id);
        
        return {
          ...supervisor,
          students_count: count || 0
        };
      })
    );

    // Sort supervisors by number of assigned students
    const sortedSupervisors = supervisorsWithCount
      .sort((a, b) => a.students_count - b.students_count);

    // Select the two supervisors with the least students
    const selectedSupervisors = sortedSupervisors.slice(0, 2);

    // Create supervisor assignments
    const assignments = selectedSupervisors.map(supervisor => ({
      student_id: studentId,
      supervisor_id: supervisor.id,
      status: "active",
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }));

    // Insert the assignments
    const { error: assignmentError } = await supabase
      .from("supervisor_assignments")
      .insert(assignments);

    if (assignmentError) throw assignmentError;

    return selectedSupervisors;
  } catch (error) {
    console.error("Error assigning supervisors:", error);
    throw error;
  }
}; 