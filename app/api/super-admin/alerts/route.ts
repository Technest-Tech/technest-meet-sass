import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { ActivityEventType } from '@prisma/client';
import { RoomServiceClient } from 'livekit-server-sdk';

type AlertSeverity = 'info' | 'warning' | 'error' | 'critical';

interface Alert {
  type: string;
  severity: AlertSeverity;
  title: string;
  description: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    console.error('Alerts auth error:', error);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const alerts: Alert[] = [];

    // Get system status for system alerts
    const [dbStatus, livekitStatus, apiStatus, storageStatus] = await Promise.all([
      checkDatabaseHealth(),
      checkLiveKitStatus(),
      getAPIStats(),
      getStorageStats(),
    ]);

    // System Alerts
    if (apiStatus.errorRate > 5) {
      alerts.push({
        type: 'high_error_rate',
        severity: apiStatus.errorRate > 10 ? 'critical' : 'error',
        title: 'High API Error Rate',
        description: `API error rate is ${apiStatus.errorRate.toFixed(2)}%, exceeding threshold of 5%`,
        timestamp: new Date().toISOString(),
        metadata: { errorRate: apiStatus.errorRate },
      });
    }

    if (storageStatus.percentage > 90) {
      alerts.push({
        type: 'storage_critical',
        severity: 'critical',
        title: 'Storage Critical',
        description: `Storage usage is at ${storageStatus.percentage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        metadata: { percentage: storageStatus.percentage },
      });
    } else if (storageStatus.percentage > 80) {
      alerts.push({
        type: 'storage_warning',
        severity: 'warning',
        title: 'Storage Warning',
        description: `Storage usage is at ${storageStatus.percentage.toFixed(1)}%`,
        timestamp: new Date().toISOString(),
        metadata: { percentage: storageStatus.percentage },
      });
    }

    if (dbStatus.responseTime > 1000) {
      alerts.push({
        type: 'database_critical',
        severity: 'critical',
        title: 'Database Performance Critical',
        description: `Database response time is ${dbStatus.responseTime}ms`,
        timestamp: new Date().toISOString(),
        metadata: { responseTime: dbStatus.responseTime },
      });
    } else if (dbStatus.responseTime > 500) {
      alerts.push({
        type: 'database_warning',
        severity: 'warning',
        title: 'Database Performance Warning',
        description: `Database response time is ${dbStatus.responseTime}ms`,
        timestamp: new Date().toISOString(),
        metadata: { responseTime: dbStatus.responseTime },
      });
    }

    if (livekitStatus.status === 'disconnected') {
      alerts.push({
        type: 'livekit_disconnected',
        severity: 'critical',
        title: 'LiveKit Server Disconnected',
        description: 'LiveKit server is not responding',
        timestamp: new Date().toISOString(),
        metadata: { lastCheck: livekitStatus.lastCheck },
      });
    }

    // Room Issues
    const roomAlerts = await checkRoomIssues();
    alerts.push(...roomAlerts);

    // Sort by severity (critical first)
    const severityOrder: Record<AlertSeverity, number> = {
      critical: 0,
      error: 1,
      warning: 2,
      info: 3,
    };

    alerts.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Alerts error:', error);
    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

async function checkDatabaseHealth() {
  const start = Date.now();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const responseTime = Date.now() - start;
    return {
      status: responseTime < 100 ? 'healthy' : responseTime < 500 ? 'warning' : 'error',
      responseTime,
    };
  } catch {
    return { status: 'error' as const, responseTime: Date.now() - start };
  }
}

async function checkLiveKitStatus() {
  try {
    const apiKey = process.env.LIVEKIT_API_KEY || 'devkey';
    const apiSecret = process.env.LIVEKIT_API_SECRET || 'secret';
    const url = process.env.LIVEKIT_URL || 'ws://localhost:7880';

    const client = new RoomServiceClient(url, apiKey, apiSecret);
    await client.listRooms();

    return {
      status: 'connected' as const,
      lastCheck: new Date(),
    };
  } catch {
    return {
      status: 'disconnected' as const,
      lastCheck: new Date(),
    };
  }
}

async function getAPIStats() {
  // Mock for now - can be enhanced with actual API error tracking
  return {
    avgResponseTime: 45,
    errorRate: 0.1,
  };
}

async function getStorageStats() {
  const files = await prisma.roomFile.aggregate({
    _sum: { size: true },
    _count: { _all: true },
  });

  const totalBytes = files._sum.size || 0;
  const maxStorage = 100 * 1024 * 1024 * 1024; // 100GB

  return {
    used: totalBytes,
    total: maxStorage,
    percentage: (totalBytes / maxStorage) * 100,
  };
}

async function checkRoomIssues(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const fiveMinutesAgo = new Date(now.getTime() - 5 * 60 * 1000);
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Failed room starts: ROOM_STARTED but no PARTICIPANT_JOINED within 5 minutes
  const recentRoomStarts = await prisma.roomActivityLog.findMany({
    where: {
      event: ActivityEventType.ROOM_STARTED,
      occurredAt: { gte: fiveMinutesAgo },
    },
    include: { room: { select: { id: true, name: true } } },
  });

  for (const startLog of recentRoomStarts) {
    const participantJoined = await prisma.roomActivityLog.findFirst({
      where: {
        roomId: startLog.roomId,
        event: ActivityEventType.PARTICIPANT_JOINED,
        occurredAt: {
          gte: startLog.occurredAt,
          lte: new Date(startLog.occurredAt.getTime() + 5 * 60 * 1000),
        },
      },
    });

    if (!participantJoined) {
      alerts.push({
        type: 'failed_room_start',
        severity: 'warning',
        title: 'Failed Room Start',
        description: `Room "${startLog.room.name}" started but no participants joined within 5 minutes`,
        timestamp: startLog.occurredAt.toISOString(),
        metadata: { roomId: startLog.roomId, roomName: startLog.room.name },
      });
    }
  }

  // Connection problems: multiple PARTICIPANT_LEFT events within 1 minute
  const recentParticipantLeaves = await prisma.roomActivityLog.findMany({
    where: {
      event: ActivityEventType.PARTICIPANT_LEFT,
      occurredAt: { gte: oneMinuteAgo },
    },
    include: { room: { select: { id: true, name: true } } },
  });

  const leavesByRoom = new Map<string, number>();
  recentParticipantLeaves.forEach((log) => {
    const count = leavesByRoom.get(log.roomId) || 0;
    leavesByRoom.set(log.roomId, count + 1);
  });

  leavesByRoom.forEach((count, roomId) => {
    if (count >= 3) {
      const room = recentParticipantLeaves.find((l) => l.roomId === roomId)?.room;
      alerts.push({
        type: 'connection_problems',
        severity: 'error',
        title: 'Connection Problems',
        description: `Room "${room?.name || roomId}" has ${count} participants leaving within 1 minute`,
        timestamp: new Date().toISOString(),
        metadata: { roomId, leaveCount: count },
      });
    }
  });

  // Stale sessions: ROOM_STARTED but no ROOM_ENDED and last activity >24 hours ago
  const staleSessions = await prisma.roomActivityLog.findMany({
    where: {
      event: ActivityEventType.ROOM_STARTED,
      occurredAt: { lte: twentyFourHoursAgo },
    },
    include: { room: { select: { id: true, name: true } } },
  });

  for (const startLog of staleSessions) {
    const roomEnded = await prisma.roomActivityLog.findFirst({
      where: {
        roomId: startLog.roomId,
        event: ActivityEventType.ROOM_ENDED,
        occurredAt: { gte: startLog.occurredAt },
      },
    });

    if (!roomEnded) {
      const lastActivity = await prisma.roomActivityLog.findFirst({
        where: { roomId: startLog.roomId },
        orderBy: { occurredAt: 'desc' },
        select: { occurredAt: true },
      });

      const hoursSinceActivity = lastActivity
        ? (now.getTime() - lastActivity.occurredAt.getTime()) / (1000 * 60 * 60)
        : (now.getTime() - startLog.occurredAt.getTime()) / (1000 * 60 * 60);

      if (hoursSinceActivity > 24) {
        alerts.push({
          type: 'stale_session',
          severity: 'warning',
          title: 'Stale Session',
          description: `Room "${startLog.room.name}" has been running for over 24 hours without ending`,
          timestamp: startLog.occurredAt.toISOString(),
          metadata: {
            roomId: startLog.roomId,
            roomName: startLog.room.name,
            hoursSinceActivity: Math.round(hoursSinceActivity),
          },
        });
      }
    }
  }

  return alerts;
}

