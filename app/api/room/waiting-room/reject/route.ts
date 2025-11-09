import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST - Reject participant from waiting room
export async function POST(request: NextRequest) {
  try {
    const { roomName, participantId } = await request.json();

    if (!roomName || !participantId) {
      return NextResponse.json(
        { error: 'Room name and participant ID are required' },
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

    // Reject the participant
    const participant = await prisma.waitingParticipant.update({
      where: {
        id: participantId
      },
      data: {
        status: 'rejected'
      }
    });

    return NextResponse.json({
      success: true,
      message: `Rejected ${participant.participantName}`,
      participant
    });

  } catch (error) {
    console.error('Failed to reject participant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

