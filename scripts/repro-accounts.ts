import { PrismaClient, AccountRole, AccountStatus, SubscriptionStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  try {
    const DEFAULT_PAGE_SIZE = 20;
    const page = 1;
    const pageSize = 12 || DEFAULT_PAGE_SIZE;
    const search = undefined;
    const statusParam = undefined;
    const planId = undefined;
    const subscriptionStatusParam = undefined;
    const createdFrom = undefined;
    const createdTo = undefined;
    const storageTier = undefined;

    const storageTierBounds: Record<string, { lt?: bigint; gte?: bigint }> = {
      low: { lt: BigInt(500 * 1024 * 1024) },
      medium: { gte: BigInt(500 * 1024 * 1024), lt: BigInt(5 * 1024 * 1024 * 1024) },
      high: { gte: BigInt(5 * 1024 * 1024 * 1024) },
    };

    const where: any = {
      role: AccountRole.CLIENT,
    };

    if (statusParam) {
      const statuses = statusParam
        .split(',')
        .map((value) => value.trim())
        .filter((value): value is AccountStatus => Object.values(AccountStatus).includes(value as AccountStatus));

      if (statuses.length) {
        where.status = { in: statuses };
      }
    }

    if (search) {
      where.OR = [
        { email: { contains: search, mode: 'insensitive' } },
        {
          client: {
            name: {
              contains: search,
              mode: 'insensitive',
            },
          },
        },
      ];
    }

    if (createdFrom || createdTo) {
      where.createdAt = {};
      if (createdFrom) {
        const fromDate = new Date(createdFrom);
        if (!isNaN(fromDate.getTime())) {
          where.createdAt.gte = fromDate;
        }
      }
      if (createdTo) {
        const toDate = new Date(createdTo);
        if (!isNaN(toDate.getTime())) {
          where.createdAt.lte = toDate;
        }
      }
    }

    const clientFilters: any[] = [];

    if (planId) {
      clientFilters.push({
        subscription: {
          planId,
        },
      });
    }

    if (subscriptionStatusParam) {
      const status = subscriptionStatusParam.toUpperCase() as SubscriptionStatus;
      if (Object.values(SubscriptionStatus).includes(status)) {
        clientFilters.push({
          subscription: {
            status,
          },
        });
      }
    }

    if (storageTier && storageTierBounds[storageTier]) {
      clientFilters.push({
        storageSnapshots: {
          some: {
            totalBytes: storageTierBounds[storageTier],
          },
        },
      });
    }

    if (clientFilters.length) {
      where.client = { AND: clientFilters };
    }

    const [accounts, total] = await prisma.$transaction([
      prisma.account.findMany({
        where,
        include: {
          client: {
            include: {
              subscription: {
                include: {
                  plan: true,
                },
              },
            },
          },
        },
        orderBy: {
          createdAt: 'desc',
        },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.account.count({ where }),
    ]);

    console.log('Accounts fetched:', accounts.length, total);

    const clientIds = accounts.map((account) => account.client?.id).filter((id): id is string => Boolean(id));

    type StorageSnapshotLite = { clientId: string; totalBytes: number; capturedAt: Date };

    let roomTotals: { clientId: string; count: number }[] = [];
    let activeRoomTotals: { clientId: string; count: number }[] = [];
    let storageSnapshots: StorageSnapshotLite[] = [];

    if (clientIds.length) {
      const [totalRoomsRaw, activeRoomsRaw, storageSnapshotRaw] = await prisma.$transaction([
        prisma.room.groupBy({
          by: ['clientId'],
          where: { clientId: { in: clientIds } },
          _count: { _all: true },
        }),
        prisma.room.groupBy({
          by: ['clientId'],
          where: { clientId: { in: clientIds }, isActive: true },
          _count: { _all: true },
        }),
        prisma.storageSnapshot.findMany({
          where: { clientId: { in: clientIds } },
          orderBy: { capturedAt: 'desc' },
        }),
      ]);

      roomTotals = totalRoomsRaw.map((row) => ({ clientId: row.clientId, count: row._count._all }));
      activeRoomTotals = activeRoomsRaw.map((row) => ({ clientId: row.clientId, count: row._count._all }));

      const snapshotMap: Record<string, StorageSnapshotLite> = {};
      for (const snapshot of storageSnapshotRaw) {
        if (!snapshotMap[snapshot.clientId]) {
          snapshotMap[snapshot.clientId] = {
            clientId: snapshot.clientId,
            totalBytes: Number(snapshot.totalBytes),
            capturedAt: snapshot.capturedAt,
          };
        }
      }
      storageSnapshots = Object.values(snapshotMap);
    }

    console.log('Room stats:', roomTotals.length, activeRoomTotals.length, storageSnapshots.length);
  } catch (error) {
    console.error('Repro error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();

