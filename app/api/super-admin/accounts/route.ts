import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { hashPassword } from '@/lib/auth/server-auth';
import { z } from 'zod';
import { AccountRole, AccountStatus, Prisma, SubscriptionStatus } from '@prisma/client';

const createAccountSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  role: z.enum(['CLIENT'], {
    errorMap: () => ({ message: 'نوع الحساب غير صحيح' }),
  }),
  clientName: z.string().min(1, 'اسم العميل مطلوب').optional(),
});

const DEFAULT_PAGE_SIZE = 20;

const storageTierBounds: Record<
  string,
  {
    lt?: bigint;
    gte?: bigint;
  }
> = {
  low: { lt: BigInt(500 * 1024 * 1024) }, // < 500 MB
  medium: { gte: BigInt(500 * 1024 * 1024), lt: BigInt(5 * 1024 * 1024 * 1024) }, // 500 MB - 5 GB
  high: { gte: BigInt(5 * 1024 * 1024 * 1024) }, // > 5 GB
};

// GET - List all accounts with filters & metrics
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();
  } catch (error) {
    console.error('Accounts auth error:', error);
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get('page') || '1'));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get('pageSize') || String(DEFAULT_PAGE_SIZE))));
    const search = searchParams.get('search')?.trim() || undefined;
    const statusParam = searchParams.get('status');
    const planId = searchParams.get('planId') || undefined;
    const subscriptionStatusParam = searchParams.get('subscriptionStatus') || undefined;
    const createdFrom = searchParams.get('createdFrom');
    const createdTo = searchParams.get('createdTo');
    const storageTier = searchParams.get('storageTier') || undefined;

    const where: Prisma.AccountWhereInput = {
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

    const clientFilters: Prisma.ClientWhereInput[] = [];

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

    const clientIds = accounts
      .map((account) => account.client?.id)
      .filter((id): id is string => Boolean(id));

    let roomTotals: { clientId: string; count: number }[] = [];
    let activeRoomTotals: { clientId: string; count: number }[] = [];
    let storageSnapshots: StorageSnapshotLite[] = [];

    type StorageSnapshotLite = { clientId: string; totalBytes: number; capturedAt: Date };

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

    const roomCountMap = roomTotals.reduce<Record<string, number>>((acc, row) => {
      acc[row.clientId] = row.count;
      return acc;
    }, {});

    const activeRoomCountMap = activeRoomTotals.reduce<Record<string, number>>((acc, row) => {
      acc[row.clientId] = row.count;
      return acc;
    }, {});

    const storageMap = storageSnapshots.reduce<Record<string, StorageSnapshotLite>>((acc, snapshot) => {
      acc[snapshot.clientId] = snapshot;
      return acc;
    }, {});

    const accountsWithMetrics = accounts.map((account) => {
      const clientId = account.client?.id;
      const storageInfo = clientId ? storageMap[clientId] : undefined;
      return {
        id: account.id,
        email: account.email,
        role: account.role,
        status: account.status,
        createdAt: account.createdAt,
        client: account.client
          ? {
              id: account.client.id,
              name: account.client.name,
              email: account.client.email,
              subscription: account.client.subscription
                ? {
                    id: account.client.subscription.id,
                    status: account.client.subscription.status,
                    plan: account.client.subscription.plan
                      ? {
                          id: account.client.subscription.plan.id,
                          name: account.client.subscription.plan.name,
                        }
                      : null,
                    startDate: account.client.subscription.startDate,
                    endDate: account.client.subscription.endDate,
                  }
                : null,
            }
          : null,
        metrics: clientId
          ? {
              totalRooms: roomCountMap[clientId] || 0,
              activeRooms: activeRoomCountMap[clientId] || 0,
              storageBytes: storageInfo?.totalBytes || 0,
              storageCapturedAt: storageInfo?.capturedAt || null,
            }
          : null,
      };
    });

    return NextResponse.json({
      page,
      pageSize,
      total,
      accounts: accountsWithMetrics,
    });
  } catch (error) {
    console.error('Get accounts error:', error);
    return NextResponse.json(
      {
        error: 'حدث خطأ أثناء جلب الحسابات',
        detail: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}

// POST - Create new account
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    const validated = createAccountSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, role, clientName } = validated.data;

    // Check if account already exists
    const existingAccount = await prisma.account.findUnique({
      where: { email },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مستخدم بالفعل' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    if (role === 'CLIENT') {
      // Create client account with client record
      if (!clientName) {
        return NextResponse.json(
          { error: 'اسم العميل مطلوب لإنشاء حساب عميل' },
          { status: 400 }
        );
      }

      // Create account first
      const account = await prisma.account.create({
        data: {
          email,
          password: hashedPassword,
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      });

      // Create client record
      const client = await prisma.client.create({
        data: {
          name: clientName,
          email,
          accountId: account.id,
          maxRooms: 10,
          maxParticipants: 50,
        },
      });

      // Update account with clientId
      await prisma.account.update({
        where: { id: account.id },
        data: { clientId: client.id },
      });

      return NextResponse.json({
        account: {
          ...account,
          client,
        },
      }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'نوع الحساب غير مدعوم' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Create account error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الحساب' },
      { status: 500 }
    );
  }
}

