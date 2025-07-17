import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { GraduationCap, Briefcase, FileText } from "lucide-react";

const Index = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <main className="flex-grow">
        {/* Hero Section */}
        <div className="bg-blue-600 text-white py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="max-w-3xl mx-auto text-center">
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl mb-6">
                Streamline Your Industrial Attachment Process
              </h1>
              <p className="text-lg mb-8">
                A comprehensive platform for managing industrial attachments for students,
                supervisors, and administrators.
              </p>
              <div className="flex flex-wrap gap-4 justify-center">
                <Link to="/register">
                  <Button size="lg" className="text-blue-600 bg-white hover:bg-gray-100">
                    Get Started
                  </Button>
                </Link>
                <Link to="/login">
                  <Button size="lg" className="text-blue-600 bg-white hover:bg-gray-100">
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </div>
        
        {/* Features Section */}
        <div className="py-16">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-extrabold text-gray-900">
                Key Features
              </h2>
              <p className="mt-4 text-lg text-gray-600">
                Everything you need to manage the industrial attachment process effectively.
              </p>
            </div>
            
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <GraduationCap className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle>For Students</CardTitle>
                  <CardDescription>
                    Streamline your attachment application and reporting.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Easy eligibility verification</li>
                    <li>• Online attachment application</li>
                    <li>• Digital weekly reporting</li>
                    <li>• Feedback and evaluation access</li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <Briefcase className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle>For Supervisors</CardTitle>
                  <CardDescription>
                    Efficiently manage and evaluate student attachments.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Student assignment dashboard</li>
                    <li>• Easy report reviews and feedback</li>
                    <li>• Streamlined evaluations</li>
                    <li>• Progress tracking tools</li>
                  </ul>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <FileText className="h-8 w-8 text-blue-600 mb-2" />
                  <CardTitle>For Administrators</CardTitle>
                  <CardDescription>
                    Comprehensive oversight of the attachment process.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ul className="space-y-2 text-sm">
                    <li>• Student and supervisor management</li>
                    <li>• Automated supervisor assignment</li>
                    <li>• System-wide reporting</li>
                    <li>• Reimbursement management</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="bg-white border-t border-gray-200">
        <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 lg:px-8">
          <p className="text-center text-sm text-gray-500">
            © 2025 Industrial Attachment Management System. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
};

export default Index;
