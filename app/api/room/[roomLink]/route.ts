import { NextRequest, NextResponse } from 'next/server';
import { prisma, getNextParticipantName } from '@/lib/database';
import { AccessToken } from 'livekit-server-sdk';

/**
 * @deprecated This API endpoint is no longer used.
 * The custom room system now redirects to the working system implementation.
 * See: app/room/[roomLink]/page.tsx
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ roomLink: string }> }
) {
  // Return a deprecation notice
  return NextResponse.json(
    { 
      error: 'This API endpoint is deprecated. The custom room system now uses the working system implementation.',
      message: 'Please use the working system at /rooms/[roomName] instead.',
      status: 'deprecated'
    },
    { status: 410 } // Gone - resource is deprecated
  );
}
