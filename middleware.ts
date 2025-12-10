import { NextRequest, NextResponse } from 'next/server';
import { logSuspiciousUserAgent, logBlockedIP, logBlockedPostRoot, logCommandInjectionAttempt } from '@/lib/utils/securityLogger';
import { detectCommandInjection } from '@/lib/utils/sanitize';

// Suspicious user agents that indicate bots/scanners
const SUSPICIOUS_USER_AGENTS = [
  'python-requests',
  'curl',
  'wget',
  'go-http-client',
  'java/',
  'scanner',
  'bot',
  'crawler',
  'spider',
];

// Known attacker IPs from security incidents
const BLOCKED_IPS: string[] = [
  '45.76.155.14',        // Dec 5, 2025 attacker
  '176.117.107.158',     // Malware server
  '176.117.107.154',     // Secondary malware server
  '193.34.213.150',      // Additional attacker
];

// Suspicious file extensions that could be used for attacks
const DANGEROUS_EXTENSIONS = ['.sh', '.exe', '.bat', '.cmd', '.ps1', '.py', '.pl', '.rb'];

export function middleware(request: NextRequest) {
  const { pathname, method, searchParams } = request.nextUrl;
  const userAgent = request.headers.get('user-agent') || '';
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
  
  // Block suspicious user agents on POST requests
  if (method === 'POST') {
    const isSuspiciousUA = SUSPICIOUS_USER_AGENTS.some(ua => 
      userAgent.toLowerCase().includes(ua.toLowerCase())
    );
    
    if (isSuspiciousUA) {
      logSuspiciousUserAgent(ip, userAgent, pathname);
      return NextResponse.json(
        { error: 'Forbidden', message: 'Request blocked by security policy' },
        { status: 403 }
      );
    }
  }
  
  // Block known attacker IPs
  const clientIp = ip.split(',')[0].trim();
  if (BLOCKED_IPS.includes(clientIp)) {
    logBlockedIP(clientIp, pathname);
    return NextResponse.json(
      { error: 'Forbidden', message: 'Access denied' },
      { status: 403 }
    );
  }
  
  // Block POST requests to root endpoint (additional layer)
  if (method === 'POST' && pathname === '/') {
    logBlockedPostRoot(ip, userAgent || 'unknown');
    return NextResponse.json(
      { error: 'Method not allowed', message: 'POST requests to root endpoint are not permitted' },
      { status: 405 }
    );
  }

  // Check for command injection patterns in query parameters
  for (const [key, value] of searchParams.entries()) {
    if (detectCommandInjection(value)) {
      logCommandInjectionAttempt(ip, userAgent, `query param ${key}: ${value.substring(0, 100)}`);
      return NextResponse.json(
        { error: 'Forbidden', message: 'Invalid request detected' },
        { status: 403 }
      );
    }
  }

  // Block requests with dangerous file extensions in path
  const lowerPath = pathname.toLowerCase();
  if (DANGEROUS_EXTENSIONS.some(ext => lowerPath.endsWith(ext))) {
    return NextResponse.json(
      { error: 'Forbidden', message: 'File type not allowed' },
      { status: 403 }
    );
  }

  // Validate Content-Type for POST requests
  if (method === 'POST') {
    const contentType = request.headers.get('content-type') || '';
    // Block suspicious content types that could be used for attacks
    if (contentType.includes('application/x-www-form-urlencoded') && 
        pathname.startsWith('/api/') && 
        !contentType.includes('multipart')) {
      // Additional validation could go here
    }
  }
  
  // Add security headers
  const response = NextResponse.next();
  
  // Security headers (some may be overridden by next.config.js)
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'SAMEORIGIN');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  return response;
}

// Apply middleware to all routes except static files and API routes that need special handling
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)).*)',
  ],
};

