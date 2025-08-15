import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);
    try {
      const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://localhost:8080/api';
      const response = await fetch(`${API_BASE_URL}/auth/forgot-password/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      setLoading(false);
      
      if (response.ok) {
        setMessage("If an account with that email exists, a password reset link has been sent.");
      } else {
        const data = await response.json();
        setError(data.error || "Failed to send password reset email. Please try again.");
      }
    } catch (error) {
      setLoading(false);
      setError("Network error. Please check your connection and try again.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Forgot Password</CardTitle>
          <CardDescription>Enter your email to receive a password reset link.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              disabled={loading}
            />
            <Button type="submit" className="w-full" disabled={loading || !email}>
              {loading ? "Sending..." : "Send Reset Link"}
            </Button>
          </form>
          {message && <div className="mt-4 text-green-600 text-center">{message}</div>}
          {error && <div className="mt-4 text-red-600 text-center">{error}</div>}
        </CardContent>
        <CardFooter className="text-center">
          <Button variant="link" onClick={() => navigate("/login")}>Back to Login</Button>
        </CardFooter>
      </Card>
    </div>
  );
};

export default ForgotPassword; 