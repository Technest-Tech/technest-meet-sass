import { NextRequest, NextResponse } from 'next/server';

// Simple in-memory rate limiter for development
// For production, use Redis or a dedicated rate limiting service
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
}

export interface RateLimitResult {
  success: boolean;
  retryAfter?: number;
}

/**
 * Rate limiting function
 * @param request NextRequest object
 * @param config Rate limit configuration
 */
export async function rateLimit(
  request: NextRequest,
  config: RateLimitConfig
): Promise<RateLimitResult> {
  const identifier = getIdentifier(request);
  const now = Date.now();
  const { maxRequests, windowMs } = config;
  
  // Clean up expired entries
  cleanupExpiredEntries(now);
  
  const record = rateLimitMap.get(identifier);
  
  if (!record) {
    // First request from this identifier
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return { success: true };
  }
  
  if (now > record.resetTime) {
    // Window has expired, reset
    rateLimitMap.set(identifier, {
      count: 1,
      resetTime: now + windowMs
    });
    return { success: true };
  }
  
  if (record.count >= maxRequests) {
    // Rate limit exceeded
    const retryAfter = Math.ceil((record.resetTime - now) / 1000);
    return { 
      success: false,
      retryAfter
    };
  }
  
  // Increment counter
  record.count++;
  
  return { success: true };
}

/**
 * Get identifier for rate limiting (IP address)
 */
function getIdentifier(request: NextRequest): string {
  // Try to get real IP from headers (for proxies)
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }
  
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Fallback to a default identifier
  return 'unknown';
}

/**
 * Clean up expired entries from the rate limit map
 */
function cleanupExpiredEntries(now: number) {
  for (const [key, value] of rateLimitMap.entries()) {
    if (now > value.resetTime) {
      rateLimitMap.delete(key);
    }
  }
}


