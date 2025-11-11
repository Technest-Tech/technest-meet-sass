import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth/server-auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    
    if (!session) {
      return NextResponse.json(
        { error: 'غير مصرح' },
        { status: 401 }
      );
    }

    return NextResponse.json({
      email: session.email,
      role: session.role,
      clientId: session.clientId,
    });
  } catch (error) {
    console.error('Get user error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ' },
      { status: 500 }
    );
  }
}

