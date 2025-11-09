import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// GET - Check waiting room status for a participant
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const roomName = searchParams.get('roomName');
    const participantName = searchParams.get('participantName');

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

    // Check if participant is in waiting room
    const waitingParticipant = await prisma.waitingParticipant.findFirst({
      where: {
        roomId: room.id,
        participantName
      },
      orderBy: {
        joinedAt: 'desc'
      }
    });

    if (!waitingParticipant) {
      return NextResponse.json({
        inWaitingRoom: false,
        status: null
      });
    }

    return NextResponse.json({
      inWaitingRoom: true,
      status: waitingParticipant.status,
      waitingParticipant
    });

  } catch (error) {
    console.error('Failed to check waiting room status:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

