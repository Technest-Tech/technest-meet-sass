import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, getAuthTokenFromRequest } from '@/lib/auth';
import { prisma } from '@/lib/database';

// PUT - Update a room
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { roomId } = await params;
    const { name, description, hostApproval, maxParticipants, isActive, canRecord } = await request.json();

    if (!name) {
      return NextResponse.json(
        { error: 'Room name is required' },
        { status: 400 }
      );
    }

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Update the room
    const updatedRoom = await prisma.room.update({
      where: { id: roomId },
      data: {
        name,
        description,
        hostApproval: hostApproval !== undefined ? hostApproval : existingRoom.hostApproval,
        maxParticipants: maxParticipants || existingRoom.maxParticipants,
        isActive: isActive !== undefined ? isActive : existingRoom.isActive,
        canRecord: canRecord !== undefined ? canRecord : existingRoom.canRecord
      },
      include: {
        participants: true
      }
    });

    return NextResponse.json(updatedRoom);

  } catch (error) {
    console.error('Failed to update room:', error);
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
    
    // Check if it's a Prisma error
    if (error && typeof error === 'object' && 'code' in error) {
      console.error('Prisma error code:', (error as any).code);
      console.error('Prisma error meta:', (error as any).meta);
    }
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// DELETE - Delete a room
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ roomId: string }> }
) {
  try {
    const token = getAuthTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }

    const { roomId } = await params;

    // Check if room exists
    const existingRoom = await prisma.room.findUnique({
      where: { id: roomId }
    });

    if (!existingRoom) {
      return NextResponse.json(
        { error: 'Room not found' },
        { status: 404 }
      );
    }

    // Delete the room (participants will be deleted due to cascade)
    await prisma.room.delete({
      where: { id: roomId }
    });

    return NextResponse.json({ message: 'Room deleted successfully' });

  } catch (error) {
    console.error('Failed to delete room:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
