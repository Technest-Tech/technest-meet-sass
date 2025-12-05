import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getAuthTokenFromRequest } from '@/lib/auth';
import { prisma, generateShortLink, getNextParticipantName, generateRoomLink } from '@/lib/database';
import bcrypt from 'bcryptjs';

// GET - Fetch all rooms
export async function GET(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const rooms = await prisma.room.findMany({
      include: {
        participants: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({ rooms });

  } catch (error) {
    console.error('Failed to fetch rooms:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// POST - Create a new room
export async function POST(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { name, description, hostApproval, maxParticipants, isActive, canRecord, requireWaitingRoom, allowGuestUnmute, enablePrivateChat, password, passwordRequired, passwordFor, clientId, customRoomLink } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Check if customRoomLink is provided and client is almajd
    let hostLink: string;
    let guestLink: string;

    if (customRoomLink && clientId) {
      // Check if client is almajd
      const client = await prisma.client.findUnique({
        where: { id: clientId },
        include: { account: true },
      });

      if (client && client.account?.email === 'almajd@admin.com') {
        // Validate custom link format
        const linkRegex = /^[a-zA-Z0-9]{1,50}$/;
        if (!linkRegex.test(customRoomLink.trim())) {
          return NextResponse.json(
            { error: 'Custom room link must contain only alphanumeric characters (1-50 characters)' },
            { status: 400 }
          );
        }

        // Check uniqueness within the same client
        const existingRoom = await prisma.room.findFirst({
          where: {
            clientId: clientId,
            OR: [
              { hostLink: customRoomLink.trim() },
              { guestLink: customRoomLink.trim() }
            ],
          },
        });

        if (existingRoom) {
          return NextResponse.json(
            { error: 'Custom room link is already in use' },
            { status: 400 }
          );
        }

        hostLink = customRoomLink.trim();
        guestLink = customRoomLink.trim();
      } else {
        return NextResponse.json(
          { error: 'Custom room links are only available for almajd@admin.com account' },
          { status: 403 }
        );
      }
    } else {
      // Generate room link using 7 random characters
    // Both host and guest will use the same room link
    let roomLink: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
        // Generate link with 7 random characters
      roomLink = generateRoomLink();
      
      attempts++;

      // Check if link already exists
      const existingRoom = await prisma.room.findFirst({
        where: {
          OR: [
            { hostLink: roomLink },
            { guestLink: roomLink }
          ]
        }
      });

      if (!existingRoom) break;
    } while (attempts < maxAttempts);

    if (attempts >= maxAttempts) {
      return NextResponse.json(
        { error: 'Failed to generate unique room link' },
        { status: 500 }
      );
    }

    // Both host and guest use the same room link
      hostLink = roomLink;
      guestLink = roomLink;
    }

    // Hash password if provided
    let hashedPassword: string | null = null;
    if (passwordRequired && password) {
      hashedPassword = await bcrypt.hash(password, 10);
    }

    // Create the room
    const roomData: any = {
        name,
        description,
        hostApproval: hostApproval || false,
        maxParticipants: maxParticipants || 50,
        isActive: isActive !== undefined ? isActive : true,
        canRecord: canRecord !== undefined ? canRecord : false,
        requireWaitingRoom: requireWaitingRoom !== undefined ? requireWaitingRoom : false,
        allowGuestUnmute: allowGuestUnmute !== undefined ? allowGuestUnmute : true,
        enablePrivateChat: enablePrivateChat !== undefined ? enablePrivateChat : true,
        hostLink,
        guestLink,
        password: hashedPassword,
        passwordRequired: passwordRequired || false,
        passwordFor: passwordFor || null,
    };

    // Add clientId if provided
    if (clientId) {
      roomData.clientId = clientId;
    }

    const room = await prisma.room.create({
      data: roomData,
      include: {
        participants: true
      }
    });

    // Create initial host participant
    const hostName = await getNextParticipantName(room.id, 'HOST');
    await prisma.participant.create({
      data: {
        name: hostName,
        type: 'HOST',
        roomId: room.id
      }
    });

    // Create initial guest participant
    const guestName = await getNextParticipantName(room.id, 'GUEST');
    await prisma.participant.create({
      data: {
        name: guestName,
        type: 'GUEST',
        roomId: room.id
      }
    });

    // Fetch the room with participants
    const roomWithParticipants = await prisma.room.findUnique({
      where: { id: room.id },
      include: { participants: true }
    });

    return NextResponse.json(roomWithParticipants, { status: 201 });

  } catch (error) {
    console.error('Failed to create room:', error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Prisma error code:', (error as any).code);
      console.error('Prisma error meta:', (error as any).meta);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// PUT - Update an existing room
export async function PUT(request: NextRequest) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { id, name, description, hostApproval, maxParticipants, isActive, canRecord, requireWaitingRoom, allowGuestUnmute, enablePrivateChat, password, passwordRequired, passwordFor } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'Room ID is required' },
        { status: 400 }
      );
    }

    if (!name) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: id }
    });

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Handle password update
    let hashedPassword: string | null | undefined = undefined;
    if (passwordRequired !== undefined) {
      if (passwordRequired && password) {
        // Hash new password
        hashedPassword = await bcrypt.hash(password, 10);
      } else if (!passwordRequired) {
        // Remove password if password is disabled
        hashedPassword = null;
      } else if (passwordRequired && !password) {
        // Keep existing password if passwordRequired is true but no new password provided
        hashedPassword = existingRoom.password;
      }
    }

    // Update the room
    const updateData: any = {
      name,
      description,
      hostApproval: hostApproval !== undefined ? hostApproval : existingRoom.hostApproval,
      maxParticipants: maxParticipants !== undefined ? maxParticipants : existingRoom.maxParticipants,
      isActive: isActive !== undefined ? isActive : existingRoom.isActive,
      canRecord: canRecord !== undefined ? canRecord : existingRoom.canRecord,
      requireWaitingRoom: requireWaitingRoom !== undefined ? requireWaitingRoom : existingRoom.requireWaitingRoom,
      allowGuestUnmute: allowGuestUnmute !== undefined ? allowGuestUnmute : existingRoom.allowGuestUnmute,
      enablePrivateChat: enablePrivateChat !== undefined ? enablePrivateChat : existingRoom.enablePrivateChat,
      updatedAt: new Date()
    };

    // Add password fields if provided
    if (passwordRequired !== undefined) {
      updateData.passwordRequired = passwordRequired;
      if (hashedPassword !== undefined) {
        updateData.password = hashedPassword;
      }
    }
    if (passwordFor !== undefined) {
      updateData.passwordFor = passwordFor;
    }

    const updatedRoom = await prisma.room.update({
      where: { id: id },
      data: updateData,
      include: {
        participants: true
      }
    });

    return NextResponse.json(updatedRoom);

  } catch (error) {
    console.error('Failed to update room:', error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Prisma error code:', (error as any).code);
      console.error('Prisma error meta:', (error as any).meta);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
