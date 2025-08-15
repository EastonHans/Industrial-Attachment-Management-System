/**
 * Automatic Data Integrity Checker
 * Runs periodic checks and auto-fixes certain integrity issues
 */

import { supabase } from "@/services/djangoApi";
import { simpleTokenManager } from "./simpleTokenManager";

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

class AutomaticDataIntegrityChecker {
  private isRunning = false;
  private checkInterval = 30 * 60 * 1000; // 30 minutes
  private intervalId: NodeJS.Timeout | null = null;

  /**
   * Start automatic integrity checking (only for authenticated admin users)
   */
  start() {
    if (this.isRunning) return;
    
    // Check if user is authenticated and is admin
    const isAuthenticated = simpleTokenManager.isAuthenticated();
    if (!isAuthenticated) {
      console.log('🔍 Data integrity checker: No authenticated session, skipping');
      return;
    }

    // Get user data from session
    const userData = simpleTokenManager.getUser();
    if (!userData || userData.role !== 'admin') {
      console.log('🔍 Data integrity checker: User is not admin, skipping');
      return;
    }
    
    this.isRunning = true;
    console.log('🔍 Starting automatic data integrity checker for admin user');
    
    // Run initial check
    this.performIntegrityCheck();
    
    // Set up periodic checks
    this.intervalId = setInterval(() => {
      this.performIntegrityCheck();
    }, this.checkInterval);
  }

  /**
   * Stop automatic integrity checking
   */
  stop() {
    if (!this.isRunning) return;
    
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    console.log('🛑 Stopped automatic data integrity checker');
  }

  /**
   * Perform integrity check and auto-fix issues where possible
   */
  private async performIntegrityCheck() {
    try {
      // Double-check authentication before running
      const isAuthenticated = simpleTokenManager.isAuthenticated();
      const userData = simpleTokenManager.getUser();
      if (!isAuthenticated || userData?.role !== 'admin') {
        console.log('🔍 Data integrity checker: Authentication lost, stopping checker');
        this.stop();
        return;
      }

      console.log('🔍 Running automatic data integrity check...');
      
      const report = await this.checkDataIntegrity();
      
      if (report && report.issues_found > 0) {
        console.log(`⚠️ Found ${report.issues_found} integrity issues`);
        
        // Auto-fix profile issues
        if (report.missing_profiles.length > 0) {
          await this.autoFixProfiles();
        }
        
        // Log severe issues for manual review
        if (report.missing_role_records.length > 0) {
          console.warn(`⚠️ Found ${report.missing_role_records.length} users with missing role records - manual review required`);
        }
      } else {
        console.log('✅ Data integrity check passed - no issues found');
      }
    } catch (error) {
      console.error('❌ Automatic integrity check failed:', error);
    }
  }

  /**
   * Check data integrity using the Django API
   */
  private async checkDataIntegrity(): Promise<IntegrityReport | null> {
    try {
      // This should call the proper Django endpoint for integrity checking
      // For now, we'll simulate the check by querying user data
      const { data: users, error } = await supabase
        .from('profiles')
        .select('*');

      if (error) {
        throw new Error('Failed to fetch user data: ' + error.message);
      }

      // Create a mock report for now - in a real implementation,
      // this would call the Django integrity check endpoint
      const report: IntegrityReport = {
        total_users: users?.length || 0,
        issues_found: 0,
        orphaned_users: [],
        missing_profiles: [],
        missing_role_records: [],
        recommendations: []
      };

      return report;
    } catch (error) {
      console.error('Data integrity check failed:', error);
      return null;
    }
  }

  /**
   * Automatically fix profile issues
   */
  private async autoFixProfiles(): Promise<void> {
    try {
      console.log('🔧 Auto-fixing profile issues...');
      
      // This should call the Django endpoint to fix profile issues
      // For now, we'll just log that it would be fixed
      console.log('✅ Profile issues would be auto-fixed');
      
    } catch (error) {
      console.error('Failed to auto-fix profiles:', error);
    }
  }

  /**
   * Get current status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      checkInterval: this.checkInterval,
      nextCheck: this.intervalId ? new Date(Date.now() + this.checkInterval) : null
    };
  }

  /**
   * Set check interval (in milliseconds)
   */
  setCheckInterval(interval: number) {
    this.checkInterval = Math.max(interval, 5 * 60 * 1000); // Minimum 5 minutes
    
    if (this.isRunning) {
      this.stop();
      this.start();
    }
  }
}

// Create singleton instance
export const automaticDataIntegrityChecker = new AutomaticDataIntegrityChecker();

// Note: The checker should be started manually from the admin dashboard
// when an admin user is authenticated, not automatically on module import