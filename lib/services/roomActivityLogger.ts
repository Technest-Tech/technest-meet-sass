import { ActivityEventType } from '@prisma/client';
import { prisma } from '@/lib/database';
import { logger } from '@/lib/utils/logger';
import type { DeviceInfo } from '@/lib/utils/deviceDetection';

type BaseLogContext = {
  roomId: string;
  clientId: string;
  actorAccountId?: string | null;
};

type ParticipantLogPayload = BaseLogContext & {
  participantName: string;
  participantType: 'host' | 'guest' | 'observer';
  identity?: string;
  device?: DeviceInfo;
  description?: string;
  metadata?: Record<string, unknown>;
};

async function createActivityLog(
  event: ActivityEventType,
  context: BaseLogContext,
  description?: string,
  metadata?: Record<string, unknown>,
) {
  try {
    await prisma.roomActivityLog.create({
      data: {
        event,
        roomId: context.roomId,
        clientId: context.clientId,
        actorAccountId: context.actorAccountId ?? null,
        description,
        metadata: metadata ?? undefined,
      },
    });
  } catch (error) {
    logger.error('Failed to create room activity log', { event, context, error });
  }
}

async function hasActiveSession(roomId: string): Promise<boolean> {
  const latestSessionEvent = await prisma.roomActivityLog.findFirst({
    where: {
      roomId,
      event: {
        in: [ActivityEventType.ROOM_STARTED, ActivityEventType.ROOM_ENDED],
      },
    },
    orderBy: { occurredAt: 'desc' },
  });

  return latestSessionEvent?.event === ActivityEventType.ROOM_STARTED;
}

export async function logRoomStarted(context: BaseLogContext, metadata?: Record<string, unknown>) {
  const active = await hasActiveSession(context.roomId);
  if (active) {
    return;
  }
  await createActivityLog(ActivityEventType.ROOM_STARTED, context, 'Room session started', metadata);
}

export async function logRoomEnded(context: BaseLogContext, metadata?: Record<string, unknown>) {
  const active = await hasActiveSession(context.roomId);
  if (!active) {
    return;
  }
  await createActivityLog(ActivityEventType.ROOM_ENDED, context, 'Room session ended', metadata);
}

export async function logParticipantJoined(payload: ParticipantLogPayload) {
  const { participantName, participantType, device, metadata, ...context } = payload;

  const logMetadata = {
    participantName,
    participantType,
    identity: payload.identity,
    device,
    ...metadata,
  };

  await createActivityLog(
    ActivityEventType.PARTICIPANT_JOINED,
    context,
    `${participantName} (${participantType}) joined the room`,
    logMetadata,
  );

  await logRoomStarted(context, { triggeredBy: participantName, participantType });
}

export async function logParticipantLeft(payload: ParticipantLogPayload) {
  const { participantName, participantType, device, metadata, ...context } = payload;

  const logMetadata = {
    participantName,
    participantType,
    identity: payload.identity,
    device,
    ...metadata,
  };

  await createActivityLog(
    ActivityEventType.PARTICIPANT_LEFT,
    context,
    `${participantName} (${participantType}) left the room`,
    logMetadata,
  );
}

