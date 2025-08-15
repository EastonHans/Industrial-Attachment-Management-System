/**
 * Server Health Check Utility
 * Checks if Django backend is running and provides helpful error messages
 */

const API_BASE_URL = import.meta.env.VITE_DJANGO_API_URL || 'http://localhost:8080/api';

export interface HealthCheckResult {
  isHealthy: boolean;
  message: string;
  suggestions: string[];
}

export async function checkServerHealth(): Promise<HealthCheckResult> {
  try {
    console.log('🔍 Checking server health...');
    
    // Try to reach the Django API root
    const response = await fetch(`${API_BASE_URL}/`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
      // Add timeout to prevent hanging
      signal: AbortSignal.timeout(5000)
    });

    if (response.ok) {
      console.log('✅ Server is healthy');
      return {
        isHealthy: true,
        message: 'Server is running properly',
        suggestions: []
      };
    } else {
      console.warn(`⚠️ Server responded with status: ${response.status}`);
      return {
        isHealthy: false,
        message: `Server error: ${response.status} ${response.statusText}`,
        suggestions: [
          'Check Django server logs for errors',
          'Verify database connection',
          'Check Django settings configuration'
        ]
      };
    }

  } catch (error: any) {
    console.error('❌ Server health check failed:', error);

    // Connection refused - server not running
    if (error.message?.includes('Failed to fetch') || error.name === 'TypeError') {
      return {
        isHealthy: false,
        message: 'Cannot connect to Django server',
        suggestions: [
          '1. Start the Django server: python manage.py runserver',
          '2. Check if port 8000 is available',
          '3. Verify VITE_DJANGO_API_URL is correct',
          '4. Check firewall settings'
        ]
      };
    }

    // Timeout error
    if (error.name === 'TimeoutError' || error.message?.includes('timeout')) {
      return {
        isHealthy: false,
        message: 'Server response timeout',
        suggestions: [
          'Server may be overloaded',
          'Check network connection',
          'Restart Django server'
        ]
      };
    }

    // Generic error
    return {
      isHealthy: false,
      message: `Connection error: ${error.message}`,
      suggestions: [
        'Check Django server is running',
        'Verify network connection',
        'Check browser console for details'
      ]
    };
  }
}

/**
 * Display server health check results to user
 */
export function displayHealthCheckResult(result: HealthCheckResult): void {
  if (result.isHealthy) {
    console.log('✅ Server Health Check: PASSED');
    return;
  }

  console.error('❌ Server Health Check: FAILED');
  console.error('📝 Issue:', result.message);
  console.error('💡 Suggestions:');
  result.suggestions.forEach((suggestion, index) => {
    console.error(`   ${index + 1}. ${suggestion}`);
  });
}

/**
 * Create user-friendly error message for login failures
 */
export function createConnectionErrorMessage(result: HealthCheckResult): string {
  let message = `🔌 Connection Issue: ${result.message}\n\n`;
  
  message += '💡 To fix this:\n';
  result.suggestions.forEach((suggestion, index) => {
    message += `${index + 1}. ${suggestion}\n`;
  });

  message += '\n📚 See START_SERVERS.md for detailed setup instructions.';
  
  return message;
}

export default { checkServerHealth, displayHealthCheckResult, createConnectionErrorMessage };