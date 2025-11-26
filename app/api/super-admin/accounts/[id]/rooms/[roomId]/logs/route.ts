import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { ActivityEventType } from '@prisma/client';

type SessionInfo = {
  id: string;
  startTime: string;
  endTime: string | null;
  durationSeconds: number | null;
  isActive: boolean;
  startedBy?: string;
};

export async function GET(request: NextRequest, { params }: { params: { id: string; roomId: string } }) {
  try {
    await requireSuperAdmin();

    const account = await prisma.account.findUnique({
      where: { id: params.id },
      select: { clientId: true },
    });

    if (!account?.clientId) {
      return NextResponse.json({ error: 'الحساب غير مرتبط بعميل' }, { status: 404 });
    }

    const room = await prisma.room.findFirst({
      where: { id: params.roomId, clientId: account.clientId },
      select: { id: true, name: true, description: true, isActive: true, updatedAt: true },
    });

    if (!room) {
      return NextResponse.json({ error: 'الغرفة غير موجودة لهذا الحساب' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const limit = Math.min(500, Math.max(50, Number(searchParams.get('limit') || 200)));

    const logs = await prisma.roomActivityLog.findMany({
      where: { roomId: room.id },
      orderBy: { occurredAt: 'desc' },
      take: limit,
    });

    const sessions = buildSessions(logs);
    const participants = extractParticipants(logs);

    return NextResponse.json({
      room,
      totalLogs: logs.length,
      logs,
      sessions,
      participants,
    });
  } catch (error) {
    console.error('Failed to fetch room logs', error);
    return NextResponse.json({ error: 'تعذر تحميل سجل الغرفة' }, { status: 500 });
  }
}

function buildSessions(logs: Awaited<ReturnType<typeof prisma.roomActivityLog.findMany>>): SessionInfo[] {
  const sessions: SessionInfo[] = [];
  const ascLogs = [...logs].sort(
    (a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime(),
  );

  for (const log of ascLogs) {
    if (log.event === ActivityEventType.ROOM_STARTED) {
      sessions.push({
        id: log.id,
        startTime: log.occurredAt.toISOString(),
        endTime: null,
        durationSeconds: null,
        isActive: true,
        startedBy: typeof log.metadata === 'object' && log.metadata !== null
          ? (log.metadata as Record<string, unknown>).triggeredBy as string | undefined
          : undefined,
      });
    }

    if (log.event === ActivityEventType.ROOM_ENDED) {
      const activeSession = findLastActiveSession(sessions);
      if (activeSession) {
        activeSession.endTime = log.occurredAt.toISOString();
        activeSession.isActive = false;
        activeSession.durationSeconds = calculateDurationSeconds(
          activeSession.startTime,
          activeSession.endTime,
        );
      }
    }
  }

  return sessions.sort(
    (a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime(),
  );
}

function findLastActiveSession(sessions: SessionInfo[]): SessionInfo | null {
  for (let i = sessions.length - 1; i >= 0; i--) {
    if (!sessions[i].endTime) {
      return sessions[i];
    }
  }
  return null;
}

function calculateDurationSeconds(start: string, end: string | null): number | null {
  if (!end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  return diff > 0 ? Math.round(diff / 1000) : 0;
}

function extractParticipants(logs: Awaited<ReturnType<typeof prisma.roomActivityLog.findMany>>) {
  const participantMap = new Map<string, { name: string; type: string; lastSeen: Date }>();
  
  for (const log of logs) {
    if (log.event === ActivityEventType.PARTICIPANT_JOINED || log.event === ActivityEventType.PARTICIPANT_LEFT) {
      if (log.metadata && typeof log.metadata === 'object') {
        const metadata = log.metadata as Record<string, unknown>;
        const participantName = metadata.participantName as string | undefined;
        const participantType = metadata.participantType as string | undefined;
        const identity = metadata.identity as string | undefined;
        
        if (participantName || identity) {
          const key = identity || participantName || 'unknown';
          const existing = participantMap.get(key);
          
          if (!existing || new Date(log.occurredAt) > existing.lastSeen) {
            participantMap.set(key, {
              name: participantName || identity || 'Unknown',
              type: participantType || 'guest',
              lastSeen: log.occurredAt,
            });
          }
        }
      }
    }
  }
  
  return Array.from(participantMap.values()).sort((a, b) => 
    b.lastSeen.getTime() - a.lastSeen.getTime()
  );
}

