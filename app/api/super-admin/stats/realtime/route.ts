import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { queryAllLiveKitServers } from '@/lib/utils/livekit-multi-server';

export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    // Query all configured LiveKit servers and aggregate results
    const aggregatedData = await queryAllLiveKitServers();

    return NextResponse.json({
      activeSessions: aggregatedData.activeSessions,
      totalParticipants: aggregatedData.totalParticipants,
      rooms: aggregatedData.rooms,
      timestamp: new Date().toISOString(),
      // Include server breakdown for debugging (optional)
      serverBreakdown: aggregatedData.serverBreakdown,
    });
  } catch (error) {
    console.error('Real-time stats error:', error);
    // Return zeros if all servers fail
    return NextResponse.json({
      activeSessions: 0,
      totalParticipants: 0,
      rooms: [],
      timestamp: new Date().toISOString(),
    });
  }
}

