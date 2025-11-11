import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';

// GET - Get single room
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const { id } = await params;

    const room = await prisma.room.findFirst({
      where: {
        id,
        clientId: session.clientId,
      },
      include: {
        _count: {
          select: {
            participants: true,
            files: true,
          },
        },
      },
    });

    if (!room) {
      return NextResponse.json(
        { error: 'الغرفة غير موجودة' },
        { status: 404 }
      );
    }

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Get room error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الغرفة' },
      { status: 500 }
    );
  }
}

// PUT - Update room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const { id } = await params;
    const body = await request.json();

    // Verify room ownership
    const existingRoom = await prisma.room.findFirst({
      where: {
        id,
        clientId: session.clientId,
      },
    });

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'الغرفة غير موجودة أو غير مملوكة لك' },
        { status: 404 }
      );
    }

    // Fetch client's subscription and plan features
    const client = await prisma.client.findUnique({
      where: { id: session.clientId },
      include: {
        subscription: {
          include: {
            plan: {
              include: { features: true }
            }
          }
        }
      }
    });

    const enabledFeatures = client?.subscription?.plan?.features
      .filter(f => f.enabled)
      .map(f => f.feature) || [];

    // Enforce feature restrictions
    const room = await prisma.room.update({
      where: { id },
      data: {
        name: body.name,
        description: body.description,
        hostApproval: body.hostApproval,
        maxParticipants: body.maxParticipants,
        isActive: body.isActive,
        canRecord: enabledFeatures.includes('RECORDING') && body.canRecord,
        requireWaitingRoom: enabledFeatures.includes('WAITING_ROOM') && body.requireWaitingRoom,
        allowGuestUnmute: enabledFeatures.includes('GUEST_UNMUTE') && body.allowGuestUnmute,
        enablePrivateChat: enabledFeatures.includes('PRIVATE_CHAT') && body.enablePrivateChat,
        enableCollaborativeWhiteboard: enabledFeatures.includes('COLLABORATIVE_WHITEBOARD') && body.enableCollaborativeWhiteboard,
        enableNormalWhiteboard: enabledFeatures.includes('NORMAL_WHITEBOARD') && body.enableNormalWhiteboard,
        enableManageParticipants: enabledFeatures.includes('MANAGE_PARTICIPANTS') && body.enableManageParticipants,
        enableVirtualBackground: enabledFeatures.includes('VIRTUAL_BACKGROUND') && body.enableVirtualBackground,
      },
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Update room error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء تحديث الغرفة' },
      { status: 500 }
    );
  }
}

// DELETE - Delete room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const { id } = await params;

    // Verify room ownership
    const existingRoom = await prisma.room.findFirst({
      where: {
        id,
        clientId: session.clientId,
      },
    });

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'الغرفة غير موجودة أو غير مملوكة لك' },
        { status: 404 }
      );
    }

    await prisma.room.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Delete room error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء حذف الغرفة' },
      { status: 500 }
    );
  }
}

