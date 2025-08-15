import { supabase, API_BASE_URL, tokenManager } from "@/services/djangoApi";

interface Supervisor {
  id: string;
  students_count: number;
}

export const assignSupervisors = async (userIdOrStudentId: string) => {
  try {
    // First, determine if we have a user ID or student ID and get the correct student record
    let studentId = userIdOrStudentId;
    
    // Try to find student by user_id first (most common case)
    try {
      const studentResponse = await fetch(`${API_BASE_URL}/students/?user_id=${userIdOrStudentId}`, {
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
      });
      
      if (studentResponse.ok) {
        const studentsData = await studentResponse.json();
        if (studentsData.results && studentsData.results.length > 0) {
          studentId = studentsData.results[0].id;
          console.log(`Found student by user_id: ${studentId}`);
        }
      }
    } catch (error) {
      console.log("Student lookup by user_id failed, trying direct ID lookup");
    }
    
    // If we still don't have a different ID, try direct student ID lookup
    if (studentId === userIdOrStudentId) {
      try {
        const directResponse = await fetch(`${API_BASE_URL}/students/${userIdOrStudentId}/`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        
        if (directResponse.ok) {
          const studentData = await directResponse.json();
          studentId = studentData.id;
          console.log(`Found student by direct ID: ${studentId}`);
        }
      } catch (error) {
        throw new Error("Student record not found");
      }
    }
    
    console.log(`Using student ID: ${studentId} for supervisor assignment`);

    // Check if student already has supervisors assigned
    const assignmentsResponse = await fetch(`${API_BASE_URL}/supervisor-assignments/?student=${studentId}`, {
      headers: {
        'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
    });
    
    if (assignmentsResponse.ok) {
      const assignmentsData = await assignmentsResponse.json();
      const existingAssignments = assignmentsData.results || assignmentsData;
      
      if (existingAssignments && existingAssignments.length > 0) {
        console.log(`Student already has ${existingAssignments.length} supervisor(s) assigned`);
        // Return existing assignments instead of throwing an error
        return {
          success: true,
          message: `Student already has ${existingAssignments.length} supervisor(s) assigned`,
          assignments: existingAssignments
        };
      }
    }

    // Get all active supervisors
    const supervisorsResponse = await fetch(`${API_BASE_URL}/supervisors/`, {
      headers: {
        'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
        'Content-Type': 'application/json',
      },
    });

    if (!supervisorsResponse.ok) {
      throw new Error("Failed to fetch supervisors");
    }

    const supervisorsData = await supervisorsResponse.json();
    const supervisors = supervisorsData.results || supervisorsData;

    if (!supervisors || supervisors.length === 0) {
      throw new Error("No supervisors available. Please contact the administrator.");
    }

    if (supervisors.length < 2) {
      throw new Error("Not enough supervisors available. Please contact the administrator.");
    }

    // Get student count for each supervisor
    const supervisorsWithCount = await Promise.all(
      supervisors.map(async (supervisor: any) => {
        const countResponse = await fetch(`${API_BASE_URL}/supervisor-assignments/?supervisor=${supervisor.id}`, {
          headers: {
            'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
            'Content-Type': 'application/json',
          },
        });
        
        let studentsCount = 0;
        if (countResponse.ok) {
          const countData = await countResponse.json();
          const assignments = countData.results || countData;
          studentsCount = Array.isArray(assignments) ? assignments.length : 0;
        }
        
        return {
          ...supervisor,
          students_count: studentsCount
        };
      })
    );

    // Sort supervisors by number of assigned students and filter out those at max capacity
    const MAX_STUDENTS_PER_SUPERVISOR = 20;
    const availableSupervisors = supervisorsWithCount
      .filter(supervisor => supervisor.students_count < MAX_STUDENTS_PER_SUPERVISOR)
      .sort((a, b) => a.students_count - b.students_count);

    if (availableSupervisors.length < 2) {
      throw new Error(`Not enough supervisors available. Maximum ${MAX_STUDENTS_PER_SUPERVISOR} students per supervisor. Please contact the administrator.`);
    }

    // Select the two supervisors with the least students (who are not at max capacity)
    const selectedSupervisors = availableSupervisors.slice(0, 2);

    // Create supervisor assignments one by one
    for (const supervisor of selectedSupervisors) {
      const assignment = {
        student: studentId,
        supervisor: supervisor.id,
        status: "active"
      };

      const assignmentResponse = await fetch(`${API_BASE_URL}/supervisor-assignments/`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${tokenManager.getAccessToken()}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(assignment),
      });

      if (!assignmentResponse.ok) {
        const errorData = await assignmentResponse.json();
        throw new Error(`Failed to create assignment: ${JSON.stringify(errorData)}`);
      }
    }

    return {
      success: true,
      message: `Successfully assigned ${selectedSupervisors.length} supervisor(s)`,
      assignments: selectedSupervisors
    };
  } catch (error) {
    console.error("Error assigning supervisors:", error);
    throw error;
  }
}; 