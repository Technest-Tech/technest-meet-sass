import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

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

    // Handle password update
    let hashedPassword: string | null | undefined = undefined;
    if (body.passwordRequired !== undefined) {
      if (body.passwordRequired && body.password) {
        // Hash new password
        hashedPassword = await bcrypt.hash(body.password, 10);
      } else if (!body.passwordRequired) {
        // Remove password if password is disabled
        hashedPassword = null;
      } else if (body.passwordRequired && !body.password) {
        // Keep existing password if passwordRequired is true but no new password provided
        hashedPassword = existingRoom.password;
      }
    }

    // Enforce feature restrictions
    const updateData: any = {
      name: body.name,
      description: body.description !== undefined ? body.description : existingRoom.description,
      hostApproval: body.hostApproval !== undefined ? body.hostApproval : existingRoom.hostApproval,
      allowMultipleHosts: body.allowMultipleHosts !== undefined ? body.allowMultipleHosts : (existingRoom.allowMultipleHosts ?? false),
      maxParticipants: body.maxParticipants !== undefined ? body.maxParticipants : existingRoom.maxParticipants,
      isActive: body.isActive !== undefined ? body.isActive : existingRoom.isActive,
      canRecord: body.canRecord !== undefined ? (enabledFeatures.includes('RECORDING') && body.canRecord) : existingRoom.canRecord,
      requireWaitingRoom: body.requireWaitingRoom !== undefined ? (enabledFeatures.includes('WAITING_ROOM') && body.requireWaitingRoom) : existingRoom.requireWaitingRoom,
      allowGuestUnmute: body.allowGuestUnmute !== undefined ? (enabledFeatures.includes('GUEST_UNMUTE') && body.allowGuestUnmute) : existingRoom.allowGuestUnmute,
      enablePrivateChat: body.enablePrivateChat !== undefined ? (enabledFeatures.includes('PRIVATE_CHAT') && body.enablePrivateChat) : existingRoom.enablePrivateChat,
    };

    // Only update feature flags if they're provided in the body
    if (body.enableCollaborativeWhiteboard !== undefined) {
      updateData.enableCollaborativeWhiteboard = enabledFeatures.includes('COLLABORATIVE_WHITEBOARD') && body.enableCollaborativeWhiteboard;
    }
    if (body.enableNormalWhiteboard !== undefined) {
      updateData.enableNormalWhiteboard = enabledFeatures.includes('NORMAL_WHITEBOARD') && body.enableNormalWhiteboard;
    }
    if (body.enableManageParticipants !== undefined) {
      updateData.enableManageParticipants = enabledFeatures.includes('MANAGE_PARTICIPANTS') && body.enableManageParticipants;
    }
    if (body.enableVirtualBackground !== undefined) {
      updateData.enableVirtualBackground = enabledFeatures.includes('VIRTUAL_BACKGROUND') && body.enableVirtualBackground;
    }
    if (body.enableNoiseCancellation !== undefined) {
      updateData.enableNoiseCancellation = enabledFeatures.includes('NOISE_CANCELLATION') && body.enableNoiseCancellation;
    }

    // Add password fields if provided
    if (body.passwordRequired !== undefined) {
      updateData.passwordRequired = body.passwordRequired;
      if (hashedPassword !== undefined) {
        updateData.password = hashedPassword;
      }
      
      // Handle passwordFor - only set if passwordRequired is true and value is valid
      if (body.passwordRequired && body.passwordFor && (body.passwordFor === 'HOST_ONLY' || body.passwordFor === 'HOST_AND_GUEST')) {
        updateData.passwordFor = body.passwordFor;
      } else {
        updateData.passwordFor = null;
      }
    } else if (body.passwordFor !== undefined) {
      // If only passwordFor is provided without passwordRequired, handle it
      if (body.passwordFor && (body.passwordFor === 'HOST_ONLY' || body.passwordFor === 'HOST_AND_GUEST')) {
        updateData.passwordFor = body.passwordFor;
      } else {
        updateData.passwordFor = null;
      }
    }

    const room = await prisma.room.update({
      where: { id },
      data: updateData,
      include: {
        _count: {
          select: {
            participants: true,
            files: true,
          },
        },
      },
    });

    return NextResponse.json({ room });
  } catch (error) {
    console.error('Update room error:', error);
    // Log more details for debugging
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    return NextResponse.json(
      { 
        error: 'حدث خطأ أثناء تحديث الغرفة',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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

