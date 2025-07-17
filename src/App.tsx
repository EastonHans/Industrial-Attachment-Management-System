import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Register from "./pages/Register";
import StudentDashboard from "./pages/student/Dashboard";
import SupervisorDashboard from "./pages/supervisor/Dashboard";
import AdminDashboard from "./pages/admin/Dashboard";
import NotFound from "./pages/NotFound";
import ForgotPassword from "./pages/ForgotPassword";

const queryClient = new QueryClient();

// Protected route component
const ProtectedRoute = ({ 
  element, 
  allowedRoles 
}: { 
  element: JSX.Element; 
  allowedRoles?: string[];
}) => {
  const { currentUser, isLoading } = useAuth();
  
  if (isLoading) {
    return <div className="min-h-screen flex items-center justify-center">
      <p className="text-lg font-medium">Loading...</p>
    </div>;
  }
  
  const isAuthenticated = !!currentUser;
  const hasRequiredRole = !allowedRoles || (currentUser && allowedRoles.includes(currentUser.role));
  
  if (!isAuthenticated || !hasRequiredRole) {
    return <Navigate to="/login" replace />;
  }
  
  return element;
};

const AppWithAuth = () => (
  <Routes>
    <Route path="/" element={<Index />} />
    <Route path="/login" element={<Login />} />
    <Route path="/register" element={<Register />} />
    <Route path="/forgot-password" element={<ForgotPassword />} />
    <Route 
      path="/student/dashboard" 
      element={
        <ProtectedRoute 
          element={<StudentDashboard />} 
          allowedRoles={["student"]} 
        />
      } 
    />
    <Route 
      path="/supervisor/dashboard" 
      element={
        <ProtectedRoute 
          element={<SupervisorDashboard />} 
          allowedRoles={["supervisor"]} 
        />
      } 
    />
    <Route 
      path="/admin/dashboard" 
      element={
        <ProtectedRoute 
          element={<AdminDashboard />} 
          allowedRoles={["admin"]} 
        />
      } 
    />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppWithAuth />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
