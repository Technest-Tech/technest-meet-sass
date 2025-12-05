import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';
import { sanitizeRoomIdentifier, sanitizeString, validateLength } from '@/lib/utils/sanitize';
import { rateLimit } from '@/lib/middleware/rateLimit';

export async function POST(request: NextRequest) {
  try {
    // Rate limiting to prevent brute force attacks
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
    let { roomLink: roomLinkParam, accessType, password: passwordParam } = body;

    if (!roomLinkParam || !accessType || !passwordParam) {
      return NextResponse.json(
        { error: 'Room link, access type, and password are required' },
        { status: 400 }
      );
    }

    // Sanitize inputs
    const roomLink = sanitizeRoomIdentifier(roomLinkParam);
    if (!roomLink || roomLink !== roomLinkParam) {
      return NextResponse.json(
        { error: 'Invalid room link format' },
        { status: 400 }
      );
    }

    // Validate password length (prevent extremely long passwords)
    if (!validateLength(passwordParam, 200, 1)) {
      return NextResponse.json(
        { error: 'Invalid password format' },
        { status: 400 }
      );
    }

    const password = sanitizeString(passwordParam);

    if (accessType !== 'host' && accessType !== 'guest') {
      return NextResponse.json(
        { error: 'Invalid access type' },
        { status: 400 }
      );
    }

    // Find room by host or guest link
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomLink },
          { guestLink: roomLink }
        ]
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Check if password is required for this access type
    const requiresPassword = room.passwordRequired && (
      room.passwordFor === 'HOST_AND_GUEST' ||
      (room.passwordFor === 'HOST_ONLY' && accessType === 'host')
    );

    if (!requiresPassword) {
      return NextResponse.json(
        { error: 'Password is not required for this room' },
        { status: 400 }
      );
    }

    if (!room.password) {
      return NextResponse.json(
        { error: 'Room password is not set' },
        { status: 500 }
      );
    }

    // Verify password
    const isValid = await bcrypt.compare(password, room.password);

    if (!isValid) {
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 401 }
      );
    }

    return NextResponse.json({ valid: true });
  } catch (error) {
    console.error('Error verifying password:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

