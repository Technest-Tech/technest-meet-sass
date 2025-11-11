import { NextRequest, NextResponse } from 'next/server';
import { requireSuperAdmin } from '@/lib/auth/server-auth';
import { prisma } from '@/lib/database';
import { hashPassword } from '@/lib/auth/server-auth';
import { z } from 'zod';

const createAccountSchema = z.object({
  email: z.string().email('البريد الإلكتروني غير صحيح'),
  password: z.string().min(6, 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'),
  role: z.enum(['CLIENT'], {
    errorMap: () => ({ message: 'نوع الحساب غير صحيح' }),
  }),
  clientName: z.string().min(1, 'اسم العميل مطلوب').optional(),
});

// GET - List all accounts
export async function GET(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const accounts = await prisma.account.findMany({
      include: {
        client: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({ accounts });
  } catch (error) {
    console.error('Get accounts error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء جلب الحسابات' },
      { status: 500 }
    );
  }
}

// POST - Create new account
export async function POST(request: NextRequest) {
  try {
    await requireSuperAdmin();

    const body = await request.json();
    const validated = createAccountSchema.safeParse(body);

    if (!validated.success) {
      return NextResponse.json(
        { error: validated.error.errors[0].message },
        { status: 400 }
      );
    }

    const { email, password, role, clientName } = validated.data;

    // Check if account already exists
    const existingAccount = await prisma.account.findUnique({
      where: { email },
    });

    if (existingAccount) {
      return NextResponse.json(
        { error: 'البريد الإلكتروني مستخدم بالفعل' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hashPassword(password);

    if (role === 'CLIENT') {
      // Create client account with client record
      if (!clientName) {
        return NextResponse.json(
          { error: 'اسم العميل مطلوب لإنشاء حساب عميل' },
          { status: 400 }
        );
      }

      // Create account first
      const account = await prisma.account.create({
        data: {
          email,
          password: hashedPassword,
          role: 'CLIENT',
          status: 'ACTIVE',
        },
      });

      // Create client record
      const client = await prisma.client.create({
        data: {
          name: clientName,
          email,
          accountId: account.id,
          maxRooms: 10,
          maxParticipants: 50,
        },
      });

      // Update account with clientId
      await prisma.account.update({
        where: { id: account.id },
        data: { clientId: client.id },
      });

      return NextResponse.json({
        account: {
          ...account,
          client,
        },
      }, { status: 201 });
    }

    return NextResponse.json(
      { error: 'نوع الحساب غير مدعوم' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Create account error:', error);
    return NextResponse.json(
      { error: 'حدث خطأ أثناء إنشاء الحساب' },
      { status: 500 }
    );
  }
}

