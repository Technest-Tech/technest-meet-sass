import { NextRequest, NextResponse } from 'next/server';
import { requireClient } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { sanitizeRoomIdentifier, sanitizeStringLenient } from '@/lib/utils/sanitize';

export async function POST(request: NextRequest) {
  try {
    const session = await requireClient();

    if (!session.clientId) {
      return NextResponse.json(
        { error: 'معرف العميل غير موجود' },
        { status: 400 }
      );
    }

    const body = await request.json();
    let { roomName, customRoomLink } = body;
    
    // Sanitize inputs
    if (roomName) {
      roomName = sanitizeStringLenient(roomName);
    }
    if (customRoomLink) {
      customRoomLink = sanitizeRoomIdentifier(customRoomLink);
    }

    // Check if customRoomLink is provided (for almajd account)
    if (customRoomLink && typeof customRoomLink === 'string' && customRoomLink.trim().length > 0) {
      const isAlmajdAccount = session.email === 'almajd@admin.com';
      
      if (!isAlmajdAccount) {
        return NextResponse.json(
          { available: false, error: 'رابط الغرفة المخصص غير متاح لهذا الحساب' },
          { status: 403 }
        );
      }

      // Validate format (alphanumeric only, 1-50 characters)
      const linkRegex = /^[a-zA-Z0-9]{1,50}$/;
      if (!linkRegex.test(customRoomLink.trim())) {
        return NextResponse.json(
          { available: false, error: 'يجب أن يحتوي رابط الغرفة على أحرف وأرقام فقط (1-50 حرف)' },
          { status: 400 }
        );
      }

      // Check if link is already used by this client
      const existingRoom = await prisma.room.findFirst({
        where: {
          clientId: session.clientId,
          OR: [
            { hostLink: customRoomLink.trim() },
            { guestLink: customRoomLink.trim() }
          ],
        },
      });

      return NextResponse.json({
        available: !existingRoom,
        roomLink: customRoomLink.trim(),
      });
    }

    // Legacy: Check room name (for backward compatibility)
    if (!roomName || typeof roomName !== 'string' || roomName.trim().length === 0) {
      return NextResponse.json(
        { available: false, error: 'اسم الغرفة مطلوب' },
        { status: 400 }
      );
    }

    // Since room links are now randomly generated (7 characters), we can't check by name
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

