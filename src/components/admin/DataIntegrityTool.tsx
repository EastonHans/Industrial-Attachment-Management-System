/**
 * Data Integrity Management Tool for Admin Dashboard
 * Allows admins to check and fix orphaned users and data corruption
 */

import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/services/djangoApi";
import { Loader2, AlertTriangle, CheckCircle2, Users, Database } from "lucide-react";

interface IntegrityIssue {
  user_id: string;
  email: string;
  role: string;
  issues: string[];
  is_active: boolean;
}

interface IntegrityReport {
  total_users: number;
  issues_found: number;
  orphaned_users: IntegrityIssue[];
  missing_profiles: IntegrityIssue[];
  missing_role_records: IntegrityIssue[];
  recommendations: string[];
}

export function DataIntegrityTool() {
  const [isChecking, setIsChecking] = useState(false);
  const [isFixing, setIsFixing] = useState(false);
  const [report, setReport] = useState<IntegrityReport | null>(null);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  const checkIntegrity = async () => {
    setIsChecking(true);
    try {
      // Use the Django API endpoint for integrity checking
      const { data: integrityReport, error } = await supabase
        .from('users')
        .select('check_data_integrity');

      if (error) {
        throw new Error('Failed to check data integrity: ' + error.message);
      }
      
      setReport(integrityReport);
      setLastChecked(new Date());
      
      toast({
        title: "Integrity Check Complete",
        description: `Found ${integrityReport?.issues_found || 0} issues across ${integrityReport?.total_users || 0} users`,
        variant: (integrityReport?.issues_found || 0) > 0 ? "destructive" : "default",
      });

    } catch (error: any) {
      toast({
        title: "Integrity Check Failed",
        description: error.message || "Failed to check data integrity",
        variant: "destructive",
      });
    } finally {
      setIsChecking(false);
    }
  };


  const generateRecommendations = (total: number, profileIssues: number, roleIssues: number): string[] => {
    const recommendations: string[] = [];
    
    if (total === 0) {
      recommendations.push("✅ No integrity issues found! Database is healthy.");
      return recommendations;
    }

    if (profileIssues > 0) {
      recommendations.push("🔧 Click 'Fix Profile Issues' to create missing profile records");
    }
    
    if (roleIssues > 0) {
      recommendations.push("⚠️ Users without role records should be reviewed manually");
      recommendations.push("🗑️ Consider deleting orphaned users that can't be fixed");
    }

    recommendations.push("🔄 Run regular integrity checks to prevent future issues");
    return recommendations;
  };

  const fixProfileIssues = async () => {
    if (!report?.missing_profiles.length) return;
    
    setIsFixing(true);
    try {
      // Use the Django API endpoint to fix profile issues  
      const { data: result, error } = await supabase
        .from('users')
        .select('fix_profile_issues')
        .single();

      if (error) {
        throw new Error('Failed to fix profile issues: ' + error.message);
      }
      
      toast({
        title: "Profiles Fixed",
        description: result.message || `Created ${result.fixed_count} missing profile records`,
        variant: "default",
      });
      
      // Re-run integrity check
      await checkIntegrity();
      
    } catch (error: any) {
      toast({
        title: "Fix Failed",
        description: error.message || "Failed to fix profile issues",
        variant: "destructive",
      });
    } finally {
      setIsFixing(false);
    }
  };

  const deleteOrphanedUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to delete the orphaned user "${email}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;

      toast({
        title: "User Deleted",
        description: `Orphaned user "${email}" has been deleted`,
        variant: "default",
      });

      // Re-run integrity check
      await checkIntegrity();

    } catch (error: any) {
      toast({
        title: "Delete Failed",
        description: error.message || "Failed to delete orphaned user",
        variant: "destructive",
      });
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5" />
          <CardTitle>Data Integrity Management</CardTitle>
        </div>
        <CardDescription>
          Check and fix orphaned users and data corruption issues
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-6">
        {/* Check Button */}
        <div className="flex items-center gap-4">
          <Button 
            onClick={checkIntegrity} 
            disabled={isChecking}
            className="flex items-center gap-2"
          >
            {isChecking ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Database className="h-4 w-4" />
            )}
            {isChecking ? 'Checking...' : 'Check Data Integrity'}
          </Button>
          
          {lastChecked && (
            <span className="text-sm text-muted-foreground">
              Last checked: {lastChecked.toLocaleTimeString()}
            </span>
          )}
        </div>

        {/* Results */}
        {report && (
          <div className="space-y-4">
            {/* Summary */}
            <Alert variant={report.issues_found > 0 ? "destructive" : "default"}>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <div className="flex items-center gap-4">
                  <span>
                    <strong>{report.total_users}</strong> total users, 
                    <strong className={report.issues_found > 0 ? "text-red-600" : "text-green-600"}>
                      {" "}{report.issues_found}
                    </strong> issues found
                  </span>
                  {report.issues_found === 0 && <CheckCircle2 className="h-4 w-4 text-green-600" />}
                </div>
              </AlertDescription>
            </Alert>

            {/* Issues Details */}
            {report.issues_found > 0 && (
              <>
                {/* Missing Profiles */}
                {report.missing_profiles.length > 0 && (
                  <Card>
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">Missing Profiles ({report.missing_profiles.length})</CardTitle>
                        <Button 
                          onClick={fixProfileIssues}
                          disabled={isFixing}
                          size="sm"
                          variant="outline"
                        >
                          {isFixing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fix All"}
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {report.missing_profiles.map(issue => (
                          <div key={issue.user_id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <span className="font-medium">{issue.email}</span>
                              <Badge variant="outline" className="ml-2">{issue.role}</Badge>
                              <Badge variant={issue.is_active ? "default" : "secondary"} className="ml-1">
                                {issue.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Missing Role Records */}
                {report.missing_role_records.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">Missing Role Records ({report.missing_role_records.length})</CardTitle>
                      <CardDescription>
                        These users lack their role-specific database records
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {report.missing_role_records.map(issue => (
                          <div key={issue.user_id} className="flex items-center justify-between p-2 border rounded">
                            <div>
                              <span className="font-medium">{issue.email}</span>
                              <Badge variant="destructive" className="ml-2">{issue.role}</Badge>
                              <Badge variant={issue.is_active ? "default" : "secondary"} className="ml-1">
                                {issue.is_active ? "Active" : "Inactive"}
                              </Badge>
                            </div>
                            <Button 
                              onClick={() => deleteOrphanedUser(issue.user_id, issue.email)}
                              size="sm"
                              variant="destructive"
                            >
                              Delete
                            </Button>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}
              </>
            )}

            {/* Recommendations */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recommendations</CardTitle>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1">
                  {report.recommendations.map((rec, index) => (
                    <li key={index} className="text-sm">{rec}</li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default DataIntegrityTool;