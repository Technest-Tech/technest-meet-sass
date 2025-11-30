import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { ActivityEventType } from '@prisma/client';
import { RoomServiceClient } from 'livekit-server-sdk';

const API_KEY = process.env.LIVEKIT_API_KEY || 'devkey';
const API_SECRET = process.env.LIVEKIT_API_SECRET || 'secret';
const LIVEKIT_URL = process.env.LIVEKIT_URL || 'ws://localhost:7880';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireSuperAdmin();

    const { id } = await params;

    const account = await prisma.account.findUnique({
      where: { id },
      include: {
        client: {
          include: {
            rooms: {
              select: {
                id: true,
                hostLink: true,
                guestLink: true,
              },
            },
          },
        },
      },
    });

    if (!account?.clientId || !account.client) {
      return NextResponse.json({ error: 'الحساب غير مرتبط بعميل' }, { status: 404 });
    }

    const clientId = account.clientId;
    const roomIds = account.client.rooms.map((r) => r.id);

    // Get real-time active sessions and participants from LiveKit
    let activeSessionsNow = 0;
    let activeParticipantsNow = 0;

    try {
      const roomService = new RoomServiceClient(LIVEKIT_URL, API_KEY, API_SECRET);
      const livekitRooms = await roomService.listRooms();

      // Create a map of room links to room IDs for quick lookup
      const roomLinksMap = new Map<string, string>();
      account.client.rooms.forEach((room) => {
        // Both hostLink and guestLink might be the same or different
        // LiveKit room name is the actual room link (hostLink or guestLink)
        roomLinksMap.set(room.hostLink, room.id);
        if (room.guestLink !== room.hostLink) {
          roomLinksMap.set(room.guestLink, room.id);
        }
      });

      // Track which rooms we've already counted (to avoid double counting)
      const countedRooms = new Set<string>();

      // Check which LiveKit rooms match our client's rooms
      for (const livekitRoom of livekitRooms) {
        const roomId = roomLinksMap.get(livekitRoom.name);
        if (roomId && !countedRooms.has(roomId)) {
          try {
            const participants = await roomService.listParticipants(livekitRoom.name);
            
            // Filter out observers
            const nonObserverParticipants = participants.filter((p: any) => {
              try {
                const metadata = p.metadata ? JSON.parse(p.metadata) : {};
                return metadata.type !== 'observer';
              } catch {
                return !p.identity?.toLowerCase().includes('observer');
              }
            });

            if (nonObserverParticipants.length > 0) {
              activeSessionsNow++;
              activeParticipantsNow += nonObserverParticipants.length;
              countedRooms.add(roomId);
            }
          } catch (error) {
            console.error(`Error fetching participants for room ${livekitRoom.name}:`, error);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching LiveKit rooms:', error);
      // Continue with database stats even if LiveKit fails
    }

    // Get total sessions conducted (ROOM_STARTED events)
    const totalSessions = await prisma.roomActivityLog.count({
      where: {
        roomId: { in: roomIds },
        event: ActivityEventType.ROOM_STARTED,
      },
    });

    // Get total participants (unique participants who joined)
    const participantJoins = await prisma.roomActivityLog.findMany({
      where: {
        roomId: { in: roomIds },
        event: ActivityEventType.PARTICIPANT_JOINED,
      },
      select: { metadata: true },
    });

    const uniqueParticipants = new Set(
      participantJoins
        .map((log) => {
          if (log.metadata && typeof log.metadata === 'object') {
            const meta = log.metadata as Record<string, unknown>;
            return (meta.identity as string) || (meta.participantName as string);
          }
          return null;
        })
        .filter(Boolean)
    );

    const totalParticipants = uniqueParticipants.size;

    // Calculate average session duration
    const sessions = await prisma.roomActivityLog.findMany({
      where: {
        roomId: { in: roomIds },
        event: { in: [ActivityEventType.ROOM_STARTED, ActivityEventType.ROOM_ENDED] },
      },
      orderBy: { occurredAt: 'asc' },
    });

    const durations: number[] = [];
    const sessionMap = new Map<string, Date>();

    for (const log of sessions) {
      if (log.event === ActivityEventType.ROOM_STARTED) {
        sessionMap.set(log.roomId, log.occurredAt);
      } else if (log.event === ActivityEventType.ROOM_ENDED) {
        const startTime = sessionMap.get(log.roomId);
        if (startTime) {
          const duration = (log.occurredAt.getTime() - startTime.getTime()) / 1000;
          durations.push(duration);
          sessionMap.delete(log.roomId);
        }
      }
    }

    const averageSessionDuration =
      durations.length > 0
        ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length / 60)
        : 0;

    return NextResponse.json({
      accountId: id,
      accountEmail: account.email,
      clientName: account.client.name,
      stats: {
        activeSessionsNow,
        activeParticipantsNow,
        totalSessions,
        totalParticipants,
        averageSessionDuration,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Account stats error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب إحصائيات الحساب' },
      { status: 500 }
    );
  }
}

