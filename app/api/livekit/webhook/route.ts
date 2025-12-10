import { NextRequest, NextResponse } from 'next/server';
import { WebhookReceiver } from 'livekit-server-sdk';
import { prisma } from '@/lib/database';
import { logParticipantLeft, logRoomEnded } from '@/lib/services/roomActivityLogger';
import { sanitizeRoomIdentifier } from '@/lib/utils/sanitize';
import { getSecrets } from '@/lib/config/secrets';

// Lazy initialization to avoid calling getSecrets() at build time
let receiver: WebhookReceiver | null = null;

function getReceiver(): WebhookReceiver {
  if (!receiver) {
    const secrets = getSecrets();
    receiver = new WebhookReceiver(secrets.livekitApiKey, secrets.livekitApiSecret);
  }
  return receiver;
}

export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('authorization') || '';
  const body = await request.text();
  
  // Validate webhook payload size (prevent DoS)
  if (body.length > 100000) { // 100KB max
    return NextResponse.json(
      { error: 'Payload too large' },
      { status: 413 }
    );
  }

  try {
    const event = await getReceiver().receive(body, authHeader);
    const roomName = event.room?.name;

    if (!roomName) {
      return NextResponse.json({ error: 'Missing room information' }, { status: 400 });
    }

    // Sanitize room name to prevent injection
    const sanitizedRoomName = sanitizeRoomIdentifier(roomName);

    const room = await prisma.room.findFirst({
      where: {
        OR: [{ hostLink: sanitizedRoomName }, { guestLink: sanitizedRoomName }, { observerLink: sanitizedRoomName }],
      },
      select: { id: true, clientId: true },
    });

    if (!room) {
      return NextResponse.json({ status: 'ignored', reason: 'room-not-found' });
    }

    if (event.event === 'participant_left') {
      await handleParticipantLeft(event, room.id, room.clientId);
    }

    if (event.event === 'room_finished') {
      await logRoomEnded(
        { roomId: room.id, clientId: room.clientId },
        { triggeredBy: 'webhook', reason: 'room_finished' },
      );
    }

    return NextResponse.json({ status: 'ok' });
  } catch (error) {
    console.error('Invalid webhook event', error);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
}

async function handleParticipantLeft(event: any, roomId: string, clientId: string) {
  const participant = event.participant;
  if (!participant) return;

  let parsedMetadata: Record<string, unknown> = {};
  if (participant.metadata) {
    try {
      parsedMetadata = JSON.parse(participant.metadata);
    } catch {
      parsedMetadata = {};
    }
  }

  await logParticipantLeft({
    roomId,
    clientId,
    participantName: participant.name || participant.identity || 'مشارك',
    participantType: (parsedMetadata.type as 'host' | 'guest' | 'observer') || 'guest',
    identity: participant.identity,
    metadata: parsedMetadata,
  });
}

