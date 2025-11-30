import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { RoomServiceClient } from 'livekit-server-sdk';
import { prisma } from '@/lib/database';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);

    // Get all rooms from LiveKit (these are the actual active rooms)
    let livekitRooms: any[] = [];
    try {
      livekitRooms = await roomService.listRooms();
    } catch (error) {
      console.error('Error fetching LiveKit rooms:', error);
      // Return zeros if LiveKit is unavailable
      return NextResponse.json({
        activeSessions: 0,
        totalParticipants: 0,
        rooms: [],
      });
    }

    // Get all participants from all active rooms
    let totalParticipants = 0;
    const roomDetails: Array<{
      roomName: string;
      participantCount: number;
      participants: string[];
    }> = [];

    for (const room of livekitRooms) {
      try {
        const participants = await roomService.listParticipants(room.name);
        
        // Filter out observers from count
        const nonObserverParticipants = participants.filter((p: any) => {
          try {
            const metadata = p.metadata ? JSON.parse(p.metadata) : {};
            return metadata.type !== 'observer';
          } catch {
            // If metadata parsing fails, check identity
            return !p.identity?.toLowerCase().includes('observer');
          }
        });

        const participantCount = nonObserverParticipants.length;
        totalParticipants += participantCount;

        roomDetails.push({
          roomName: room.name,
          participantCount,
          participants: nonObserverParticipants.map((p: any) => p.identity || 'Unknown'),
        });
      } catch (error) {
        console.error(`Error fetching participants for room ${room.name}:`, error);
      }
    }

    // Active sessions = number of rooms with at least one non-observer participant
    const activeSessions = roomDetails.filter((r) => r.participantCount > 0).length;

    return NextResponse.json({
      activeSessions,
      totalParticipants,
      rooms: roomDetails,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Real-time stats error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإحصائيات المباشرة' },
      { status: 500 }
    );
  }
}

