import { NextRequest, NextResponse } from 'next/server';
import { authenticateSuperAdmin, authenticateClient, createSession } from '@/lib/auth/server-auth';
import { rateLimit } from '@/lib/middleware/rateLimit';
import { z } from 'zod';
import { sanitizeEmail, sanitizeString, detectCommandInjection } from '@/lib/utils/sanitize';
import { logCommandInjectionAttempt } from '@/lib/utils/securityLogger';

const loginSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(1, 'كلمة المرور مطلوبة'),
  role: z.enum(['SUPER_ADMIN', 'CLIENT'], {
    errorMap: () => ({ message: 'نوع الحساب غير صحيح' }),
  }),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResult = await rateLimit(request, {
      maxRequests: 5,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'تم تجاوز عدد محاولات الدخول. يرجى المحاولة لاحقاً.' },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '900',
          },
        }
      );
    }

    const body = await request.json();
    const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown';
    const userAgent = request.headers.get('user-agent') || 'unknown';

    // Check for command injection attempts before validation
    if (typeof body.email === 'string' && detectCommandInjection(body.email)) {
      logCommandInjectionAttempt(ip, userAgent, `email: ${body.email.substring(0, 50)}`);
      return NextResponse.json(
        { error: 'Invalid input detected' },
        { status: 400 }
      );
    }
    if (typeof body.password === 'string' && detectCommandInjection(body.password)) {
      logCommandInjectionAttempt(ip, userAgent, 'password field');
      return NextResponse.json(
        { error: 'Invalid input detected' },
        { status: 400 }
      );
    }

    const validated = loginSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, role } = validated.data;
    
    // Sanitize inputs
    const sanitizedEmail = sanitizeEmail(email);

    let session;

    if (role === 'SUPER_ADMIN') {
      session = await authenticateSuperAdmin(sanitizedEmail, sanitizeString(password));
    } else {
      session = await authenticateClient(sanitizedEmail, sanitizeString(password));
    }

    if (!session) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
        { status: 401 }
      );
    }

    // Create session token
    const sessionToken = await createSession(session);

    // Create response with cookie
    const response = NextResponse.json(
      {
        success: true,
        user: {
          email: session.email,
          role: session.role,
          clientId: session.clientId,
        },
      }
    );

    // Set cookie using NextResponse.cookies
    response.cookies.set('session', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('Login error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Error details:', {
      message: errorMessage,
      stack: error instanceof Error ? error.stack : undefined,
    });
    return NextResponse.json(
      { 
        error: 'حدث خطأ أثناء تسجيل الدخول',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined
      },
      { status: 500 }
    );
  }
}

