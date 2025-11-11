import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import { randomBytes } from 'crypto';

const updateLimitsSchema = z.object({
  maxRooms: z.number().int().min(1).optional(),
  maxParticipants: z.number().int().min(1).optional(),
  enableObserverLinks: z.boolean().optional(),
});

async function generateUniqueObserverLink(): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const candidate =
      'o' +
      randomBytes(3)
        .toString('base64')
        .replace(/[^a-zA-Z0-9]/g, '')
        .substring(0, 4);

    const existing = await prisma.room.findFirst({
      where: { observerLink: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Failed to generate unique observer link after multiple attempts');
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireSuperAdmin();

    const { id } = await params;
    const body = await request.json();
    const validated = updateLimitsSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const client = await prisma.client.update({
      where: { id },
      data: validated.data,
      include: {
        account: true,
        subscription: {
          include: {
            plan: {
              include: {
                features: true,
              },
            },
          },
        },
      },
    });

    if (Object.prototype.hasOwnProperty.call(validated.data, 'enableObserverLinks')) {
      const enableObserverLinks = validated.data.enableObserverLinks ?? false;

      if (!enableObserverLinks) {
        // Disable observer links for all client rooms
        await prisma.room.updateMany({
          where: { clientId: id },
          data: { observerLink: null },
        });
      } else {
        // Generate observer links for rooms that don't have one
        const roomsWithoutLink = await prisma.room.findMany({
          where: {
            clientId: id,
            OR: [{ observerLink: null }, { observerLink: '' }],
          },
          select: { id: true },
        });

        for (const room of roomsWithoutLink) {
          const observerLink = await generateUniqueObserverLink();
          await prisma.room.update({
            where: { id: room.id },
            data: { observerLink },
          });
        }
      }
    }

    return NextResponse.json({ client });
  } catch (error: any) {
    console.error('Update limits error:', error);

    if (error?.code === 'P2025') {
      return NextResponse.json(
        { error: 'العميل غير موجود' },
        { status: 404 }
      );
    }

    return NextResponse.json(
      { error: error?.message || 'حدث خطأ أثناء تحديث الحدود' },
      { status: 500 }
    );
  }
}

