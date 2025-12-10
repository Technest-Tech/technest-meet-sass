import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { ActivityEventType } from '@prisma/client';
import { queryRoomsByLinks } from '@/lib/utils/livekit-multi-server';

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
    // Collect all room links (hostLink and guestLink) to query across all servers
    const roomLinks: string[] = [];
    account.client.rooms.forEach((room) => {
      roomLinks.push(room.hostLink);
      if (room.guestLink !== room.hostLink) {
        roomLinks.push(room.guestLink);
      }
    });

    let activeSessionsNow = 0;
    let activeParticipantsNow = 0;

    try {
      // Query all LiveKit servers for rooms matching this account's room links
      const matchedRooms = await queryRoomsByLinks(roomLinks);
      activeSessionsNow = matchedRooms.activeSessions;
      activeParticipantsNow = matchedRooms.totalParticipants;
    } catch (error) {
      console.error('Error fetching LiveKit rooms from all servers:', error);
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

