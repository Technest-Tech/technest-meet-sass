import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { z } from 'zod';

const noteSchema = z.object({
  content: z.string().min(3),
  tags: z.array(z.string()).max(10).optional(),
  isPinned: z.boolean().optional(),
});

export async function GET(_request: NextRequest, { params }: { params: { id: string } }) {
  try {
    await requireSuperAdmin();
    const notes = await prisma.accountNote.findMany({
      where: { accountId: params.id },
      include: {
        author: {
          select: { id: true, email: true },
        },
      },
      orderBy: [{ isPinned: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Get account notes error:', error);
    return NextResponse.json({ error: 'تعذر تحميل الملاحظات' }, { status: 500 });
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await requireSuperAdmin();
    const body = await request.json();
    const parsed = noteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const note = await prisma.accountNote.create({
      data: {
        accountId: params.id,
        authorId: session.userId,
        content: parsed.data.content,
        tags: parsed.data.tags || [],
        isPinned: parsed.data.isPinned ?? false,
      },
      include: {
        author: {
          select: { id: true, email: true },
        },
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Create account note error:', error);
    return NextResponse.json({ error: 'تعذر إنشاء الملاحظة' }, { status: 500 });
  }
}

