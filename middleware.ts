import { NextRequest, NextResponse } from 'next/server';
import { logSuspiciousUserAgent, logBlockedIP, logBlockedPostRoot } from '@/lib/utils/securityLogger';

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

// Blocked IPs (can be expanded)
const BLOCKED_IPS: string[] = [
  // Add known attacker IPs here if needed
  // '45.76.155.14',
  // '193.34.213.150',
];

export function middleware(request: NextRequest) {
  const { pathname, method } = request.nextUrl;
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

