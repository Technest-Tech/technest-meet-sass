import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';

// POST - Admit participant(s) from waiting room
export async function POST(request: NextRequest) {
  try {
    const { roomName, participantId, admitAll } = await request.json();

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

    if (admitAll) {
      // Admit all waiting participants
      const result = await prisma.waitingParticipant.updateMany({
        where: {
          roomId: room.id,
          status: 'waiting'
        },
        data: {
          status: 'admitted'
        }
      });

      return NextResponse.json({
        success: true,
        message: `Admitted ${result.count} participant(s)`,
        count: result.count
      });
    } else {
      // Admit specific participant
      if (!participantId) {
        return NextResponse.json(
          { error: 'Participant ID is required when not admitting all' },
          { status: 400 }
        );
      }

      const participant = await prisma.waitingParticipant.update({
        where: {
          id: participantId
        },
        data: {
          status: 'admitted'
        }
      });

      return NextResponse.json({
        success: true,
        message: `Admitted ${participant.participantName}`,
        participant
      });
    }

  } catch (error) {
    console.error('Failed to admit participant:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

