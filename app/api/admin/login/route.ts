import { NextRequest, NextResponse } from 'next/server';
import { authenticateUser, generateToken } from '@/lib/auth';
import { sanitizeEmail, sanitizeString, detectCommandInjection } from '@/lib/utils/sanitize';
import { logCommandInjectionAttempt } from '@/lib/utils/securityLogger';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Check for command injection attempts
    if (detectCommandInjection(email) || detectCommandInjection(password)) {
      logCommandInjectionAttempt(ip, userAgent, `email: ${email.substring(0, 50)}`);
      return NextResponse.json(
        { error: 'Invalid input detected' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);
    const sanitizedPassword = sanitizeString(password);

    const user = await authenticateUser(sanitizedEmail, sanitizedPassword);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid email or password' },
        { status: 401 }
      );
    }

    const token = generateToken({
      userId: user.id,
      email: user.email,
      role: user.role
    });

    return NextResponse.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
