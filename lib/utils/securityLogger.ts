/**
 * Security event logging utility
 * Logs security-related events for monitoring and alerting
 */

interface SecurityEvent {
  type: 'BLOCKED_POST_ROOT' | 'SUSPICIOUS_UA' | 'BLOCKED_IP' | 'FILE_UPLOAD_ATTEMPT' | 'COMMAND_INJECTION_ATTEMPT';
  ip: string;
  userAgent?: string;
  path?: string;
  method?: string;
  details?: string;
  timestamp: Date;
}

/**
 * Log a security event
 */
export function logSecurityEvent(event: Omit<SecurityEvent, 'timestamp'>) {
  const fullEvent: SecurityEvent = {
    ...event,
    timestamp: new Date(),
  };

  // Log to console with [SECURITY] prefix for easy filtering
  console.warn(`[SECURITY] ${fullEvent.type}`, {
    ip: fullEvent.ip,
    userAgent: fullEvent.userAgent,
    path: fullEvent.path,
    method: fullEvent.method,
    details: fullEvent.details,
    timestamp: fullEvent.timestamp.toISOString(),
  });

  // In production, you might want to send this to a logging service
  // Example: sendToLoggingService(fullEvent);
}

/**
 * Log blocked POST request to root
 */
export function logBlockedPostRoot(ip: string, userAgent?: string) {
  logSecurityEvent({
    type: 'BLOCKED_POST_ROOT',
    ip,
    userAgent,
    path: '/',
    method: 'POST',
    details: 'POST request to root endpoint blocked',
  });
}

/**
 * Log suspicious user agent
 */
export function logSuspiciousUserAgent(ip: string, userAgent: string, path: string) {
  logSecurityEvent({
    type: 'SUSPICIOUS_UA',
    ip,
    userAgent,
    path,
    details: `Suspicious user agent detected: ${userAgent}`,
  });
}

/**
 * Log blocked IP
 */
export function logBlockedIP(ip: string, path: string) {
  logSecurityEvent({
    type: 'BLOCKED_IP',
    ip,
    path,
    details: 'Request from known attacker IP blocked',
  });
}

/**
 * Log file upload attempt
 */
export function logFileUploadAttempt(ip: string, filename: string, roomLink: string) {
  logSecurityEvent({
    type: 'FILE_UPLOAD_ATTEMPT',
    ip,
    path: '/api/room-files/upload',
    method: 'POST',
    details: `File upload: ${filename} to room: ${roomLink}`,
  });
}

/**
 * Log command injection attempt
 */
export function logCommandInjectionAttempt(ip: string, userAgent: string, input: string) {
  logSecurityEvent({
    type: 'COMMAND_INJECTION_ATTEMPT',
    ip,
    userAgent,
    details: `Potential command injection detected in input: ${input.substring(0, 100)}`,
  });
}

