
import { useAuth } from "@/contexts/AuthContext_django";
import { Button } from "@/components/ui/button";
import { Menu, X } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import MessageNotifications from "@/components/ui/MessageNotifications";

interface NavBarProps {
  title: string;
}

const NavBar = ({ title }: NavBarProps) => {
  const { currentUser, logout, isLoading } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);
  
  return (
    <header className="bg-white shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex justify-between items-center">
        <div className="flex items-center">
          <Link to="/">
            <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
          </Link>
        </div>
        
        {/* Desktop navigation */}
        <div className="hidden md:flex items-center gap-4">
          {currentUser ? (
            <>
              <div className="text-sm text-gray-600 mr-4">
                Hello, {currentUser.first_name} {currentUser.last_name}
              </div>
              <MessageNotifications />
              {currentUser.role === "student" && (
                <Link to="/student/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
              )}
              {currentUser.role === "supervisor" && (
                <Link to="/supervisor/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
              )}
              {(currentUser.role === "admin" || currentUser.role === "dean") && (
                <Link to="/admin/dashboard">
                  <Button variant="ghost">Dashboard</Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => logout()} disabled={isLoading}>
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Link to="/login">
                <Button variant="outline">Sign In</Button>
              </Link>
              <Link to="/register">
                <Button>Register</Button>
              </Link>
            </>
          )}
        </div>
        
        {/* Mobile menu button */}
        <div className="md:hidden flex items-center gap-2">
          {currentUser && <MessageNotifications />}
          <Button variant="ghost" size="icon" onClick={toggleMenu}>
            {isMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      
      {/* Mobile menu */}
      {isMenuOpen && (
        <div className="md:hidden bg-white p-4 shadow-md">
          {currentUser ? (
            <div className="flex flex-col space-y-3">
              <div className="text-sm text-gray-600 mb-2">
                Hello, {currentUser.first_name} {currentUser.last_name}
              </div>
              {currentUser.role === "student" && (
                <Link to="/student/dashboard" className="w-full">
                  <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
                </Link>
              )}
              {currentUser.role === "supervisor" && (
                <Link to="/supervisor/dashboard" className="w-full">
                  <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
                </Link>
              )}
              {(currentUser.role === "admin" || currentUser.role === "dean") && (
                <Link to="/admin/dashboard" className="w-full">
                  <Button variant="ghost" className="w-full justify-start">Dashboard</Button>
                </Link>
              )}
              <Button variant="outline" onClick={() => logout()} disabled={isLoading} className="w-full">
                Sign Out
              </Button>
            </div>
          ) : (
            <div className="flex flex-col space-y-3">
              <Link to="/login" className="w-full">
                <Button variant="outline" className="w-full">Sign In</Button>
              </Link>
              <Link to="/register" className="w-full">
                <Button className="w-full">Register</Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </header>
  );
};

export default NavBar;
