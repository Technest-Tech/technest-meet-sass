import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';

const secretKey = process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-this-in-production';
const key = new TextEncoder().encode(secretKey);

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'SUPER_ADMIN' | 'CLIENT';
  clientId?: string;
}

/**
 * Create a JWT session token
 */
export async function createSession(payload: SessionPayload): Promise<string> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

  const session = await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(key);

  return session;
}

/**
 * Verify and decode JWT session token
 */
export async function verifySession(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key);
    return payload as SessionPayload;
  } catch (error) {
    return null;
  }
}

/**
 * Get session from httpOnly cookie
 */
export async function getSession(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const sessionToken = cookieStore.get('session')?.value;

  if (!sessionToken) {
    return null;
  }

  return verifySession(sessionToken);
}

/**
 * Set session cookie (returns cookie string for NextResponse)
 */
export async function getSessionCookie(payload: SessionPayload): Promise<string> {
  const sessionToken = await createSession(payload);
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days
  
  const isProduction = process.env.NODE_ENV === 'production';
  
  return `session=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; ${isProduction ? 'Secure; ' : ''}Max-Age=${7 * 24 * 60 * 60}; Expires=${expiresAt.toUTCString()}`;
}

/**
 * Set session cookie (for use with cookies() helper in server components)
 */
export async function setSession(payload: SessionPayload): Promise<void> {
  const sessionToken = await createSession(payload);
  const cookieStore = await cookies();

  cookieStore.set('session', sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60, // 7 days
    path: '/',
  });
}

/**
 * Delete session cookie
 */
export async function deleteSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}

/**
 * Hash password with bcrypt
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

/**
 * Verify password with bcrypt
 */
export async function verifyPassword(password: string, hashedPassword: string): Promise<boolean> {
  return bcrypt.compare(password, hashedPassword);
}

/**
 * Authenticate super admin
 */
export async function authenticateSuperAdmin(email: string, password: string): Promise<SessionPayload | null> {
  const superAdmin = await prisma.superAdmin.findUnique({
    where: { email },
  });

  if (!superAdmin) {
    return null;
  }

  const isValid = await verifyPassword(password, superAdmin.password);
  if (!isValid) {
    return null;
  }

  return {
    userId: superAdmin.id,
    email: superAdmin.email,
    role: 'SUPER_ADMIN',
  };
}

/**
 * Authenticate client account
 */
export async function authenticateClient(email: string, password: string): Promise<SessionPayload | null> {
  const account = await prisma.account.findUnique({
    where: { email },
    include: { client: true },
  });

  if (!account || account.role !== 'CLIENT') {
    return null;
  }

  if (account.status !== 'ACTIVE') {
    return null;
  }

  const isValid = await verifyPassword(password, account.password);
  if (!isValid) {
    return null;
  }

  if (!account.client) {
    return null;
  }

  // Check subscription status
  const subscription = await prisma.subscription.findUnique({
    where: { clientId: account.client.id },
  });

  if (!subscription || subscription.status !== 'ACTIVE') {
    // Still allow login but client will see subscription warning
  }

  return {
    userId: account.id,
    email: account.email,
    role: 'CLIENT',
    clientId: account.client.id,
  };
}

/**
 * Get current user from session
 */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  return getSession();
}

/**
 * Require authentication middleware
 */
export async function requireAuth(): Promise<SessionPayload> {
  const session = await getSession();
  if (!session) {
    throw new Error('Unauthorized');
  }
  return session;
}

/**
 * Require super admin role
 */
export async function requireSuperAdmin(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== 'SUPER_ADMIN') {
    throw new Error('Forbidden: Super admin access required');
  }
  return session;
}

/**
 * Require client role
 */
export async function requireClient(): Promise<SessionPayload> {
  const session = await requireAuth();
  if (session.role !== 'CLIENT') {
    throw new Error('Forbidden: Client access required');
  }
  if (!session.clientId) {
    throw new Error('Forbidden: Client ID missing');
  }
  return session;
}

