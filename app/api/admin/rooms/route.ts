import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getAuthTokenFromRequest } from '@/lib/auth';
import { prisma, generateShortLink, getNextParticipantName } from '@/lib/database';

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

    const { name, description, hostApproval, maxParticipants, isActive, canRecord } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Generate room link based on room name
    // Both host and guest will use the same room name with different types
    let roomLink: string;
    let attempts = 0;
    const maxAttempts = 10;

    do {
      // Create a URL-friendly version of the room name
      let sanitizedName = name
        .toLowerCase()
        .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
        .replace(/-+/g, '-') // Replace multiple hyphens with single
        .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
      
      // Ensure the sanitized name is not empty
      if (!sanitizedName || sanitizedName.length < 1) {
        sanitizedName = 'room';
      }
      
      // Add a random suffix to ensure uniqueness if needed
      const suffix = attempts === 0 ? '' : `-${Math.random().toString(36).substring(2, 6)}`;
      roomLink = `${sanitizedName}${suffix}`;
      
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
    const hostLink = roomLink;
    const guestLink = roomLink;

    // Create the room
    const room = await prisma.room.create({
      data: {
        name,
        description,
        hostApproval: hostApproval || false,
        maxParticipants: maxParticipants || 50,
        isActive: isActive !== undefined ? isActive : true,
        canRecord: canRecord !== undefined ? canRecord : false,
        hostLink,
        guestLink
      },
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

    const { id, name, description, hostApproval, maxParticipants, isActive, canRecord } = await request.json();

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

    // Generate new room link if name changed
    let roomLink = existingRoom.hostLink;
    if (name !== existingRoom.name) {
      let attempts = 0;
      const maxAttempts = 10;

      do {
        // Create a URL-friendly version of the room name
        let sanitizedName = name
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '-') // Replace non-alphanumeric with hyphens
          .replace(/-+/g, '-') // Replace multiple hyphens with single
          .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
        
        // Ensure the sanitized name is not empty
        if (!sanitizedName || sanitizedName.length < 1) {
          sanitizedName = 'room';
        }
        
        // Add a random suffix to ensure uniqueness if needed
        const suffix = attempts === 0 ? '' : `-${Math.random().toString(36).substring(2, 6)}`;
        roomLink = `${sanitizedName}${suffix}`;
        
        attempts++;

        // Check if link already exists (excluding current room)
        const existingRoomWithLink = await prisma.room.findFirst({
          where: {
            AND: [
              {
                OR: [
                  { hostLink: roomLink },
                  { guestLink: roomLink }
                ]
              },
              { id: { not: id } }
            ]
          }
        });

        if (!existingRoomWithLink) break;
      } while (attempts < maxAttempts);

      if (attempts >= maxAttempts) {
        return NextResponse.json(
          { error: 'Failed to generate unique room link' },
          { status: 500 }
        );
      }
    }

    // Update the room
    const updatedRoom = await prisma.room.update({
      where: { id: id },
      data: {
        name,
        description,
        hostApproval: hostApproval !== undefined ? hostApproval : existingRoom.hostApproval,
        maxParticipants: maxParticipants !== undefined ? maxParticipants : existingRoom.maxParticipants,
        isActive: isActive !== undefined ? isActive : existingRoom.isActive,
        canRecord: canRecord !== undefined ? canRecord : existingRoom.canRecord,
        hostLink: roomLink,
        guestLink: roomLink,
        updatedAt: new Date()
      },
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
