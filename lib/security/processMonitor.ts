/**
 * Runtime process monitoring to detect suspicious child processes
 * Alerts on command execution patterns that could indicate malware
 */

import { logSecurityEvent } from '@/lib/utils/securityLogger';

interface ProcessAlert {
  command: string;
  pid: number;
  timestamp: Date;
  suspicious: boolean;
}

// Patterns that indicate malicious activity
const SUSPICIOUS_PATTERNS = [
  /wget\s+/i,
  /curl\s+/i,
  /bash\s+-c/i,
  /sh\s+-c/i,
  /nc\s+/i,
  /netcat\s+/i,
  /python\s+-c/i,
  /perl\s+-e/i,
  /ruby\s+-e/i,
  /node\s+-e/i,
  /eval\s*\(/i,
  /exec\s*\(/i,
  /system\s*\(/i,
];

// Commands that should never be executed
const FORBIDDEN_COMMANDS = [
  'wget',
  'curl',
  'nc',
  'netcat',
  'bash -c',
  'sh -c',
];

let monitoringEnabled = false;
let alertThreshold = 3; // Alert after 3 suspicious processes

/**
 * Check if a command is suspicious
 */
export function isSuspiciousCommand(command: string): boolean {
  if (!command || typeof command !== 'string') {
    return false;
  }

  // Check for forbidden commands
  if (FORBIDDEN_COMMANDS.some(cmd => command.toLowerCase().includes(cmd.toLowerCase()))) {
    return true;
  }

  // Check for suspicious patterns
  return SUSPICIOUS_PATTERNS.some(pattern => pattern.test(command));
}

/**
 * Monitor and log suspicious process creation
 * Call this when detecting child process execution
 */
export function monitorProcess(command: string, pid?: number): void {
  if (!monitoringEnabled) {
    return;
  }

  if (isSuspiciousCommand(command)) {
    const alert: ProcessAlert = {
      command,
      pid: pid || 0,
      timestamp: new Date(),
      suspicious: true,
    };

    logSecurityEvent({
      type: 'COMMAND_INJECTION_ATTEMPT',
      ip: 'internal',
      userAgent: 'process-monitor',
      details: `Suspicious process detected: ${command.substring(0, 200)}`,
    });

    console.error('[SECURITY] Suspicious process detected:', alert);

    // In production, you might want to:
    // 1. Send alert to monitoring service
    // 2. Kill the process if possible
    // 3. Trigger incident response
  }
}

/**
 * Enable process monitoring
 */
export function enableProcessMonitoring(): void {
  monitoringEnabled = true;
  console.log('[Security] Process monitoring enabled');
}

/**
 * Disable process monitoring
 */
export function disableProcessMonitoring(): void {
  monitoringEnabled = false;
  console.log('[Security] Process monitoring disabled');
}

/**
 * Set alert threshold
 */
export function setAlertThreshold(threshold: number): void {
  alertThreshold = Math.max(1, threshold);
}

/**
 * Get current monitoring status
 */
export function getMonitoringStatus(): { enabled: boolean; threshold: number } {
  return {
    enabled: monitoringEnabled,
    threshold: alertThreshold,
  };
}

// Enable monitoring by default in production
if (process.env.NODE_ENV === 'production') {
  enableProcessMonitoring();
}
