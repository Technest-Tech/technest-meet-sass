import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/database';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { z } from 'zod';

const updateNoteSchema = z.object({
  content: z.string().min(3).optional(),
  tags: z.array(z.string()).max(10).optional(),
  isPinned: z.boolean().optional(),
});

export async function PATCH(request: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  try {
    await requireSuperAdmin();
    const body = await request.json();
    const parsed = updateNoteSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.errors[0].message }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    if (parsed.data.content) updates.content = parsed.data.content;
    if (parsed.data.tags) updates.tags = parsed.data.tags;
    if (typeof parsed.data.isPinned === 'boolean') updates.isPinned = parsed.data.isPinned;

    if (!Object.keys(updates).length) {
      return NextResponse.json({ error: 'لا توجد تغييرات لتطبيقها' }, { status: 400 });
    }

    const existing = await prisma.accountNote.findFirst({
      where: { id: params.noteId, accountId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'الملاحظة غير موجودة' }, { status: 404 });
    }

    const note = await prisma.accountNote.update({
      where: { id: params.noteId },
      data: updates,
      include: {
        author: {
          select: { id: true, email: true },
        },
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Update account note error:', error);
    return NextResponse.json({ error: 'تعذر تحديث الملاحظة' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string; noteId: string } }) {
  try {
    await requireSuperAdmin();
    const existing = await prisma.accountNote.findFirst({
      where: { id: params.noteId, accountId: params.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'الملاحظة غير موجودة' }, { status: 404 });
    }

    await prisma.accountNote.delete({
      where: { id: params.noteId },
    });

    return NextResponse.json({ message: 'تم حذف الملاحظة' });
  } catch (error) {
    console.error('Delete account note error:', error);
    return NextResponse.json({ error: 'تعذر حذف الملاحظة' }, { status: 500 });
  }
}

