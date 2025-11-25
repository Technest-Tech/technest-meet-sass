import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../utils/logger';

/**
 * Simple CSRF token validation
 * For production, consider using a proper CSRF library with token rotation
 */

const CSRF_TOKEN_HEADER = 'x-csrf-token';
const CSRF_TOKEN_COOKIE = 'csrf-token';

/**
 * Generate a CSRF token
 */
export function generateCSRFToken(): string {
  // Generate a random token
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Validate CSRF token from request
 */
export function validateCSRF(request: NextRequest): boolean {
  // Skip CSRF validation for GET, HEAD, OPTIONS requests
  if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) {
    return true;
  }

  // Get token from header
  const headerToken = request.headers.get(CSRF_TOKEN_HEADER);
  
  // Get token from cookie
  const cookieToken = request.cookies.get(CSRF_TOKEN_COOKIE)?.value;

  // Both tokens must exist and match
  if (!headerToken || !cookieToken) {
    logger.warn('CSRF validation failed: Missing tokens');
    return false;
  }

  if (headerToken !== cookieToken) {
    logger.warn('CSRF validation failed: Token mismatch');
    return false;
  }

  return true;
}

/**
 * CSRF middleware for API routes
 */
export function csrfProtection(request: NextRequest): NextResponse | null {
  if (!validateCSRF(request)) {
    return NextResponse.json(
      { 
        error: 'CSRF validation failed',
        message: 'Invalid or missing CSRF token'
      },
      { status: 403 }
    );
  }

  return null; // Validation passed
}

/**
 * Set CSRF token in response cookie
 */
export function setCSRFToken(response: NextResponse): NextResponse {
  const token = generateCSRFToken();
  
  response.cookies.set(CSRF_TOKEN_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 60 * 60 * 24 // 24 hours
  });

  // Also include token in response header for client to read
  response.headers.set(CSRF_TOKEN_HEADER, token);

  return response;
}















