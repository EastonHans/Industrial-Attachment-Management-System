
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { signIn, signUp, signOut, getCurrentUser, UserSignUpData, AuthUser } from "@/lib/supabase";
import { supabase } from "@/integrations/supabase/client";

// Define the shape of our authentication context
interface AuthContextType {
  currentUser: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (userData: UserSignUpData) => Promise<void>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

// Create the context with a default value
const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  isLoading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {},
  isAuthenticated: false,
});

// Hook to use the auth context
export const useAuth = () => useContext(AuthContext);

// Provider component that wraps the app
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  // Initialize auth state from Supabase
  useEffect(() => {
    console.log("AuthProvider: Initializing auth state");
    
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log("Auth state changed:", event, session?.user?.id);

        // Only do synchronous state updates here
        if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
          // Defer user profile loading to avoid deadlocks
          if (session?.user) {
            setTimeout(async () => {
              try {
                console.log("Fetching user profile after auth state change");
                const { user } = await getCurrentUser();
                
                if (user) {
                  console.log("User profile fetched:", user.firstName, user.role);
                  setCurrentUser(user);
                  setIsLoading(false);
                  
                  // Auto redirect based on role
                  if (user.role === "student") {
                    navigate("/student/dashboard");
                  } else if (user.role === "supervisor") {
                    navigate("/supervisor/dashboard");
                  } else if (user.role === "admin") {
                    navigate("/admin/dashboard");
                  }
                }
              } catch (error) {
                console.error("Error fetching user profile:", error);
                setIsLoading(false);
              }
            }, 0);
          }
        } else if (event === "SIGNED_OUT") {
          console.log("User signed out");
          setCurrentUser(null);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    const checkSession = async () => {
      try {
        console.log("Checking for existing session");
        const { user, error } = await getCurrentUser();
        
        if (error) {
          console.error("Error checking session:", error);
        }
        
        if (user) {
          console.log("Found existing session for:", user.email);
          setCurrentUser(user);
        }
        
        setIsLoading(false);
      } catch (error) {
        console.error("Session check failed:", error);
        setIsLoading(false);
      }
    };
    
    checkSession();

    // Clean up subscription when component unmounts
    return () => {
      console.log("Cleaning up auth subscription");
      subscription.unsubscribe();
    };
  }, [navigate]);

  // Login function using Supabase
  const login = async (email: string, password: string) => {
    try {
      console.log("Attempting login for:", email);
      setIsLoading(true);
      
      // Add timeout to prevent infinite loading state
      const loginTimeout = setTimeout(() => {
        console.warn("Login timeout reached");
        setIsLoading(false);
        toast({
          title: "Login Timeout",
          description: "The login process took too long. Please try again.",
          variant: "destructive",
        });
      }, 15000);
      
      const { user, error } = await signIn(email, password);
      
      // Clear timeout as we got a response
      clearTimeout(loginTimeout);
      
      if (error || !user) {
        console.error("Login failed:", error);
        toast({
          title: "Login Failed",
          description: error || "Invalid credentials",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }
      
      console.log("Login successful for:", user.email);
      setCurrentUser(user);
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.firstName}!`,
      });
      
      // Auto redirect based on role
      if (user.role === "student") {
        navigate("/student/dashboard");
      } else if (user.role === "supervisor") {
        navigate("/supervisor/dashboard");
      } else if (user.role === "admin") {
        navigate("/admin/dashboard");
      } else {
        navigate("/");
      }
    } catch (error: any) {
      console.error("Unexpected login error:", error);
      toast({
        title: "Login Error",
        description: error.message || "Failed to login",
        variant: "destructive",
      });
    } finally {
      // Ensure loading state is always reset
      setIsLoading(false);
    }
  };

  // Register function using Supabase
  const register = async (userData: UserSignUpData) => {
    try {
      console.log("Attempting registration for:", userData.email);
      setIsLoading(true);
      const { user, error } = await signUp(userData);
      
      if (error) {
        console.error("Registration failed:", error);
        toast({
          title: "Registration Failed",
          description: error,
          variant: "destructive",
        });
        return;
      }
      
      console.log("Registration successful");
      toast({
        title: "Registration Successful",
        description: "Please check your email to confirm your account before logging in.",
      });
      
      // Redirect to login
      navigate("/login");
    } catch (error: any) {
      console.error("Unexpected registration error:", error);
      toast({
        title: "Registration Error",
        description: error.message || "Failed to register",
        variant: "destructive",
      });
    } finally {
      // Ensure loading state is always reset
      setIsLoading(false);
    }
  };

  // Logout function using Supabase
  const logout = async () => {
    try {
      console.log("Attempting logout");
      setIsLoading(true);
      const { error } = await signOut();
      
      if (error) {
        console.error("Logout failed:", error);
        toast({
          title: "Logout Failed",
          description: error,
          variant: "destructive",
        });
        return;
      }
      
      console.log("Logout successful");
      setCurrentUser(null);
      
      // Redirect to home
      navigate("/");
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
    } catch (error: any) {
      console.error("Unexpected logout error:", error);
      toast({
        title: "Logout Error",
        description: error.message || "Failed to logout",
        variant: "destructive",
      });
    } finally {
      // Ensure loading state is always reset
      setIsLoading(false);
    }
  };

  const value = {
    currentUser,
    isLoading,
    login,
    register,
    logout,
    isAuthenticated: !!currentUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
