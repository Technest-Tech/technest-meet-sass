import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { getAccountUsageSummary, getRoomActivityTimeline } from '@/lib/services/accountMetrics';
import { AccountStatus, Prisma } from '@prisma/client';
import { z } from 'zod';

const updateAccountSchema = z.object({
  email: z.string().email().optional(),
  status: z.nativeEnum(AccountStatus).optional(),
  clientName: z.string().min(1).optional(),
  maxRooms: z.number().int().min(1).max(1000).optional(),
  maxParticipants: z.number().int().min(1).max(5000).optional(),
  enableObserverLinks: z.boolean().optional(),
});

const deleteAccountSchema = z.object({
  mode: z.enum(['ARCHIVE', 'DELETE']).default('ARCHIVE'),
  reason: z.string().max(500).optional(),
});

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  try {
    await requireSuperAdmin();
    const summary = await getAccountUsageSummary(params.id);

    if (!summary) {
      return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
    }

    const activity = await getRoomActivityTimeline(summary.client.id, 40);

    const storageByType = await prisma.roomFile.groupBy({
      by: ['fileType'],
      where: { room: { clientId: summary.client.id } },
      _sum: { size: true },
      _count: { _all: true },
    });

    return NextResponse.json({
      profile: summary,
      activity,
      storageByType: storageByType.map((item) => ({
        fileType: item.fileType,
        fileCount: item._count._all ?? 0,
        storageBytes: item._sum.size ?? 0,
      })),
    });
  } catch (error) {
    console.error('Get account profile error:', error);
    return NextResponse.json({ error: 'تعذر تحميل بيانات الحساب' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    const parsed = updateAccountSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const account = await prisma.account.findUnique({
      where: { id: params.id },
      include: { client: true },
    });

    if (!account || !account.client) {
      return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
    }

    const accountUpdates: Prisma.AccountUpdateInput = {};
    const clientUpdates: Prisma.ClientUpdateInput = {};

    if (parsed.data.email && parsed.data.email !== account.email) {
      accountUpdates.email = parsed.data.email;
    }

    if (parsed.data.status && parsed.data.status !== account.status) {
      accountUpdates.status = parsed.data.status;
    }

    if (parsed.data.clientName && parsed.data.clientName !== account.client.name) {
      clientUpdates.name = parsed.data.clientName;
    }

    if (
      typeof parsed.data.maxRooms === 'number' &&
      parsed.data.maxRooms !== account.client.maxRooms
    ) {
      clientUpdates.maxRooms = parsed.data.maxRooms;
    }

    if (
      typeof parsed.data.maxParticipants === 'number' &&
      parsed.data.maxParticipants !== account.client.maxParticipants
    ) {
      clientUpdates.maxParticipants = parsed.data.maxParticipants;
    }

    if (
      typeof parsed.data.enableObserverLinks === 'boolean' &&
      parsed.data.enableObserverLinks !== account.client.enableObserverLinks
    ) {
      clientUpdates.enableObserverLinks = parsed.data.enableObserverLinks;
    }

    const operations: Promise<unknown>[] = [];

    if (Object.keys(accountUpdates).length) {
      operations.push(
        prisma.account.update({
          where: { id: params.id },
          data: accountUpdates,
        }),
      );
    }

    if (Object.keys(clientUpdates).length) {
      operations.push(
        prisma.client.update({
          where: { id: account.client.id },
          data: clientUpdates,
        }),
      );
    }

    if (operations.length) {
      await prisma.$transaction(operations);
    }

    const summary = await getAccountUsageSummary(params.id);
    return NextResponse.json({ profile: summary });
  } catch (error) {
    console.error('Update account error:', error);
    return NextResponse.json({ error: 'تعذر تحديث بيانات الحساب' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSuperAdmin();
    const account = await prisma.account.findUnique({
      where: { id: params.id },
      include: { client: true },
    });

    if (!account || !account.client) {
      return NextResponse.json({ error: 'الحساب غير موجود' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const parsed = deleteAccountSchema.safeParse(body || {});

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    if (parsed.data.mode === 'ARCHIVE') {
      const archiveOperations = [
        prisma.account.update({
          where: { id: params.id },
          data: { status: AccountStatus.SUSPENDED },
        }),
        prisma.room.updateMany({
          where: { clientId: account.client.id },
          data: { isActive: false },
        }),
      ];

      if (parsed.data.reason) {
        archiveOperations.push(
          prisma.accountNote.create({
            data: {
              accountId: params.id,
              authorId: session.userId,
              content: `تم أرشفة الحساب: ${parsed.data.reason}`,
              tags: ['archived'],
            },
          }),
        );
      }

      await prisma.$transaction(archiveOperations);

      return NextResponse.json({ message: 'تمت أرشفة الحساب وتعطيل الغرف' });
    }

    await prisma.$transaction(async (tx) => {
      await tx.client.delete({
        where: { id: account.client!.id },
      });
      await tx.account.delete({
        where: { id: params.id },
      });
    });

    return NextResponse.json({ message: 'تم حذف الحساب وجميع بياناته' });
  } catch (error) {
    console.error('Delete account error:', error);
    return NextResponse.json({ error: 'تعذر معالجة طلب الحذف' }, { status: 500 });
  }
}

