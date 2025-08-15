/**
 * Secure Session Manager with Timeout and Validation
 * Implements proper session security measures
 */

interface SessionData {
  access_token: string;
  refresh_token: string;
  user: any;
  timestamp: number;
  lastActivity: number;
  sessionId: string;
}

interface SessionConfig {
  maxAge: number; // Maximum session age in milliseconds
  inactivityTimeout: number; // Inactivity timeout in milliseconds
  requireReauthOnReopen: boolean; // Require re-authentication when app is reopened
  encryptStorage: boolean; // Whether to encrypt session data
}

const DEFAULT_CONFIG: SessionConfig = {
  maxAge: 8 * 60 * 60 * 1000, // 8 hours
  inactivityTimeout: 30 * 60 * 1000, // 30 minutes
  requireReauthOnReopen: true, // Security: require login after closing app
  encryptStorage: false // Simple implementation without encryption for now
};

class SecureSessionManager {
  private config: SessionConfig;
  private inactivityTimer: NodeJS.Timeout | null = null;
  private sessionId: string;
  private isAppVisible: boolean = true;

  constructor(config: Partial<SessionConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.sessionId = this.generateSessionId();
    this.setupVisibilityListener();
    this.setupInactivityTimer();
  }

  /**
   * Generate unique session ID
   */
  private generateSessionId(): string {
    return `sess_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Setup visibility change listener to detect app being closed/reopened
   */
  private setupVisibilityListener(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.isAppVisible = false;
        this.handleAppHidden();
      } else {
        this.isAppVisible = true;
        this.handleAppVisible();
      }
    });

    // Also listen for beforeunload (when user closes tab/window)
    window.addEventListener('beforeunload', () => {
      this.handleAppClosed();
    });

    // Listen for focus events
    window.addEventListener('focus', () => {
      this.handleAppFocus();
    });
  }

  /**
   * Handle app being hidden/minimized
   */
  private handleAppHidden(): void {
    console.log('🔒 App hidden - marking session for security check');
    this.setSessionFlag('app_was_hidden', true);
  }

  /**
   * Handle app becoming visible again
   */
  private handleAppVisible(): void {
    console.log('👁️ App visible again - checking session security');
    
    if (this.config.requireReauthOnReopen) {
      const wasHidden = this.getSessionFlag('app_was_hidden');
      if (wasHidden) {
        console.log('🚨 App was previously hidden - requiring re-authentication');
        this.invalidateSession('App was closed/minimized');
      }
    }
  }

  /**
   * Handle app being closed
   */
  private handleAppClosed(): void {
    console.log('🔒 App closing - setting security flags');
    this.setSessionFlag('app_was_closed', true);
    this.setSessionFlag('close_timestamp', Date.now());
  }

  /**
   * Handle app gaining focus
   */
  private handleAppFocus(): void {
    if (this.config.requireReauthOnReopen) {
      const wasClosed = this.getSessionFlag('app_was_closed');
      const closeTimestamp = this.getSessionFlag('close_timestamp');
      
      if (wasClosed && closeTimestamp) {
        const timeSinceClosed = Date.now() - parseInt(closeTimestamp);
        console.log(`🚨 App was closed ${timeSinceClosed}ms ago - requiring re-authentication`);
        this.invalidateSession('App was previously closed');
      }
    }
  }

  /**
   * Setup inactivity timer
   */
  private setupInactivityTimer(): void {
    const resetTimer = () => {
      if (this.inactivityTimer) {
        clearTimeout(this.inactivityTimer);
      }

      this.inactivityTimer = setTimeout(() => {
        console.log('⏰ Session expired due to inactivity');
        this.invalidateSession('Session expired due to inactivity');
      }, this.config.inactivityTimeout);

      // Update last activity
      this.updateLastActivity();
    };

    // Reset timer on user activity
    ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart', 'click'].forEach(event => {
      document.addEventListener(event, resetTimer, { passive: true });
    });

    // Start the timer
    resetTimer();
  }

  /**
   * Store session data securely
   */
  setSession(tokens: { access_token: string; refresh_token: string }, user: any): void {
    const sessionData: SessionData = {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      user,
      timestamp: Date.now(),
      lastActivity: Date.now(),
      sessionId: this.sessionId
    };

    try {
      const dataToStore = this.config.encryptStorage 
        ? this.encryptData(JSON.stringify(sessionData))
        : JSON.stringify(sessionData);

      sessionStorage.setItem('secure_session', dataToStore);
      sessionStorage.setItem('session_id', this.sessionId);
      
      // Clear any old localStorage data for security
      localStorage.removeItem('access_token');
      localStorage.removeItem('refresh_token');
      localStorage.removeItem('user');
      
      // Clear security flags
      this.clearSecurityFlags();
      
      console.log('✅ Secure session stored');
    } catch (error) {
      console.error('❌ Failed to store secure session:', error);
      throw new Error('Session storage failed');
    }
  }

  /**
   * Get session data with validation
   */
  getSession(): { access_token: string; refresh_token: string; user: any } | null {
    try {
      const storedData = sessionStorage.getItem('secure_session');
      const storedSessionId = sessionStorage.getItem('session_id');
      
      if (!storedData || !storedSessionId) {
        console.log('❌ No session data found');
        return null;
      }

      // Only check for re-auth if we actually have a session
      if (this.shouldRequireReauth()) {
        console.log('🚨 Re-authentication required');
        this.invalidateSession('Re-authentication required for security');
        return null;
      }

      // Verify session ID matches
      if (storedSessionId !== this.sessionId) {
        console.log('❌ Session ID mismatch - possible security issue');
        this.invalidateSession('Session ID mismatch');
        return null;
      }

      const sessionData: SessionData = JSON.parse(
        this.config.encryptStorage 
          ? this.decryptData(storedData)
          : storedData
      );

      // Check session age
      if (Date.now() - sessionData.timestamp > this.config.maxAge) {
        console.log('⏰ Session expired due to age');
        this.invalidateSession('Session expired');
        return null;
      }

      // Check inactivity
      if (Date.now() - sessionData.lastActivity > this.config.inactivityTimeout) {
        console.log('⏰ Session expired due to inactivity');
        this.invalidateSession('Session expired due to inactivity');
        return null;
      }

      // Update last activity
      this.updateLastActivity();

      return {
        access_token: sessionData.access_token,
        refresh_token: sessionData.refresh_token,
        user: sessionData.user
      };

    } catch (error) {
      console.error('❌ Failed to retrieve session:', error);
      this.invalidateSession('Session retrieval failed');
      return null;
    }
  }

  /**
   * Check if re-authentication should be required
   */
  private shouldRequireReauth(): boolean {
    if (!this.config.requireReauthOnReopen) {
      return false;
    }

    // Check if app was closed
    const wasClosed = this.getSessionFlag('app_was_closed');
    const wasHidden = this.getSessionFlag('app_was_hidden');
    
    if (wasClosed || wasHidden) {
      console.log('🔒 App was previously closed/hidden - requiring re-authentication');
      return true;
    }

    // Check if this is a fresh browser session (no session storage from previous session)
    const hasExistingSession = sessionStorage.getItem('secure_session');
    const sessionId = sessionStorage.getItem('session_id');
    
    // If no existing session, that's normal for first visit - don't require reauth
    if (!hasExistingSession || !sessionId) {
      console.log('🔒 No existing session found - this is normal for first visit');
      return false; // Changed from true to false
    }

    return false;
  }

  /**
   * Update last activity timestamp
   */
  private updateLastActivity(): void {
    try {
      const storedData = sessionStorage.getItem('secure_session');
      if (storedData) {
        const sessionData: SessionData = JSON.parse(
          this.config.encryptStorage 
            ? this.decryptData(storedData)
            : storedData
        );
        
        sessionData.lastActivity = Date.now();
        
        const dataToStore = this.config.encryptStorage 
          ? this.encryptData(JSON.stringify(sessionData))
          : JSON.stringify(sessionData);
          
        sessionStorage.setItem('secure_session', dataToStore);
      }
    } catch (error) {
      console.error('❌ Failed to update activity timestamp:', error);
    }
  }

  /**
   * Invalidate current session
   */
  invalidateSession(reason: string): void {
    console.log(`🚨 Invalidating session: ${reason}`);
    
    // Clear all session data
    sessionStorage.removeItem('secure_session');
    sessionStorage.removeItem('session_id');
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token'); 
    localStorage.removeItem('user');
    
    // Clear security flags
    this.clearSecurityFlags();
    
    // Clear timers
    if (this.inactivityTimer) {
      clearTimeout(this.inactivityTimer);
      this.inactivityTimer = null;
    }

    // Trigger logout
    window.dispatchEvent(new CustomEvent('session-invalidated', { 
      detail: { reason } 
    }));
  }

  /**
   * Clear session (explicit logout)
   */
  clearSession(): void {
    this.invalidateSession('User logout');
  }

  /**
   * Set security flag
   */
  private setSessionFlag(key: string, value: any): void {
    sessionStorage.setItem(`security_${key}`, JSON.stringify(value));
  }

  /**
   * Get security flag
   */
  private getSessionFlag(key: string): any {
    const value = sessionStorage.getItem(`security_${key}`);
    return value ? JSON.parse(value) : null;
  }

  /**
   * Clear all security flags
   */
  private clearSecurityFlags(): void {
    const keys = Object.keys(sessionStorage);
    keys.forEach(key => {
      if (key.startsWith('security_')) {
        sessionStorage.removeItem(key);
      }
    });
  }

  /**
   * Simple encryption (for basic security - in production use proper encryption)
   */
  private encryptData(data: string): string {
    // Simple base64 encoding for now - in production, use proper encryption
    return btoa(data);
  }

  /**
   * Simple decryption
   */
  private decryptData(encryptedData: string): string {
    // Simple base64 decoding for now - in production, use proper decryption
    return atob(encryptedData);
  }

  /**
   * Get session info for debugging
   */
  getSessionInfo(): any {
    const session = this.getSession();
    return {
      hasSession: !!session,
      sessionId: this.sessionId,
      isVisible: this.isAppVisible,
      config: this.config,
      securityFlags: {
        wasClosed: this.getSessionFlag('app_was_closed'),
        wasHidden: this.getSessionFlag('app_was_hidden'),
        closeTimestamp: this.getSessionFlag('close_timestamp')
      }
    };
  }
}

// Create singleton instance
export const secureSessionManager = new SecureSessionManager({
  requireReauthOnReopen: true, // Security: require login after closing
  maxAge: 4 * 60 * 60 * 1000, // 4 hours max session
  inactivityTimeout: 15 * 60 * 1000, // 15 minutes inactivity timeout
});

export default secureSessionManager;