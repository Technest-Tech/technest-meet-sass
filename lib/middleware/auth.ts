import { NextRequest, NextResponse } from 'next/server';
import { getSession, requireSuperAdmin, requireClient } from '@/lib/auth/server-auth';

/**
 * Middleware to require authentication
 */
export async function requireAuth(request: NextRequest): Promise<{ userId: string; email: string; role: string; clientId?: string } | null> {
  try {
    const session = await getSession();
    if (!session) {
      return null;
    }
    return session;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to require super admin role
 */
export async function requireSuperAdminAuth(request: NextRequest): Promise<{ userId: string; email: string; role: string } | null> {
  try {
    const session = await requireSuperAdmin();
    return session;
  } catch (error) {
    return null;
  }
}

/**
 * Middleware to require client role
 */
export async function requireClientAuth(request: NextRequest): Promise<{ userId: string; email: string; role: string; clientId: string } | null> {
  try {
    const session = await requireClient();
    return session;
  } catch (error) {
    return null;
  }
}

/**
 * Create unauthorized response
 */
export function unauthorizedResponse(message: string = 'Unauthorized') {
  return NextResponse.json({ error: message }, { status: 401 });
}

/**
 * Create forbidden response
 */
export function forbiddenResponse(message: string = 'Forbidden') {
  return NextResponse.json({ error: message }, { status: 403 });
}

