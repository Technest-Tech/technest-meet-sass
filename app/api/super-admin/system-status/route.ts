import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { RoomServiceClient } from 'livekit-server-sdk';

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const [dbStatus, livekitStatus, apiStatus, storageStatus] = await Promise.all([
      checkDatabaseHealth(),
      checkLiveKitStatus(),
      getAPIStats(),
      getStorageStats(),
    ]);

    return NextResponse.json({
      database: dbStatus,
      livekit: livekitStatus,
      api: apiStatus,
      storage: storageStatus,
    });
  } catch (error) {
    console.error('System status error:', error);
    return NextResponse.json({ error: 'Failed to fetch system status' }, { status: 500 });
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
  const maxStorage = 100 * 1024 * 1024 * 1024;

  return {
    used: totalBytes,
    total: maxStorage,
    percentage: (totalBytes / maxStorage) * 100,
  };
}

