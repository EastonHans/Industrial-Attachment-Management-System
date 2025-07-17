import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

export interface UserSignUpData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: "student" | "supervisor" | "admin";
  // Additional fields for students
  studentId?: string;
  program?: string;
  yearOfStudy?: number;
  // Additional fields for supervisors
  department?: string;
  title?: string;
  phoneNumber?: string;
}

export type AuthUser = {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: "student" | "supervisor" | "admin";
};

export async function signUp(userData: UserSignUpData): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    console.log("Beginning signup process for:", userData.email);
    // Create the user in Supabase auth
    const { data: authData, error: signUpError } = await supabase.auth.signUp({
      email: userData.email,
      password: userData.password,
      options: {
        data: {
          first_name: userData.firstName,
          last_name: userData.lastName,
          role: userData.role,
        },
      },
    });

    if (signUpError) {
      console.error("Supabase auth signup error:", signUpError);
      return { user: null, error: signUpError.message };
    }

    if (!authData.user) {
      console.error("No user returned from signup");
      return { user: null, error: "User could not be created" };
    }

    console.log("Auth user created, now creating profile");
    // Insert into profiles table
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      first_name: userData.firstName,
      last_name: userData.lastName,
      email: userData.email,
      role: userData.role,
    });

    if (profileError) {
      console.error("Profile creation error:", profileError);
      return { user: null, error: profileError.message };
    }

    // Based on role, insert additional data
    if (userData.role === "student" && userData.studentId && userData.program && userData.yearOfStudy) {
      console.log("Creating student record");
      const { error: studentError } = await supabase.from("students").insert({
        id: authData.user.id,
        student_id: userData.studentId,
        program: userData.program,
        year_of_study: userData.yearOfStudy,
        phone_number: userData.phoneNumber || null,
      });

      if (studentError) {
        console.error("Student record creation error:", studentError);
        return { user: null, error: studentError.message };
      }
    } else if (userData.role === "supervisor" && userData.department) {
      console.log("Creating supervisor record");
      const { error: supervisorError } = await supabase.from("supervisors").insert({
        id: authData.user.id,
        department: userData.department,
        title: userData.title || null,
      });

      if (supervisorError) {
        console.error("Supervisor record creation error:", supervisorError);
        return { user: null, error: supervisorError.message };
      }
    }

    const user: AuthUser = {
      id: authData.user.id,
      email: authData.user.email!,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
    };

    console.log("Signup process completed successfully");
    return { user, error: null };
  } catch (error: any) {
    console.error("Unexpected signup error:", error);
    return { user: null, error: error.message };
  }
}

export async function signIn(email: string, password: string): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    console.log("Beginning signin process for:", email);
    const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (signInError) {
      console.error("Sign in error:", signInError);
      return { user: null, error: signInError.message };
    }

    if (!authData.user) {
      console.error("No user returned from sign in");
      return { user: null, error: "Login failed" };
    }

    console.log("Auth successful, now fetching profile data");
    // Get user profile data
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", authData.user.id)
      .single();

    if (profileError || !profileData) {
      console.error("Profile fetch error:", profileError);
      return { user: null, error: profileError?.message || "Profile not found" };
    }

    const user: AuthUser = {
      id: authData.user.id,
      email: authData.user.email!,
      firstName: profileData.first_name,
      lastName: profileData.last_name,
      role: profileData.role as "student" | "supervisor" | "admin",
    };

    console.log("Sign in successful for:", user.email, "with role:", user.role);
    return { user, error: null };
  } catch (error: any) {
    console.error("Unexpected sign in error:", error);
    return { user: null, error: error.message };
  }
}

export async function signOut(): Promise<{ error: string | null }> {
  try {
    console.log("Signing out user");
    const { error } = await supabase.auth.signOut();
    if (error) {
      console.error("Sign out error:", error);
      return { error: error.message };
    }
    console.log("Sign out successful");
    return { error: null };
  } catch (error: any) {
    console.error("Unexpected sign out error:", error);
    return { error: error.message };
  }
}

// Function to get current session and user
export async function getCurrentUser(): Promise<{ user: AuthUser | null; error: string | null }> {
  try {
    console.log("Getting current user session");
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

    if (sessionError) {
      console.error("Session error:", sessionError);
      return { user: null, error: sessionError.message };
    }

    if (!sessionData.session?.user) {
      console.log("No active session found");
      return { user: null, error: null }; // No error, just no user
    }

    console.log("Session found, fetching profile data");
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", sessionData.session.user.id)
      .single();

    if (profileError || !profileData) {
      console.error("Profile fetch error:", profileError);
      return { user: null, error: profileError?.message || "Profile not found" };
    }

    const user: AuthUser = {
      id: sessionData.session.user.id,
      email: sessionData.session.user.email!,
      firstName: profileData.first_name,
      lastName: profileData.last_name,
      role: profileData.role as "student" | "supervisor" | "admin",
    };

    console.log("Current user retrieved:", user.email, "with role:", user.role);
    return { user, error: null };
  } catch (error: any) {
    console.error("Unexpected error getting current user:", error);
    return { user: null, error: error.message };
  }
}
