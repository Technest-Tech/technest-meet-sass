import { NextRequest } from 'next/server';

export type DeviceType = 'desktop' | 'mobile' | 'tablet' | 'unknown';

export interface DeviceInfo {
  ip: string;
  browser: string;
  deviceType: DeviceType;
  os: string;
  userAgent: string;
}

type HeaderSource = Pick<Headers, 'get'>;

function getIpAddress(headers: HeaderSource): string {
  const forwarded = headers.get('x-forwarded-for');
  if (forwarded) {
    return forwarded.split(',')[0].trim();
  }

  const realIp = headers.get('x-real-ip');
  if (realIp) {
    return realIp.trim();
  }

  return 'unknown';
}

function detectBrowser(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('edg/')) return 'Edge';
  if (ua.includes('opr/') || ua.includes('opera')) return 'Opera';
  if (ua.includes('chrome')) return 'Chrome';
  if (ua.includes('safari')) return 'Safari';
  if (ua.includes('firefox')) return 'Firefox';
  if (ua.includes('msie') || ua.includes('trident')) return 'IE';

  return 'Unknown';
}

function detectDeviceType(userAgent: string): DeviceType {
  const ua = userAgent.toLowerCase();

  if (/ipad|tablet/.test(ua)) return 'tablet';
  if (/mobi|iphone|android/.test(ua)) return 'mobile';
  if (/windows|macintosh|linux/.test(ua)) return 'desktop';

  return 'unknown';
}

function detectOS(userAgent: string): string {
  const ua = userAgent.toLowerCase();

  if (ua.includes('windows')) return 'Windows';
  if (ua.includes('mac os') || ua.includes('macintosh')) return 'macOS';
  if (ua.includes('android')) return 'Android';
  if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'iOS';
  if (ua.includes('linux')) return 'Linux';

  return 'Unknown';
}

/**
 * Extract device information (IP, browser, device type) from a NextRequest or headers object.
 */
export function extractDeviceInfo(requestOrHeaders: NextRequest | HeaderSource): DeviceInfo {
  const headers = 'get' in requestOrHeaders ? requestOrHeaders : requestOrHeaders.headers;
  const userAgent = headers.get('user-agent') || 'Unknown';

  return {
    ip: getIpAddress(headers),
    browser: detectBrowser(userAgent),
    deviceType: detectDeviceType(userAgent),
    os: detectOS(userAgent),
    userAgent,
  };
}

