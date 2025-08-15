/**
 * Simple Token Manager for Django JWT Authentication
 * Replaces the overly complex secureSessionManager
 */

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface AuthUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: "student" | "supervisor" | "admin";
}

class SimpleTokenManager {
  private static readonly TOKEN_KEY = 'django_token';
  private static readonly REFRESH_KEY = 'refresh_token';
  private static readonly USER_KEY = 'auth_user';

  /**
   * Store authentication tokens
   */
  setTokens(accessToken: string, refreshToken: string): void {
    localStorage.setItem(SimpleTokenManager.TOKEN_KEY, accessToken);
    localStorage.setItem(SimpleTokenManager.REFRESH_KEY, refreshToken);
  }

  /**
   * Get access token
   */
  getAccessToken(): string | null {
    return localStorage.getItem(SimpleTokenManager.TOKEN_KEY);
  }

  /**
   * Get refresh token
   */
  getRefreshToken(): string | null {
    return localStorage.getItem(SimpleTokenManager.REFRESH_KEY);
  }

  /**
   * Store user data
   */
  setUser(user: AuthUser): void {
    localStorage.setItem(SimpleTokenManager.USER_KEY, JSON.stringify(user));
  }

  /**
   * Get stored user data
   */
  getUser(): AuthUser | null {
    const userData = localStorage.getItem(SimpleTokenManager.USER_KEY);
    return userData ? JSON.parse(userData) : null;
  }

  /**
   * Check if user is authenticated (has valid token)
   */
  isAuthenticated(): boolean {
    const token = this.getAccessToken();
    const user = this.getUser();
    return !!(token && user);
  }

  /**
   * Clear all authentication data
   */
  clearAll(): void {
    localStorage.removeItem(SimpleTokenManager.TOKEN_KEY);
    localStorage.removeItem(SimpleTokenManager.REFRESH_KEY);
    localStorage.removeItem(SimpleTokenManager.USER_KEY);
    
    // Also clear any old session storage data
    sessionStorage.clear();
  }

  /**
   * Get authentication header for API requests
   */
  getAuthHeader(): { Authorization: string } | {} {
    const token = this.getAccessToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
  }
}

// Export singleton instance
export const simpleTokenManager = new SimpleTokenManager();
export default simpleTokenManager;