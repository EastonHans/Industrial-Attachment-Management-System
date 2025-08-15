/**
 * Session validation utilities to handle deleted users
 */

import { supabase } from "@/services/djangoApi";
import { toast } from "@/hooks/use-toast";

export interface SessionValidationResult {
  isValid: boolean;
  message?: string;
  shouldLogout?: boolean;
}

/**
 * Validate if current user still exists and is active in the database
 */
export async function validateUserSession(userId: string): Promise<SessionValidationResult> {
  try {
    console.log(`Validating session for user: ${userId}`);
    
    // Check if user profile exists
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('id, is_active, role')
      .eq('id', userId)
      .single();
    
    if (profileError) {
      console.warn('Profile validation error:', profileError);
      
      if (profileError.message?.includes('not found') || profileError.message?.includes('404')) {
        return {
          isValid: false,
          message: 'Your account has been removed from the system. Please contact the administrator.',
          shouldLogout: true
        };
      }
      
      // Other errors might be temporary (network issues, etc.)
      return {
        isValid: true, // Assume valid if we can't verify
        message: 'Unable to verify account status. Please try again.'
      };
    }
    
    if (!profile) {
      return {
        isValid: false,
        message: 'Account not found. Please contact the administrator.',
        shouldLogout: true
      };
    }
    
    if (!profile.is_active) {
      return {
        isValid: false,
        message: 'Your account has been deactivated. Please contact the administrator.',
        shouldLogout: true
      };
    }
    
    console.log(`✓ Session validated successfully for user: ${userId}`);
    return {
      isValid: true
    };
    
  } catch (error) {
    console.error('Session validation failed:', error);
    return {
      isValid: true, // Don't force logout on unexpected errors
      message: 'Unable to verify account status. Please try again.'
    };
  }
}

/**
 * Check if a specific role-based record exists for the user
 */
export async function validateRoleSpecificRecord(userId: string, role: 'student' | 'supervisor' | 'admin'): Promise<SessionValidationResult> {
  try {
    const tableName = role === 'admin' ? 'profiles' : `${role}s`;
    
    const { data, error } = await supabase
      .from(tableName)
      .select('id')
      .eq('id', userId)
      .single();
    
    if (error) {
      console.warn(`${role} record validation error:`, error);
      
      if (error.message?.includes('not found') || error.message?.includes('404')) {
        return {
          isValid: false,
          message: `Your ${role} account has been removed. Please contact the administrator.`,
          shouldLogout: true
        };
      }
      
      return {
        isValid: true, // Assume valid if we can't verify
        message: `Unable to verify ${role} account status.`
      };
    }
    
    if (!data) {
      return {
        isValid: false,
        message: `${role} account not found. Please contact the administrator.`,
        shouldLogout: true
      };
    }
    
    return {
      isValid: true
    };
    
  } catch (error) {
    console.error(`${role} record validation failed:`, error);
    return {
      isValid: true, // Don't force logout on unexpected errors
      message: `Unable to verify ${role} account status.`
    };
  }
}

/**
 * Show appropriate toast message and handle logout if needed
 */
export function handleSessionValidationResult(
  result: SessionValidationResult,
  logoutFunction: () => Promise<void>
): void {
  if (!result.isValid && result.message) {
    toast({
      title: "Account Issue",
      description: result.message,
      variant: "destructive",
    });
    
    if (result.shouldLogout) {
      setTimeout(() => {
        logoutFunction();
      }, 2000); // Give user time to read the message
    }
  } else if (result.message) {
    toast({
      title: "Notice",
      description: result.message,
      variant: "default",
    });
  }
}