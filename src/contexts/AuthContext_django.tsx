import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "@/hooks/use-toast";
import { simpleTokenManager } from "@/utils/simpleTokenManager";

// Django API base URL - use proxy in development
const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8080/api');

// Auth interfaces
export interface UserSignUpData {
  email: string;
  password: string;
  password_confirm: string;
  first_name: string;
  last_name: string;
  role: "student" | "supervisor" | "admin" | "dean";
  phone_number?: string;
  // Student fields
  student_id?: string;
  program?: string;
  year_of_study?: number;
  // Supervisor fields
  department?: string;
  title?: string;
}

export type AuthUser = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "student" | "supervisor" | "admin" | "dean";
};


// API helper function using the shared token manager
async function apiRequest(endpoint: string, options: RequestInit = {}) {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = simpleTokenManager.getAccessToken();
  
  console.log('🔒 API Request:', endpoint, 'Token exists:', !!token, token ? `Token preview: ${token.substring(0, 20)}...` : 'No token');
  
  const defaultHeaders: HeadersInit = {
    'Content-Type': 'application/json',
  };
  
  if (token) {
    defaultHeaders.Authorization = `Bearer ${token}`;
  }
  
  const config: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...options.headers,
    },
  };
  
  const response = await fetch(url, config);
  console.log('🔒 API Response:', endpoint, response.status, response.statusText);
  
  // Handle token refresh if needed
  if (response.status === 401 && token) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      // Retry with new token
      config.headers = {
        ...defaultHeaders,
        Authorization: `Bearer ${simpleTokenManager.getAccessToken()}`,
        ...options.headers,
      };
      return await fetch(url, config);
    } else {
      // Refresh failed, clear tokens
      simpleTokenManager.clearAll();
      throw new Error('Authentication failed');
    }
  }
  
  return response;
}

// Refresh token function
async function refreshAccessToken(): Promise<boolean> {
  const refreshToken = simpleTokenManager.getRefreshToken();
  if (!refreshToken) return false;
  
  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh: refreshToken }),
    });
    
    if (response.ok) {
      const data = await response.json();
      simpleTokenManager.setTokens(data.access, refreshToken);
      return true;
    }
  } catch (error) {
    console.error('Token refresh failed:', error);
  }
  
  return false;
}

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

  // Initialize auth state from localStorage on app start
  useEffect(() => {
    console.log("AuthProvider: Initializing auth state");
    
    const checkExistingAuth = async () => {
      try {
        const token = simpleTokenManager.getAccessToken();
        const user = simpleTokenManager.getUser();
        
        if (token && user) {
          console.log("Found existing session for:", user.email);
          
          // Verify token is still valid by making a test request
          try {
            const response = await apiRequest('/auth/user/');
            if (response.ok) {
              const userData = await response.json();
              console.log("Raw user data from API:", userData);
              const authUser: AuthUser = {
                id: userData.id.toString(),
                email: userData.email,
                first_name: userData.first_name,
                last_name: userData.last_name,
                role: userData.role as "student" | "supervisor" | "admin" | "dean",
              };
              
              console.log("Processed auth user:", authUser);
              simpleTokenManager.setUser(authUser);
              setCurrentUser(authUser);
              console.log("Session validated for:", authUser.email, "Role:", authUser.role);
              
              // Auto redirect based on role after session validation
              if (authUser.role === "student") {
                navigate("/student/dashboard");
              } else if (authUser.role === "supervisor") {
                navigate("/supervisor/dashboard");
              } else if (authUser.role === "admin" || authUser.role === "dean") {
                navigate("/admin/dashboard");
              }
            } else {
              // Token invalid, clear everything
              console.log("Invalid session, clearing tokens");
              simpleTokenManager.clearAll();
              setCurrentUser(null);
            }
          } catch (error) {
            console.log("Session validation failed, clearing tokens");
            simpleTokenManager.clearAll();
            setCurrentUser(null);
          }
        } else {
          console.log("No existing session found");
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("Auth initialization error:", error);
        simpleTokenManager.clearAll();
        setCurrentUser(null);
      } finally {
        setIsLoading(false);
      }
    };
    
    checkExistingAuth();
  }, []);

  // Login function using Django REST API
  const login = async (email: string, password: string) => {
    try {
      console.log("Attempting login for:", email);
      console.log("API_BASE_URL:", API_BASE_URL);
      console.log("Full login URL:", `${API_BASE_URL}/auth/login/`);
      setIsLoading(true);
      
      const requestBody = { email, password };
      console.log("Request body:", requestBody);
      
      const response = await fetch(`${API_BASE_URL}/auth/login/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });
      
      console.log("Response status:", response.status);
      console.log("Response headers:", Object.fromEntries(response.headers.entries()));
      
      const data = await response.json();
      console.log('Login response data:', data);
      
      if (!response.ok) {
        let errorMessage = "Please check your email and password and try again.";
        
        if (data.detail) {
          errorMessage = data.detail;
        } else if (data.error) {
          errorMessage = data.error;
        } else if (data.message) {
          errorMessage = data.message;
        } else if (data.non_field_errors && Array.isArray(data.non_field_errors)) {
          errorMessage = data.non_field_errors[0];
        }
        
        console.error('Login failed:', errorMessage, 'Full response:', data);
        throw new Error(errorMessage);
      }
      
      // Extract user and tokens from response
      const user: AuthUser = {
        id: data.user.id.toString(),
        email: data.user.email,
        first_name: data.user.first_name,
        last_name: data.user.last_name,
        role: data.user.role as "student" | "supervisor" | "admin" | "dean",
      };
      
      // Store tokens and user data
      console.log('Storing tokens:', { access: data.tokens?.access?.substring(0, 10) + '...', refresh: data.tokens?.refresh?.substring(0, 10) + '...' });
      simpleTokenManager.setTokens(data.tokens.access, data.tokens.refresh);
      simpleTokenManager.setUser(user);
      setCurrentUser(user);
      
      console.log("Login successful for:", user.email, "Role:", user.role);
      
      toast({
        title: "Login Successful",
        description: `Welcome back, ${user.first_name}!`,
      });
      
      // Auto redirect based on role
      console.log("Navigating based on role:", user.role);
      if (user.role === "student") {
        console.log("Redirecting to student dashboard");
        navigate("/student/dashboard");
      } else if (user.role === "supervisor") {
        console.log("Redirecting to supervisor dashboard");
        navigate("/supervisor/dashboard");
      } else if (user.role === "admin" || user.role === "dean") {
        console.log("Redirecting to admin dashboard");
        navigate("/admin/dashboard");
      } else {
        console.log("Redirecting to home");
        navigate("/");
      }
    } catch (error: any) {
      console.error("Login error:", error);
      
      let errorMessage = "Something went wrong. Please try again.";
      
      if (error.message) {
        if (error.message.includes('Network') || error.message.includes('fetch')) {
          errorMessage = "Network error. Please check your connection and try again.";
        } else if (error.message.includes('timeout')) {
          errorMessage = "Request timed out. Please try again.";
        } else {
          errorMessage = error.message;
        }
      }
      
      toast({
        title: "Unable to Sign In",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Register function using Django REST API
  const register = async (userData: UserSignUpData) => {
    try {
      console.log("Attempting registration for:", userData.email);
      setIsLoading(true);
      
      const response = await fetch(`${API_BASE_URL}/auth/register/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData),
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        let errorMessage = "Registration failed. Please try again.";
        
        if (data.error) {
          errorMessage = data.error;
        } else if (data.detail) {
          errorMessage = data.detail;
        } else if (data.email && Array.isArray(data.email)) {
          errorMessage = data.email[0];
        } else if (data.password && Array.isArray(data.password)) {
          errorMessage = data.password[0];
        } else if (data.student_id && Array.isArray(data.student_id)) {
          errorMessage = data.student_id[0];
        }
        
        throw new Error(errorMessage);
      }
      
      console.log("Registration successful");
      toast({
        title: "Registration Successful",
        description: "Account created successfully! You can now log in.",
      });
      
      // Redirect to login
      navigate("/login");
    } catch (error: any) {
      console.error("Registration error:", error);
      toast({
        title: "Registration Failed",
        description: error.message || "Failed to register",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Logout function using Django REST API
  const logout = async () => {
    try {
      console.log("Attempting logout");
      setIsLoading(true);
      
      const refreshToken = simpleTokenManager.getRefreshToken();
      
      // Call logout endpoint if we have a refresh token
      if (refreshToken) {
        try {
          await fetch(`${API_BASE_URL}/auth/logout/`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${simpleTokenManager.getAccessToken()}`,
            },
            body: JSON.stringify({ refresh: refreshToken }),
          });
        } catch (error) {
          console.error("Logout API call failed:", error);
          // Continue with local logout even if API call fails
        }
      }
      
      // Clear local storage and state
      simpleTokenManager.clearAll();
      setCurrentUser(null);
      
      console.log("Logout successful");
      
      // Redirect to home
      navigate("/");
      
      toast({
        title: "Logged Out",
        description: "You have been successfully logged out",
      });
    } catch (error: any) {
      console.error("Logout error:", error);
      // Still clear local state even if logout fails
      simpleTokenManager.clearAll();
      setCurrentUser(null);
      navigate("/");
    } finally {
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