import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { registerReferralSignup } from '@/lib/services/referrals';
import { rateLimit } from '@/lib/middleware/rateLimit';
import { sanitizeStringLenient, sanitizeEmail, validateLength } from '@/lib/utils/sanitize';

const referralRegisterSchema = z.object({
  referralCode: z.string().min(4).max(50),
  email: z.string().email().max(255).optional(),
  metadata: z.record(z.any()).optional(),
  prospect: z
    .object({
      name: z.string().max(200).optional(),
      email: z.string().email().max(255).optional(),
      phone: z.string().max(50).optional(),
      companyName: z.string().max(200).optional(),
      desiredPlanId: z.string().max(100).optional(),
      notes: z.string().max(1000).optional(),
    })
    .optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent abuse
    const rateLimitResult = await rateLimit(request, {
      maxRequests: 10,
      windowMs: 15 * 60 * 1000, // 15 minutes
    });

    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { 
          status: 429,
          headers: {
            'Retry-After': rateLimitResult.retryAfter?.toString() || '900',
          },
        }
      );
    }

    const body = await request.json();
    const parsed = referralRegisterSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 },
      );
    }

    let { referralCode, email, metadata, prospect } = parsed.data;
    
    // Sanitize inputs
    referralCode = sanitizeStringLenient(referralCode);
    if (email) {
      email = sanitizeEmail(email);
    }
    
    // Sanitize prospect data if provided
    if (prospect) {
      prospect = {
        ...prospect,
        name: prospect.name ? sanitizeStringLenient(prospect.name) : undefined,
        email: prospect.email ? sanitizeEmail(prospect.email) : undefined,
        phone: prospect.phone ? sanitizeStringLenient(prospect.phone) : undefined,
        companyName: prospect.companyName ? sanitizeStringLenient(prospect.companyName) : undefined,
        desiredPlanId: prospect.desiredPlanId ? sanitizeStringLenient(prospect.desiredPlanId) : undefined,
        notes: prospect.notes ? sanitizeStringLenient(prospect.notes) : undefined,
      };
    }
    
    // Validate lengths after sanitization
    if (!validateLength(referralCode, 50, 4)) {
      return NextResponse.json(
        { error: 'Invalid referral code format' },
        { status: 400 }
      );
    }
    
    const event = await registerReferralSignup({
      referralCode,
      referredEmail: email,
      metadata,
      prospect,
    });

    return NextResponse.json({ event });
  } catch (error) {
    console.error('Referral register error', error);
    return NextResponse.json(
      { error: 'Unable to record referral' },
      { status: 500 },
    );
  }
}

