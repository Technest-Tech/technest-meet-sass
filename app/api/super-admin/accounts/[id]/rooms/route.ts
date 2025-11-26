import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { ActivityEventType, Prisma } from '@prisma/client';

const DEFAULT_ROOMS_PAGE_SIZE = 10;

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
    const account = await prisma.account.findUnique({
      where: { id: params.id },
      select: { clientId: true },
    });

    if (!account?.clientId) {
      return NextResponse.json({ error: 'الحساب لا يملك عميلاً مرتبطاً' }, { status: 404 });
    }

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const pageSize = Math.min(50, Math.max(1, Number(searchParams.get('pageSize') || String(DEFAULT_ROOMS_PAGE_SIZE))));
    const statusFilter = searchParams.get('status');
    const search = searchParams.get('search')?.trim() || undefined;

    const where: Prisma.RoomWhereInput = {
      clientId: account.clientId,
    };

    if (statusFilter === 'ACTIVE' || statusFilter === 'INACTIVE') {
      where.isActive = statusFilter === 'ACTIVE';
    }

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [rooms, total] = await prisma.$transaction([
      prisma.room.findMany({
        where,
        include: {
          files: {
            select: {
              id: true,
              filename: true,
              originalName: true,
              fileType: true,
              size: true,
              uploadedBy: true,
              uploadedAt: true,
            },
            orderBy: { uploadedAt: 'desc' },
            take: 5,
          },
          activityLogs: {
            take: 5,
            orderBy: { occurredAt: 'desc' },
          },
          _count: {
            select: {
              files: true,
              participants: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.room.count({ where }),
    ]);

    const roomIds = rooms.map((room) => room.id);
    const fileSummaries = roomIds.length
      ? await prisma.roomFile.groupBy({
          by: ['roomId'],
          where: { roomId: { in: roomIds } },
          _sum: { size: true },
          _count: { _all: true },
        })
      : [];

    const fileSummaryMap = fileSummaries.reduce<Record<string, { count: number; size: number }>>((acc, item) => {
      acc[item.roomId] = {
        count: item._count._all ?? 0,
        size: item._sum.size ?? 0,
      };
      return acc;
    }, {});

    const sessionStatusMap = await buildSessionStatusMap(roomIds);

    const payload = rooms.map((room) => ({
      id: room.id,
      name: room.name,
      description: room.description,
      isActive: room.isActive,
      createdAt: room.createdAt,
      updatedAt: room.updatedAt,
      maxParticipants: room.maxParticipants,
      hostApproval: room.hostApproval,
      enableFileSharing: room.enableFileSharing,
      stats: {
        fileCount: fileSummaryMap[room.id]?.count || 0,
        storageBytes: fileSummaryMap[room.id]?.size || 0,
        participantSlots: room._count.participants,
      },
      recentFiles: room.files,
      recentActivity: room.activityLogs,
      sessionStatus: {
        isRunning: sessionStatusMap[room.id]?.isRunning ?? false,
        currentSessionStart: sessionStatusMap[room.id]?.currentSessionStart ?? null,
      },
    }));

    return NextResponse.json({
      page,
      pageSize,
      total,
      rooms: payload,
    });
  } catch (error) {
    console.error('Get account rooms error:', error);
    return NextResponse.json({ error: 'تعذر تحميل الغرف' }, { status: 500 });
  }
}

async function buildSessionStatusMap(roomIds: string[]) {
  if (!roomIds.length) {
    return {};
  }

  const events = await prisma.roomActivityLog.findMany({
    where: {
      roomId: { in: roomIds },
      event: {
        in: [ActivityEventType.ROOM_STARTED, ActivityEventType.ROOM_ENDED],
      },
    },
    orderBy: { occurredAt: 'desc' },
  });

  return events.reduce<Record<string, { isRunning: boolean; currentSessionStart: string | null }>>((acc, event) => {
    if (acc[event.roomId]) {
      return acc;
    }

    if (event.event === ActivityEventType.ROOM_STARTED) {
      acc[event.roomId] = {
        isRunning: true,
        currentSessionStart: event.occurredAt.toISOString(),
      };
    } else {
      acc[event.roomId] = {
        isRunning: false,
        currentSessionStart: null,
      };
    }

    return acc;
  }, {});
}

