import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST - Join waiting room (for guests)
export async function POST(request: NextRequest) {
  try {
    const { roomName, participantName, participantType } = await request.json();

    if (!roomName || !participantName) {
      return NextResponse.json(
        { error: 'Room name and participant name are required' },
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

    // Check if waiting room is required
    if (!room.requireWaitingRoom) {
      return NextResponse.json({
        requiresWaiting: false,
        message: 'Waiting room not required for this room'
      });
    }

    // Check if participant is already in waiting list
    const existing = await prisma.waitingParticipant.findFirst({
      where: {
        roomId: room.id,
        participantName,
        status: 'waiting'
      }
    });

    if (existing) {
      return NextResponse.json({
        requiresWaiting: true,
        waitingParticipant: existing,
        message: 'Already in waiting room'
      });
    }

    // Add to waiting room
    const waitingParticipant = await prisma.waitingParticipant.create({
      data: {
        roomId: room.id,
        participantName,
        participantType: participantType || 'GUEST',
        status: 'waiting'
      }
    });

    return NextResponse.json({
      requiresWaiting: true,
      waitingParticipant,
      message: 'Added to waiting room'
    });

  } catch (error) {
    console.error('Failed to join waiting room:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

