/**
 * Django API service to replace Supabase client
 * Complete replacement for all Supabase operations
 */

export const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || (import.meta.env.DEV ? '/api' : 'http://localhost:8080/api');

import { simpleTokenManager } from '@/utils/simpleTokenManager';

// Simple token management
export const tokenManager = {
  getAccessToken: () => simpleTokenManager.getAccessToken(),
  getRefreshToken: () => simpleTokenManager.getRefreshToken(),
  setTokens: (access: string, refresh: string) => simpleTokenManager.setTokens(access, refresh),
  clearTokens: () => simpleTokenManager.clearAll(),
  getUser: () => simpleTokenManager.getUser(),
  setUser: (user: any) => simpleTokenManager.setUser(user)
};

// HTTP request helper
class ApiClient {
  private async request(endpoint: string, options: RequestInit = {}) {
    const url = `${API_BASE_URL}${endpoint}`;
    const token = tokenManager.getAccessToken();
    
    const defaultHeaders: HeadersInit = {
      'Content-Type': 'application/json',
    };
    
    if (token) {
      defaultHeaders.Authorization = `Bearer ${token}`;
    }
    
    const config: RequestInit = {
      ...options,
      headers: {
        ...defaultHeaders,
        ...options.headers,
      },
    };
    
    try {
      const response = await fetch(url, config);
      
      // Handle token refresh if needed
      if (response.status === 401 && token) {
        const refreshed = await this.refreshToken();
        if (refreshed) {
          // Retry the request with new token
          config.headers = {
            ...defaultHeaders,
            Authorization: `Bearer ${tokenManager.getAccessToken()}`,
            ...options.headers,
          };
          return await fetch(url, config);
        } else {
          // Refresh failed, redirect to login
          tokenManager.clearTokens();
          window.location.href = '/login';
          throw new Error('Authentication failed');
        }
      }
      
      return response;
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }
  
  private async refreshToken(): Promise<boolean> {
    const refreshToken = tokenManager.getRefreshToken();
    if (!refreshToken) return false;
    
    try {
      const response = await fetch(`${API_BASE_URL}/auth/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh: refreshToken }),
      });
      
      if (response.ok) {
        const data = await response.json();
        tokenManager.setTokens(data.access, refreshToken);
        return true;
      }
    } catch (error) {
      console.error('Token refresh failed:', error);
    }
    
    return false;
  }
  
  async get(endpoint: string) {
    const response = await this.request(endpoint, { method: 'GET' });
    return this.handleResponse(response);
  }
  
  async post(endpoint: string, data: any) {
    const response = await this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }
  
  async put(endpoint: string, data: any) {
    const response = await this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }
  
  async patch(endpoint: string, data: any) {
    const response = await this.request(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(data),
    });
    return this.handleResponse(response);
  }
  
  async delete(endpoint: string) {
    const response = await this.request(endpoint, { method: 'DELETE' });
    return this.handleResponse(response);
  }
  
  private async handleResponse(response: Response) {
    if (!response.ok) {
      let errorMessage = 'An error occurred';
      
      try {
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
          const errorData = await response.json();
          
          // Extract user-friendly error message
          if (errorData.detail) {
            errorMessage = errorData.detail;
          } else if (errorData.message) {
            errorMessage = errorData.message;
          } else if (errorData.error) {
            errorMessage = errorData.error;
          } else if (errorData.non_field_errors && Array.isArray(errorData.non_field_errors)) {
            errorMessage = errorData.non_field_errors[0];
          } else if (errorData.email && Array.isArray(errorData.email)) {
            // Handle Django field validation errors for email
            errorMessage = errorData.email[0];
          } else if (errorData.password && Array.isArray(errorData.password)) {
            // Handle Django field validation errors for password
            errorMessage = errorData.password[0];
          } else if (typeof errorData === 'string') {
            errorMessage = errorData;
          } else {
            // Handle other field validation errors
            const firstError = Object.values(errorData).find(value => 
              Array.isArray(value) && value.length > 0
            );
            if (firstError) {
              errorMessage = (firstError as string[])[0];
            }
          }
        } else {
          const errorText = await response.text();
          if (errorText) {
            errorMessage = errorText;
          }
        }
      } catch (parseError) {
        // If we can't parse the error response, fall back to status-based messages
        console.error('Error parsing error response:', parseError);
      }
      
      // Provide user-friendly messages based on status code
      if (response.status === 400) {
        if (errorMessage.includes('Invalid credentials') || errorMessage.includes('password')) {
          errorMessage = 'Invalid email or password. Please check your credentials and try again.';
        } else if (errorMessage.includes('email')) {
          errorMessage = 'Please enter a valid email address.';
        }
      } else if (response.status === 401) {
        errorMessage = 'Invalid email or password. Please check your credentials and try again.';
      } else if (response.status === 403) {
        errorMessage = 'Access denied. Please check your account permissions.';
      } else if (response.status === 404) {
        errorMessage = 'Account not found. Please check your email address.';
      } else if (response.status === 429) {
        errorMessage = 'Too many login attempts. Please wait a moment and try again.';
      } else if (response.status >= 500) {
        errorMessage = 'Server error. Please try again later.';
      } else if (errorMessage.includes('HTTP') || errorMessage.length > 100) {
        // If error message still contains HTTP codes or is too long, provide a generic message
        errorMessage = 'Login failed. Please check your credentials and try again.';
      }
      
      console.error(`API Error - Status: ${response.status}, Message: ${errorMessage}`);
      throw new Error(errorMessage);
    }
    
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      return await response.json();
    }
    
    return await response.text();
  }
}

const apiClient = new ApiClient();

// Authentication API
export const auth = {
  async signUp(userData: {
    email: string;
    password: string;
    password_confirm: string;
    first_name: string;
    last_name: string;
    role: string;
    phone_number?: string;
    student_id?: string;
    program?: string;
    year_of_study?: number;
    department?: string;
    title?: string;
  }) {
    try {
      const data = await apiClient.post('/auth/register/', userData);
      tokenManager.setTokens(data.tokens.access, data.tokens.refresh);
      tokenManager.setUser(data.user);
      return { data: { user: data.user }, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error: { message: error instanceof Error ? error.message : 'Sign up failed' } };
    }
  },
  
  async signInWithPassword({ email, password }: { email: string; password: string }) {
    try {
      const data = await apiClient.post('/auth/login/', { email, password });
      tokenManager.setTokens(data.tokens.access, data.tokens.refresh);
      tokenManager.setUser(data.user);
      return { data: { user: data.user }, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error: { message: error instanceof Error ? error.message : 'Login failed' } };
    }
  },
  
  async signOut() {
    try {
      const refreshToken = tokenManager.getRefreshToken();
      if (refreshToken) {
        await apiClient.post('/auth/logout/', { refresh: refreshToken });
      }
    } catch (error) {
      console.error('Sign out error:', error);
    } finally {
      tokenManager.clearTokens();
      return { error: null };
    }
  },
  
  getUser() {
    return tokenManager.getUser();
  },
  
  onAuthStateChange(callback: (event: string, session: any) => void) {
    // Simple implementation - in a real app you might want to use WebSockets or polling
    const user = tokenManager.getUser();
    const token = tokenManager.getAccessToken();
    
    if (user && token) {
      callback('SIGNED_IN', { user });
    } else {
      callback('SIGNED_OUT', null);
    }
    
    // Return unsubscribe function
    return {
      data: { subscription: { unsubscribe: () => {} } }
    };
  }
};

// Chainable query builder
class ChainableQuery {
  constructor(private table: DatabaseTable, private params: Record<string, any>) {}

  // Filter methods - adapted for Django REST Framework
  eq(column: string, value: any): ChainableQuery {
    // For Django REST Framework, we typically don't need explicit filtering
    // as the ViewSets handle permissions and user-based filtering automatically
    // However, we'll keep this for compatibility with specific filter needs
    return new ChainableQuery(this.table, { ...this.params, [column]: value });
  }

  neq(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__ne`]: value });
  }

  gt(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__gt`]: value });
  }

  gte(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__gte`]: value });
  }

  lt(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__lt`]: value });
  }

  lte(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__lte`]: value });
  }

  like(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__icontains`]: value });
  }

  ilike(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__icontains`]: value });
  }

  is(column: string, value: any): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [column]: value });
  }

  in(column: string, values: any[]): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, [`${column}__in`]: values.join(',') });
  }

  // Sorting and pagination
  order(column: string, options?: { ascending?: boolean }): ChainableQuery {
    const ordering = options?.ascending === false ? `-${column}` : column;
    return new ChainableQuery(this.table, { ...this.params, ordering });
  }

  limit(count: number): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, limit: count });
  }

  range(from: number, to: number): ChainableQuery {
    return new ChainableQuery(this.table, { ...this.params, offset: from, limit: to - from + 1 });
  }

  // Execution methods
  single(): Promise<any> {
    // For Django REST API, getting a single record is usually the first item
    // from the filtered list, since ViewSets handle user permissions
    return this.table['querySingle'](this.params);
  }

  // Promise interface
  then(resolve?: any, reject?: any): Promise<any> {
    return this.table['query'](this.params).then(resolve, reject);
  }

  catch(reject?: any): Promise<any> {
    return this.table['query'](this.params).catch(reject);
  }
}

// Database operations helper
class DatabaseTable {
  constructor(private tableName: string) {}
  
  select(columns: string = '*') {
    return new ChainableQuery(this, {});
  }
  
  private async query(params: Record<string, any> = {}) {
    try {
      const queryString = new URLSearchParams(params).toString();
      const endpoint = queryString ? `/${this.tableName}/?${queryString}` : `/${this.tableName}/`;
      
      const data = await apiClient.get(endpoint);
      
      // Handle paginated response
      if (data.results) {
        return { data: data.results, error: null, count: data.count };
      }
      
      return { data, error: null };
    } catch (error) {
      console.error(`Query error for ${this.tableName}:`, error);
      return { data: null, error: { message: error instanceof Error ? error.message : 'Query failed' } };
    }
  }
  
  private async querySingle(params: Record<string, any> = {}) {
    try {
      // For Django REST API, we usually don't need the limit parameter
      // since ViewSets handle user-based filtering automatically
      const cleanParams = { ...params };
      delete cleanParams.limit; // Remove limit as it's not typically needed
      
      const response = await this.query(cleanParams);
      
      // If the query returned an error, propagate it
      if (response.error) {
        return { data: null, error: response.error };
      }
      
      // If we have data and it's an array with items, return the first item
      if (response.data && Array.isArray(response.data) && response.data.length > 0) {
        return { data: response.data[0], error: null };
      }
      
      // No data found, but no error either
      return { data: null, error: null };
    } catch (error) {
      return { data: null, error: { message: error instanceof Error ? error.message : 'Query failed' } };
    }
  }
  
  async insert(data: any | any[]) {
    try {
      const result = await apiClient.post(`/${this.tableName}/`, data);
      return { data: result, error: null };
    } catch (error) {
      console.error(`Insert error for ${this.tableName}:`, error);
      return { data: null, error: { message: error instanceof Error ? error.message : 'Insert failed' } };
    }
  }
  
  async update(data: any) {
    return {
      eq: async (column: string, value: any) => {
        try {
          // For updates, we need the ID to update a specific record
          if (column === 'id') {
            const result = await apiClient.patch(`/${this.tableName}/${value}/`, data);
            return { data: result, error: null };
          }
          // For other columns, we might need to find the record first
          throw new Error('Update by non-ID column not supported. Use ID for updates.');
        } catch (error) {
          console.error(`Update error for ${this.tableName}:`, error);
          return { data: null, error: { message: error instanceof Error ? error.message : 'Update failed' } };
        }
      }
    };
  }
  
  async upsert(data: any | any[]) {
    try {
      // For Django REST Framework, we'll use POST for upserts since PUT on collections is not supported
      // Django models can handle upserts on the backend using get_or_create or update_or_create
      const result = await apiClient.post(`/${this.tableName}/`, data);
      return { data: result, error: null };
    } catch (error) {
      console.error(`Upsert error for ${this.tableName}:`, error);
      return { data: null, error: { message: error instanceof Error ? error.message : 'Upsert failed' } };
    }
  }

  async delete() {
    return {
      eq: async (column: string, value: any) => {
        try {
          if (column === 'id') {
            await apiClient.delete(`/${this.tableName}/${value}/`);
            return { data: null, error: null };
          } else {
            // For non-ID columns, we need to find the records first, then delete by ID
            const records = await this.query({ [column]: value });
            if (records.data && Array.isArray(records.data)) {
              for (const record of records.data) {
                await apiClient.delete(`/${this.tableName}/${record.id}/`);
              }
            }
            return { data: null, error: null };
          }
        } catch (error) {
          console.error(`Delete error for ${this.tableName}:`, error);
          return { data: null, error: { message: error instanceof Error ? error.message : 'Delete failed' } };
        }
      }
    };
  }
}

// Database tables - mapped to Django REST API endpoints
export const supabase = {
  auth,
  from: (tableName: string) => {
    // Map Supabase-style table names to Django endpoint names
    const tableMapping: Record<string, string> = {
      'verification_status': 'verification-status',
      'weekly_logs': 'weekly-logs', 
      'supervisor_assignments': 'supervisor-assignments',
      'users': 'users',
      'students': 'students',
      'supervisors': 'supervisors',
      'companies': 'companies',
      'attachments': 'attachments',
      'reimbursements': 'reimbursements',
      'evaluations': 'evaluations',
      'messages': 'messages',
      'profiles': 'profiles'
    };
    
    const mappedName = tableMapping[tableName] || tableName;
    return new DatabaseTable(mappedName);
  },
  
  // Specific table helpers for better type safety
  users: new DatabaseTable('users'),
  students: new DatabaseTable('students'),
  supervisors: new DatabaseTable('supervisors'),
  companies: new DatabaseTable('companies'),
  attachments: new DatabaseTable('attachments'),
  reimbursements: new DatabaseTable('reimbursements'),
  verification_status: new DatabaseTable('verification-status'),
  weekly_logs: new DatabaseTable('weekly-logs'),
  evaluations: new DatabaseTable('evaluations'),
  supervisor_assignments: new DatabaseTable('supervisor-assignments'),
  messages: new DatabaseTable('messages'),
  profiles: new DatabaseTable('profiles'),
};

// Export as default for drop-in replacement
export default supabase;