import { useEffect, useState } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext_django";
import { toast } from "@/hooks/use-toast";
import { checkServerHealth, createConnectionErrorMessage } from "@/utils/serverHealthCheck";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";


// Define form schema
const loginSchema = z.object({
  email: z.string().email({ message: "Please enter a valid email address" }),
  password: z.string().min(6, { message: "Password must be at least 6 characters" }),
  role: z.enum(["student", "supervisor", "admin"]),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const Login = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoading, currentUser } = useAuth();
  const searchParams = new URLSearchParams(location.search);
  const defaultRole = searchParams.get("role") || "student";
  const [loginAttempted, setLoginAttempted] = useState(false);
  const [loginStartTime, setLoginStartTime] = useState<number | null>(null);
  
  
  // Check if user is already logged in
  useEffect(() => {
    if (currentUser) {
      // Redirect based on role if already logged in
      switch (currentUser.role) {
        case "student":
          navigate("/student/dashboard");
          break;
        case "supervisor":
          navigate("/supervisor/dashboard");
          break;
        case "admin":
          navigate("/admin/dashboard");
          break;
        default:
          navigate("/");
          break;
      }
    }
  }, [currentUser, navigate]);
  
  // Initialize form with react-hook-form
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      role: defaultRole as "student" | "supervisor" | "admin",
    },
  });

  // Handle form submission
  const onSubmit = async (values: LoginFormValues) => {
    try {
      setLoginAttempted(true);
      setLoginStartTime(Date.now());
      await login(values.email, values.password);
      // Note: Redirect is handled in the AuthContext and the useEffect above
    } catch (error) {
      
      // Check if it's a server connection issue
      const healthCheck = await checkServerHealth();
      
      if (!healthCheck.isHealthy) {
        const connectionMessage = createConnectionErrorMessage(healthCheck);
        toast({
          title: "Server Connection Issue",
          description: connectionMessage,
          variant: "destructive",
        });
      } else {
        toast({
          title: "Unable to Sign In",
          description: "Please check your email and password and try again.",
          variant: "destructive",
        });
      }
      
      setLoginAttempted(false);
      setLoginStartTime(null);
    }
  };

  // Calculate how long we've been trying to log in
  const loginTimeElapsed = loginStartTime ? Math.floor((Date.now() - loginStartTime) / 1000) : 0;
  
  // Show additional UI feedback if login is taking too long
  const showExtendedLoadingInfo = loginAttempted && isLoading && loginTimeElapsed > 5;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Sign In</CardTitle>
          <CardDescription>
            Enter your credentials to access your account
          </CardDescription>
        </CardHeader>
        
        <CardContent>
          {showExtendedLoadingInfo && (
            <Alert className="mb-4">
              <AlertDescription>
                Login is taking longer than expected. Please wait while we complete the authentication process. 
                Time elapsed: {loginTimeElapsed} seconds.
              </AlertDescription>
            </Alert>
          )}
          
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input placeholder="email@example.com" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input type="password" placeholder="••••••••" {...field} disabled={isLoading} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="role"
                render={({ field }) => (
                  <FormItem className="hidden">
                    <FormControl>
                      <Input type="hidden" {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
              
              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <span className="flex items-center">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> 
                    {loginTimeElapsed > 10 ? "Still working..." : "Signing in..."}
                  </span>
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>
        </CardContent>
        
        <CardFooter className="flex flex-col space-y-4">
          <div className="text-sm text-center">
            <Link to="/forgot-password" className="text-primary hover:underline">
              Forgot your password?
            </Link>
          </div>
          <div className="text-sm text-center">
            Don't have an account?{" "}
            <Link to="/register" className="text-primary font-semibold hover:underline">
              Register here
            </Link>
          </div>
          <div className="text-sm text-center pt-2 border-t">
            <Link to="/" className="text-muted-foreground hover:text-primary hover:underline">
              ← Back to Home
            </Link>
          </div>
        </CardFooter>
      </Card>
    </div>
  );
};

export default Login;
