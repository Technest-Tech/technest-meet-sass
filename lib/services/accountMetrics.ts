import { prisma } from '@/lib/database';
import { InvoiceStatus } from '@prisma/client';
import type {
  Account,
  AccountNote,
  BillingInvoice,
  Room,
  StorageSnapshot,
  Subscription,
  RoomActivityLog,
} from '@prisma/client';

type RoomUsageStat = {
  id: string;
  name: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  fileCount: number;
  storageBytes: number;
};

export type AccountUsageSummary = {
  account: Pick<Account, 'id' | 'email' | 'status' | 'role' | 'createdAt'>;
  client: {
    id: string;
    name: string;
    email: string;
    maxRooms: number;
    maxParticipants: number;
    createdAt: Date;
  };
  subscription: (Subscription & { plan?: { id: string; name: string } }) | null;
  totals: {
    rooms: number;
    activeRooms: number;
    files: number;
    storageBytes: number;
  };
  rooms: RoomUsageStat[];
  storageSnapshot: (StorageSnapshot & { totalBytes: number }) | null;
  invoices: BillingInvoice[];
  notes: AccountNote[];
};

/**
 * Fetch aggregated metrics for an account, including rooms, files, storage, invoices, and notes.
 */
export async function getAccountUsageSummary(accountId: string): Promise<AccountUsageSummary | null> {
  const account = await prisma.account.findUnique({
    where: { id: accountId },
    include: {
      client: {
        include: {
          subscription: {
            include: {
              plan: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!account || !account.client) {
    return null;
  }

  const clientId = account.client.id;

  const rooms: Pick<Room, 'id' | 'name' | 'isActive' | 'createdAt' | 'updatedAt'>[] =
    await prisma.room.findMany({
      where: { clientId },
      select: {
        id: true,
        name: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

  const [fileAggregate, roomFileBreakdown, latestStorageSnapshot, notes, invoices] = await prisma.$transaction([
    prisma.roomFile.aggregate({
      where: {
        room: { clientId },
      },
      _sum: {
        size: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.roomFile.groupBy({
      by: ['roomId'],
      where: {
        room: { clientId },
      },
      _sum: {
        size: true,
      },
      _count: {
        _all: true,
      },
    }),
    prisma.storageSnapshot.findFirst({
      where: { clientId },
      orderBy: { capturedAt: 'desc' },
    }),
    prisma.accountNote.findMany({
      where: { accountId },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
      take: 10,
    }),
    prisma.billingInvoice.findMany({
      where: { clientId },
      orderBy: { issuedAt: 'desc' },
      take: 5,
    }),
  ]);

  const roomFileMap = roomFileBreakdown.reduce<Record<string, { count: number; size: number }>>(
    (acc, item) => {
      acc[item.roomId] = {
        count: item._count._all ?? 0,
        size: item._sum.size ?? 0,
      };
      return acc;
    },
    {},
  );

  const roomStats: RoomUsageStat[] = rooms.map((room) => {
    const metrics = roomFileMap[room.id] || { count: 0, size: 0 };
    return {
      ...room,
      fileCount: metrics.count,
      storageBytes: metrics.size,
    };
  });

  const storageSnapshot = latestStorageSnapshot
    ? ({ ...latestStorageSnapshot, totalBytes: Number(latestStorageSnapshot.totalBytes) } as StorageSnapshot & {
        totalBytes: number;
      })
    : null;

  return {
    account: {
      id: account.id,
      email: account.email,
      status: account.status,
      role: account.role,
      createdAt: account.createdAt,
    },
    client: {
      id: account.client.id,
      name: account.client.name,
      email: account.client.email,
      maxRooms: account.client.maxRooms,
      maxParticipants: account.client.maxParticipants,
      createdAt: account.client.createdAt,
    },
    subscription: account.client.subscription
      ? {
          ...account.client.subscription,
          plan: account.client.subscription.plan
            ? {
                id: account.client.subscription.plan.id,
                name: account.client.subscription.plan.name,
              }
            : undefined,
        }
      : null,
    totals: {
      rooms: rooms.length,
      activeRooms: rooms.filter((room) => room.isActive).length,
      files: fileAggregate._count._all ?? 0,
      storageBytes: fileAggregate._sum.size ?? 0,
    },
    rooms: roomStats,
    storageSnapshot,
    invoices,
    notes,
  };
}

export type BillingSnapshot = {
  subscription: (Subscription & { plan?: { id: string; name: string } }) | null;
  latestInvoice: BillingInvoice | null;
  overdueInvoices: BillingInvoice[];
  paidInvoices: BillingInvoice[];
};

/**
 * Fetch billing summary for a given client.
 */
export async function getAccountBillingSnapshot(clientId: string): Promise<BillingSnapshot> {
  const subscription = await prisma.subscription.findUnique({
    where: { clientId },
    include: {
      plan: {
        select: {
          id: true,
          name: true,
        },
      },
    },
  });

  const invoices = await prisma.billingInvoice.findMany({
    where: { clientId },
    orderBy: { issuedAt: 'desc' },
  });

  return {
    subscription,
    latestInvoice: invoices[0] ?? null,
    overdueInvoices: invoices.filter(
      (invoice) => invoice.status === InvoiceStatus.PAST_DUE || invoice.status === InvoiceStatus.OPEN,
    ),
    paidInvoices: invoices.filter(
      (invoice) => invoice.status === InvoiceStatus.PAID || invoice.status === InvoiceStatus.REFUNDED,
    ),
  };
}

/**
 * Return chronological room activity for dashboards.
 */
export async function getRoomActivityTimeline(clientId: string, limit = 25): Promise<RoomActivityLog[]> {
  return prisma.roomActivityLog.findMany({
    where: { clientId },
    orderBy: { occurredAt: 'desc' },
    take: limit,
  });
}

