import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import bcrypt from 'bcryptjs';

export async function POST(request: NextRequest) {
  try {
    const { roomLink, accessType, password } = await request.json();

    if (!roomLink || !accessType || !password) {
      return NextResponse.json(
        { error: 'Room link, access type, and password are required' },
        { status: 400 }
      );
    }

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

