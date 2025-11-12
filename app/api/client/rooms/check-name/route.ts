import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';

export async function POST(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const { roomName } = await request.json();

    if (!roomName || typeof roomName !== 'string' || roomName.trim().length === 0) {
      return NextResponse.json(
        { available: false, error: 'اسم الغرفة مطلوب' },
        { status: 400 }
      );
    }

    // Since room links are now randomly generated (7 words), we can't check by name
    // Just validate that the name is provided and return available
    // The actual link will be generated during room creation
    return NextResponse.json({
      available: true,
      roomLink: null, // Link will be generated during creation
    });
  } catch (error) {
    console.error('Check room name error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء التحقق من اسم الغرفة' },
      { status: 500 }
    );
  }
}

