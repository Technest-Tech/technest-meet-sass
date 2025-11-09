import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// GET - List waiting participants for a room (host only)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get('roomName');

    if (!roomName) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Find the room
    const room = await prisma.room.findFirst({
      where: {
        OR: [
          { hostLink: roomName },
          { guestLink: roomName },
          { name: roomName }
        ]
      }
    });

    if (!room) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Get waiting participants
    const waitingParticipants = await prisma.waitingParticipant.findMany({
      where: {
        roomId: room.id,
        status: 'waiting'
      },
      orderBy: {
        joinedAt: 'asc'
      }
    });

    return NextResponse.json({ 
      waitingParticipants,
      count: waitingParticipants.length 
    });

  } catch (error) {
    console.error('Failed to list waiting participants:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

