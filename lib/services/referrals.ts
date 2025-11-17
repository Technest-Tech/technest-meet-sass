import {
  ProspectStatus,
  RedeemRequestStatus,
  ReferralEventStatus,
  ReferralEventType,
  RewardType,
  Prisma,
} from '@prisma/client';
import { prisma } from '../database';

const APP_BASE_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXTAUTH_URL ||
  'http://localhost:3000';

const REFERRAL_TARGET_PATH = process.env.REFERRAL_TARGET_PATH;

const REFERRAL_QUERY_PARAM = 'ref';

function normalizeBaseUrl(url: string) {
  if (!url) return '';
  return url.endsWith('/') ? url.slice(0, -1) : url;
}

function generateReferralCode(seed?: string) {
  const sanitized = (seed || '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .slice(0, 6)
    .toUpperCase();
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${sanitized || 'CLIENT'}-${suffix}`;
}

async function getReferralSettings() {
  let settings = await prisma.referralSetting.findFirst();
  if (!settings) {
    settings = await prisma.referralSetting.create({
      data: {
        registerPoints: 5,
        subscribePoints: 25,
        largePlanPoints: 40,
        largePlanThreshold: 1000,
        minRedeemPoints: 50,
        creditPointValue: 1,
        freeRoomDays: 30,
      },
    });
  }
  return settings;
}

export async function ensureReferralLink(clientId: string) {
  const client = await prisma.client.findUnique({
    where: { id: clientId },
    select: { id: true, name: true, referralLink: true },
  });

  if (!client) {
    throw new Error('Client not found');
  }

  if (client.referralLink) {
    return client.referralLink;
  }

  return prisma.referralLink.create({
    data: {
      clientId: client.id,
      code: generateReferralCode(client.name),
    },
  });
}

export async function regenerateReferralLink(clientId: string) {
  const link = await ensureReferralLink(clientId);
  return prisma.referralLink.update({
    where: { id: link.id },
    data: {
      code: generateReferralCode(),
    },
  });
}

export function buildReferralShareUrl(code: string, baseUrl?: string) {
  if (!code) return '';
  const base = normalizeBaseUrl(baseUrl || APP_BASE_URL);
  if (!base) {
    return code;
  }
  const url = new URL(base);
  if (REFERRAL_TARGET_PATH) {
    url.pathname = REFERRAL_TARGET_PATH.startsWith('/')
      ? REFERRAL_TARGET_PATH
      : `/${REFERRAL_TARGET_PATH}`;
  }
  url.searchParams.set(REFERRAL_QUERY_PARAM, code);
  return url.toString();
}

async function applyReferralPoints(referralLinkId: string, points: number, tx = prisma) {
  if (!points) {
    return;
  }

  await tx.referralLink.update({
    where: { id: referralLinkId },
    data: {
      totalPoints: { increment: points },
      availablePoints: { increment: points },
    },
  });
}

export type ProspectInput = {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  companyName?: string | null;
  desiredPlanId?: string | null;
  notes?: string | null;
};

export async function registerReferralSignup(params: {
  referralCode: string;
  referredEmail?: string | null;
  metadata?: Prisma.JsonValue;
  prospect?: ProspectInput;
}) {
  const settings = await getReferralSettings();
  const referralLink = await prisma.referralLink.findUnique({
    where: { code: params.referralCode },
  });

  if (!referralLink) {
    throw new Error('Invalid referral code');
  }

  const event = await prisma.$transaction(async (tx) => {
    const metadataObject: Prisma.JsonObject = {
      pendingPoints: settings.registerPoints,
    };

    if (params.metadata && typeof params.metadata === 'object' && !Array.isArray(params.metadata)) {
      Object.assign(metadataObject, params.metadata as Prisma.JsonObject);
    } else if (params.metadata !== undefined) {
      metadataObject.originalPayload = params.metadata;
    }

    const event = await tx.referralEvent.create({
      data: {
        referralLinkId: referralLink.id,
        referredEmail: params.referredEmail ?? undefined,
        eventType: ReferralEventType.REGISTERED,
        status: ReferralEventStatus.PENDING,
        pointsAwarded: 0,
        metadata: metadataObject,
      },
    });

    await tx.referralLink.update({
      where: { id: referralLink.id },
      data: {
        referralCount: { increment: 1 },
      },
    });

    if (params.prospect) {
      await tx.prospectRegistration.create({
        data: {
          referralEventId: event.id,
          name: params.prospect.name,
          email: params.prospect.email ?? params.referredEmail,
          phone: params.prospect.phone,
          companyName: params.prospect.companyName,
          desiredPlanId: params.prospect.desiredPlanId,
          notes: params.prospect.notes,
          status: ProspectStatus.NEW,
        },
      });
    }

    return event;
  });

  console.info('Referral signup recorded', {
    eventId: event.id,
    referralCode: params.referralCode,
    referredEmail: params.referredEmail,
  });

  return event;
}

export async function qualifyReferralEvent(params: {
  referralEventId?: string;
  referralCode?: string;
  referredEmail?: string;
  referredClientId?: string;
  eventType: ReferralEventType;
  pointsOverride?: number;
  metadata?: Prisma.JsonValue;
}) {
  const settings = await getReferralSettings();
  let event = params.referralEventId
    ? await prisma.referralEvent.findUnique({
        where: { id: params.referralEventId },
      })
    : null;

  if (!event) {
    if (params.referredClientId) {
      event = await prisma.referralEvent.findFirst({
        where: {
          referredClientId: params.referredClientId,
          eventType: params.eventType,
        },
      });
    }
  }

  if (!event && params.referredEmail) {
    event = await prisma.referralEvent.findFirst({
      where: {
        referredEmail: params.referredEmail,
        eventType: params.eventType,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  let fallbackLinkId: string | null = null;

  if (!event && (params.referredClientId || params.referredEmail)) {
    const lastEvent = await prisma.referralEvent.findFirst({
      where: {
        OR: [
          params.referredClientId ? { referredClientId: params.referredClientId } : undefined,
          params.referredEmail ? { referredEmail: params.referredEmail } : undefined,
        ].filter(Boolean) as Prisma.ReferralEventWhereInput[],
      },
      orderBy: { createdAt: 'desc' },
    });

    fallbackLinkId = lastEvent?.referralLinkId ?? null;
  }

  if (!event) {
    let referralLinkId: string | null = null;

    if (params.referralCode) {
      const referralLink = await prisma.referralLink.findUnique({
        where: { code: params.referralCode },
      });
      referralLinkId = referralLink?.id ?? null;
    } else if (fallbackLinkId) {
      referralLinkId = fallbackLinkId;
    }

    if (!referralLinkId) {
      throw new Error('Referral link not found for conversion');
    }

    event = await prisma.referralEvent.create({
      data: {
        referralLinkId,
        referredEmail: params.referredEmail,
        referredClientId: params.referredClientId,
        eventType: params.eventType,
        status: ReferralEventStatus.PENDING,
        metadata: params.metadata,
      },
    });
  }

  if (!event) {
    throw new Error('Referral event not found');
  }

  if (event.status === ReferralEventStatus.QUALIFIED) {
    return event;
  }

  const metadataObject =
    event.metadata && typeof event.metadata === 'object' && !Array.isArray(event.metadata)
      ? (event.metadata as Prisma.JsonObject)
      : undefined;

  let defaultPoints: number | undefined;
  switch (params.eventType) {
    case ReferralEventType.SUBSCRIBED:
      defaultPoints = settings.subscribePoints;
      break;
    case ReferralEventType.LARGE_PLAN:
      defaultPoints = settings.largePlanPoints;
      break;
    case ReferralEventType.REGISTERED:
      defaultPoints =
        (metadataObject?.pendingPoints as number | undefined) ?? settings.registerPoints;
      break;
    default:
      defaultPoints = settings.registerPoints;
  }
  const points = params.pointsOverride ?? defaultPoints ?? 0;

  const updatedEvent = await prisma.$transaction(async (tx) => {
    const updatedEvent = await tx.referralEvent.update({
      where: { id: event!.id },
      data: {
        status: ReferralEventStatus.QUALIFIED,
        pointsAwarded: points,
        processedAt: new Date(),
        metadata: params.metadata ?? event!.metadata,
        referredClientId: params.referredClientId ?? event!.referredClientId,
        referredEmail: params.referredEmail ?? event!.referredEmail,
      },
    });

    if (points > 0) {
      await applyReferralPoints(event.referralLinkId, points, tx);
    }

    return updatedEvent;
  });

  console.info('Referral event qualified', {
    eventId: updatedEvent.id,
    eventType: params.eventType,
    points,
  });

  return updatedEvent;
}

export async function listRewardsForClient(clientId: string) {
  const referralLink = await ensureReferralLink(clientId);

  const [rewards, redeemRequests] = await Promise.all([
    prisma.rewardCatalog.findMany({
      where: { isActive: true },
      orderBy: { createdAt: 'asc' },
      take: 4,
    }),
    prisma.redeemRequest.findMany({
      where: { clientId },
      orderBy: { createdAt: 'desc' },
    }),
  ]);

  return {
    referralLink,
    rewards: rewards.map((reward) => ({
      ...reward,
      isAffordable: referralLink.availablePoints >= reward.costPoints,
    })),
    redeemRequests,
  };
}

export async function getReferralOverview(clientId: string) {
  const referralLink = await ensureReferralLink(clientId);
  const shareUrl = buildReferralShareUrl(referralLink.code);

  const [events, settings] = await Promise.all([
    prisma.referralEvent.findMany({
      where: { referralLinkId: referralLink.id },
      orderBy: { occurredAt: 'desc' },
      take: 50,
    }),
    getReferralSettings(),
  ]);

  return {
    referralLink,
    shareUrl,
    settings,
    stats: {
      totalPoints: referralLink.totalPoints,
      availablePoints: referralLink.availablePoints,
      redeemedPoints: referralLink.redeemedPoints,
      referralCount: referralLink.referralCount,
      qualifiedEvents: events.filter(
        (event) => event.status === ReferralEventStatus.QUALIFIED,
      ).length,
    },
    events,
  };
}

export async function createRedeemRequest(params: {
  clientId: string;
  rewardId: string;
  notes?: string;
  payload?: Prisma.JsonValue;
}) {
  const referralLink = await ensureReferralLink(params.clientId);
  const reward = await prisma.rewardCatalog.findUnique({
    where: { id: params.rewardId },
  });

  if (!reward || !reward.isActive) {
    throw new Error('Reward not available');
  }

  if (referralLink.availablePoints < reward.costPoints) {
    throw new Error('Insufficient referral points');
  }

  const redeemRequest = await prisma.$transaction(async (tx) => {
    const redeemRequest = await tx.redeemRequest.create({
      data: {
        clientId: params.clientId,
        referralLinkId: referralLink.id,
        rewardId: reward.id,
        pointsSpent: reward.costPoints,
        status: RedeemRequestStatus.PENDING,
        notes: params.notes,
        payload: params.payload,
      },
    });

    await tx.referralLink.update({
      where: { id: referralLink.id },
      data: {
        availablePoints: { decrement: reward.costPoints },
        redeemedPoints: { increment: reward.costPoints },
      },
    });

    return redeemRequest;
  });

  console.info('Redeem request created', {
    requestId: redeemRequest.id,
    clientId: params.clientId,
    rewardId: params.rewardId,
    pointsSpent: redeemRequest.pointsSpent,
  });

  return redeemRequest;
}

export async function updateRedeemRequestStatus(params: {
  requestId: string;
  status: RedeemRequestStatus;
  reviewerId: string;
  notes?: string;
}) {
  const request = await prisma.redeemRequest.findUnique({
    where: { id: params.requestId },
    include: { referralLink: true },
  });

  if (!request) {
    throw new Error('Redeem request not found');
  }

  if (
    request.status === RedeemRequestStatus.FULFILLED ||
    request.status === RedeemRequestStatus.REJECTED
  ) {
    return request;
  }

  const updatedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.redeemRequest.update({
      where: { id: params.requestId },
      data: {
        status: params.status,
        reviewedById: params.reviewerId,
        reviewedAt: new Date(),
        notes: params.notes ?? request.notes,
      },
    });

    if (params.status === RedeemRequestStatus.REJECTED) {
      await tx.referralLink.update({
        where: { id: request.referralLinkId! },
        data: {
          availablePoints: { increment: request.pointsSpent },
          redeemedPoints: { decrement: request.pointsSpent },
        },
      });
    }

    return updated;
  });

  console.info('Redeem request updated', {
    requestId: params.requestId,
    status: params.status,
    reviewerId: params.reviewerId,
  });

  return updatedRequest;
}

export async function listProspects() {
  return prisma.prospectRegistration.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      referralEvent: {
        include: {
          referralLink: {
            include: { client: true },
          },
        },
      },
      assignedAdmin: true,
    },
  });
}

export async function updateProspectStatus(params: {
  prospectId: string;
  status: ProspectStatus;
  assignedAdminId?: string;
  notes?: string;
}) {
  return prisma.prospectRegistration.update({
    where: { id: params.prospectId },
    data: {
      status: params.status,
      assignedAdminId: params.assignedAdminId,
      notes: params.notes,
    },
  });
}

export async function approveProspect(
  prospectId: string,
  reviewerId: string,
  pointsOverride?: number,
) {
  const prospect = await prisma.prospectRegistration.findUnique({
    where: { id: prospectId },
    include: { referralEvent: true },
  });

  if (!prospect || !prospect.referralEvent) {
    throw new Error('Prospect or referral event not found');
  }

  await qualifyReferralEvent({
    referralEventId: prospect.referralEvent.id,
    referredEmail: prospect.email ?? prospect.referralEvent.referredEmail ?? undefined,
    referredClientId: prospect.referralEvent.referredClientId ?? undefined,
    eventType: prospect.referralEvent.eventType,
    pointsOverride,
  });

  return prisma.prospectRegistration.update({
    where: { id: prospectId },
    data: {
      status: ProspectStatus.ACTIVATED,
      assignedAdminId: reviewerId,
    },
    include: {
      referralEvent: {
        include: {
          referralLink: {
            include: { client: true },
          },
        },
      },
      assignedAdmin: true,
    },
  });
}

export async function rejectProspect(
  prospectId: string,
  reviewerId: string,
  notes?: string,
) {
  return prisma.$transaction(async (tx) => {
    const prospect = await tx.prospectRegistration.findUnique({
      where: { id: prospectId },
      include: { referralEvent: true },
    });

    if (!prospect || !prospect.referralEvent) {
      throw new Error('Prospect or referral event not found');
    }

    await tx.referralEvent.update({
      where: { id: prospect.referralEvent.id },
      data: {
        status: ReferralEventStatus.CANCELED,
        processedAt: new Date(),
        pointsAwarded: 0,
      },
    });

    return tx.prospectRegistration.update({
      where: { id: prospectId },
      data: {
        status: ProspectStatus.ARCHIVED,
        assignedAdminId: reviewerId,
        notes: notes ?? prospect.notes,
      },
      include: {
        referralEvent: {
          include: {
            referralLink: {
              include: { client: true },
            },
          },
        },
        assignedAdmin: true,
      },
    });
  });
}

