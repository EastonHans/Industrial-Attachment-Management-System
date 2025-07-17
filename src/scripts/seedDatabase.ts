
import { supabase } from "@/integrations/supabase/client";
import { UserSignUpData } from "@/lib/supabase";

// Test users to create
const users: UserSignUpData[] = [
  {
    email: "student@example.com",
    password: "password123",
    firstName: "John",
    lastName: "Student",
    role: "student",
    studentId: "STU2023001",
    program: "Computer Science",
    yearOfStudy: 3
  },
  {
    email: "supervisor@example.com",
    password: "password123",
    firstName: "Jane",
    lastName: "Supervisor",
    role: "supervisor",
    department: "Information Technology",
    title: "Dr."
  },
  {
    email: "admin@example.com",
    password: "password123",
    firstName: "Admin",
    lastName: "User",
    role: "admin"
  },
  {
    email: "test.admin@system.com",
    password: "admin123",
    firstName: "Test",
    lastName: "Admin",
    role: "admin"
  }
];

// Function to create users
async function createUsers() {
  console.log("Starting user creation process...");
  
  for (const userData of users) {
    try {
      console.log(`\n--- Creating user: ${userData.email} ---`);
      
      // First check if user already exists by checking profiles table
      const { data: existingProfile, error: profileCheckError } = await supabase
        .from("profiles")
        .select("*")
        .eq("email", userData.email)
        .single();
      
      if (existingProfile && !profileCheckError) {
        console.log(`User ${userData.email} already exists, skipping...`);
        continue;
      }

      const { user, error } = await signUp(userData);
      
      if (error) {
        console.error(`❌ Failed to create user ${userData.email}:`, error);
      } else if (user) {
        console.log(`✅ Successfully created user: ${userData.email} (${user.role})`);
      } else {
        console.error(`❌ Unknown error creating user ${userData.email}`);
      }
    } catch (error) {
      console.error(`❌ Exception creating user ${userData.email}:`, error);
    }
  }
  
  console.log("\n🎉 User creation process completed!");
}

// Function to sign up users
async function signUp(userData: UserSignUpData): Promise<{ user: any | null; error: string | null }> {
  try {
    console.log(`  📝 Signing up: ${userData.firstName} ${userData.lastName} (${userData.role})`);
    
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
        emailRedirectTo: undefined // Disable email confirmation for seed data
      },
    });

    if (signUpError) {
      console.error(`  ❌ Auth signup error:`, signUpError.message);
      return { user: null, error: signUpError.message };
    }

    if (!authData.user) {
      console.error(`  ❌ No user returned from signup`);
      return { user: null, error: "User could not be created" };
    }

    console.log(`  ✅ Auth user created with ID: ${authData.user.id}`);

    // Wait a moment for the auth user to be fully created
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Insert into profiles table
    console.log(`  📝 Creating profile record...`);
    const { error: profileError } = await supabase.from("profiles").insert({
      id: authData.user.id,
      first_name: userData.firstName,
      last_name: userData.lastName,
      email: userData.email,
      role: userData.role,
    });

    if (profileError) {
      console.error(`  ❌ Profile creation error:`, profileError.message);
      return { user: null, error: profileError.message };
    }

    console.log(`  ✅ Profile created successfully`);

    // Based on role, insert additional data
    if (userData.role === "student" && userData.studentId && userData.program && userData.yearOfStudy) {
      console.log(`  📝 Creating student record...`);
      const { error: studentError } = await supabase.from("students").insert({
        id: authData.user.id,
        student_id: userData.studentId,
        program: userData.program,
        year_of_study: userData.yearOfStudy,
      });

      if (studentError) {
        console.error(`  ❌ Student record error:`, studentError.message);
        return { user: null, error: studentError.message };
      }
      console.log(`  ✅ Student record created`);
    } else if (userData.role === "supervisor" && userData.department) {
      console.log(`  📝 Creating supervisor record...`);
      const { error: supervisorError } = await supabase.from("supervisors").insert({
        id: authData.user.id,
        department: userData.department,
        title: userData.title || null,
      });

      if (supervisorError) {
        console.error(`  ❌ Supervisor record error:`, supervisorError.message);
        return { user: null, error: supervisorError.message };
      }
      console.log(`  ✅ Supervisor record created`);
    }

    const user = {
      id: authData.user.id,
      email: authData.user.email!,
      firstName: userData.firstName,
      lastName: userData.lastName,
      role: userData.role,
    };

    return { user, error: null };
  } catch (error: any) {
    console.error(`  ❌ Unexpected error:`, error.message);
    return { user: null, error: error.message };
  }
}

// Run the function
console.log("🚀 Starting seed database script...");
createUsers().then(() => {
  console.log("🏁 Seed script finished!");
}).catch((error) => {
  console.error("💥 Seed script failed:", error);
});
