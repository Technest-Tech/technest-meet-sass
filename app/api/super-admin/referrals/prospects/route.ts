import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { ProspectStatus } from '@prisma/client';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import {
  listProspects,
  updateProspectStatus,
  approveProspect,
  rejectProspect,
} from '@/lib/services/referrals';

const updateSchema = z.object({
  prospectId: z.string().min(1),
  status: z.nativeEnum(ProspectStatus).optional(),
  assignedAdminId: z.string().optional(),
  notes: z.string().optional(),
  action: z.enum(['APPROVE', 'REJECT']).optional(),
  points: z.number().int().min(0).optional(),
});

export async function GET() {
  try {
    await requireSuperAdmin();
    const prospects = await listProspects();
    return NextResponse.json({ prospects });
  } catch (error) {
    console.error('List prospects error', error);
    return NextResponse.json(
      { error: 'Unable to fetch prospects' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await requireSuperAdmin();
    const body = await request.json();
    const parsed = updateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: parsed.error.errors[0]?.message || 'Invalid payload' },
        { status: 400 },
      );
    }

    if (parsed.data.action === 'APPROVE') {
      const prospect = await approveProspect(
        parsed.data.prospectId,
        session.userId,
        parsed.data.points,
      );
      return NextResponse.json({ prospect });
    }

    if (parsed.data.action === 'REJECT') {
      const prospect = await rejectProspect(
        parsed.data.prospectId,
        session.userId,
        parsed.data.notes,
      );
      return NextResponse.json({ prospect });
    }

    if (!parsed.data.status) {
      return NextResponse.json(
        { error: 'Status is required when no action is provided' },
        { status: 400 },
      );
    }

    const prospect = await updateProspectStatus({
      prospectId: parsed.data.prospectId,
      status: parsed.data.status,
      assignedAdminId: parsed.data.assignedAdminId,
      notes: parsed.data.notes,
    });
    return NextResponse.json({ prospect });
  } catch (error) {
    console.error('Update prospect error', error);
    return NextResponse.json(
      { error: 'Unable to update prospect' },
      { status: 500 },
    );
  }
}

