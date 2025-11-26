import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { ActivityEventType } from '@prisma/client';

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [
      totalAccounts,
      totalClients,
      totalPlans,
      activeSubscriptions,
      totalRooms,
      activeRooms,
      activeSessions,
      sessionsToday,
      totalParticipants,
      avgDuration,
      peakHours,
      sessionActivity,
      participantActivity,
    ] = await Promise.all([
      prisma.account.count(),
      prisma.client.count(),
      prisma.plan.count(),
      prisma.subscription.count({
        where: { status: 'ACTIVE' },
      }),
      prisma.room.count(),
      prisma.room.count({ where: { isActive: true } }),
      getActiveSessionsCount(),
      getSessionsTodayCount(today),
      getTotalActiveParticipants(),
      getAverageSessionDuration(),
      getPeakHours(),
      getSessionActivityData(),
      getParticipantActivityData(),
    ]);

    return NextResponse.json({
      totalAccounts,
      totalClients,
      totalPlans,
      activeSubscriptions,
      sessions: {
        active: activeSessions,
        today: sessionsToday,
        totalParticipants,
        averageDuration: avgDuration,
        peakHours,
      },
      rooms: {
        total: totalRooms,
        active: activeRooms,
        utilization: totalRooms > 0 ? (activeRooms / totalRooms) * 100 : 0,
      },
      charts: {
        sessionActivity,
        participantActivity,
      },
    });
  } catch (error) {
    console.error('Stats error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الإحصائيات' },
      { status: 500 }
    );
  }
}

async function getActiveSessionsCount(): Promise<number> {
  const allRooms = await prisma.room.findMany({ select: { id: true } });
  const roomIds = allRooms.map((r) => r.id);

  if (!roomIds.length) return 0;

  // Get latest event for each room
  const latestEvents = await Promise.all(
    roomIds.map(async (roomId) => {
      const latest = await prisma.roomActivityLog.findFirst({
        where: {
          roomId,
          event: { in: [ActivityEventType.ROOM_STARTED, ActivityEventType.ROOM_ENDED] },
        },
        orderBy: { occurredAt: 'desc' },
      });
      return { roomId, event: latest?.event };
    })
  );

  return latestEvents.filter((e) => e.event === ActivityEventType.ROOM_STARTED).length;
}

async function getSessionsTodayCount(today: Date): Promise<number> {
  return prisma.roomActivityLog.count({
    where: {
      event: ActivityEventType.ROOM_STARTED,
      occurredAt: { gte: today },
    },
  });
}

async function getTotalActiveParticipants(): Promise<number> {
  const activeRoomIds = await getActiveRoomIds();
  if (!activeRoomIds.length) return 0;

  const recentJoins = await prisma.roomActivityLog.findMany({
    where: {
      roomId: { in: activeRoomIds },
      event: ActivityEventType.PARTICIPANT_JOINED,
      occurredAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    },
    select: { metadata: true },
  });

  const uniqueParticipants = new Set(
    recentJoins
      .map((log) => {
        if (log.metadata && typeof log.metadata === 'object') {
          const meta = log.metadata as Record<string, unknown>;
          return (meta.identity as string) || (meta.participantName as string);
        }
        return null;
      })
      .filter(Boolean)
  );

  return uniqueParticipants.size;
}

async function getActiveRoomIds(): Promise<string[]> {
  const allRooms = await prisma.room.findMany({ select: { id: true } });
  const roomIds = allRooms.map((r) => r.id);

  if (!roomIds.length) return [];

  const latestEvents = await Promise.all(
    roomIds.map(async (roomId) => {
      const latest = await prisma.roomActivityLog.findFirst({
        where: {
          roomId,
          event: { in: [ActivityEventType.ROOM_STARTED, ActivityEventType.ROOM_ENDED] },
        },
        orderBy: { occurredAt: 'desc' },
      });
      return { roomId, event: latest?.event };
    })
  );

  return latestEvents
    .filter((e) => e.event === ActivityEventType.ROOM_STARTED)
    .map((e) => e.roomId);
}

async function getAverageSessionDuration(): Promise<number> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.roomActivityLog.findMany({
    where: {
      event: { in: [ActivityEventType.ROOM_STARTED, ActivityEventType.ROOM_ENDED] },
      occurredAt: { gte: sevenDaysAgo },
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

  if (durations.length === 0) return 0;
  const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
  return Math.round(avg / 60);
}

async function getPeakHours(): Promise<{ hour: number; count: number }[]> {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const sessions = await prisma.roomActivityLog.findMany({
    where: {
      event: ActivityEventType.ROOM_STARTED,
      occurredAt: { gte: sevenDaysAgo },
    },
    select: { occurredAt: true },
  });

  const hourCounts = new Map<number, number>();
  sessions.forEach((log) => {
    const hour = log.occurredAt.getHours();
    hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
  });

  return Array.from(hourCounts.entries())
    .map(([hour, count]) => ({ hour, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
}

async function getSessionActivityData() {
  const hours = Array.from({ length: 24 }, (_, i) => {
    const date = new Date();
    date.setHours(date.getHours() - (23 - i), 0, 0, 0);
    return date;
  });

  const data = await Promise.all(
    hours.map(async (hourStart) => {
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourEnd.getHours() + 1);

      const [started, ended] = await Promise.all([
        prisma.roomActivityLog.count({
          where: {
            event: ActivityEventType.ROOM_STARTED,
            occurredAt: { gte: hourStart, lt: hourEnd },
          },
        }),
        prisma.roomActivityLog.count({
          where: {
            event: ActivityEventType.ROOM_ENDED,
            occurredAt: { gte: hourStart, lt: hourEnd },
          },
        }),
      ]);

      return {
        time: hourStart.toISOString(),
        hour: hourStart.getHours(),
        started,
        ended,
        active: started - ended,
      };
    })
  );

  return data;
}

async function getParticipantActivityData() {
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  const [joined, left] = await Promise.all([
    prisma.roomActivityLog.count({
      where: {
        event: ActivityEventType.PARTICIPANT_JOINED,
        occurredAt: { gte: sevenDaysAgo },
      },
    }),
    prisma.roomActivityLog.count({
      where: {
        event: ActivityEventType.PARTICIPANT_LEFT,
        occurredAt: { gte: sevenDaysAgo },
      },
    }),
  ]);

  return { joined, left, net: joined - left };
}

