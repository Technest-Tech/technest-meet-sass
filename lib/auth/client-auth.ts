'use client';

/**
 * Client-side authentication helpers
 */

/**
 * Check if user is authenticated (client-side check)
 * Note: This is just for UI state, actual auth is server-side
 */
export function isAuthenticated(): boolean {
  // Since we use httpOnly cookies, we can't check from client
  // This is just a placeholder for UI state management
  return false;
}

/**
 * Logout function (client-side)
 * Calls server API to clear session
 */
export async function logout(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include',
    });
    window.location.href = '/';
  } catch (error) {
    console.error('Logout failed:', error);
    // Force redirect anyway
    window.location.href = '/';
  }
}

/**
 * Get user info from server
 */
export async function getUserInfo(): Promise<{ role: string; email: string } | null> {
  try {
    const response = await fetch('/api/auth/me', {
      credentials: 'include',
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Failed to get user info:', error);
    return null;
  }
}

