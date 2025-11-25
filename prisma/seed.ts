import { PrismaClient, AccountRole, AccountStatus, SubscriptionStatus, FeatureType, RewardType, Prisma, ActivityEventType, InvoiceStatus } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

const randomLink = () => crypto.randomBytes(6).toString('hex');

async function main() {
  console.log('🌱 Starting database seed...');

  // Create super admin
  const superAdminEmail = process.env.SUPER_ADMIN_EMAIL || 'admin@almajd.com';
  const superAdminPassword = process.env.SUPER_ADMIN_PASSWORD || 'admin123';

  const existingSuperAdmin = await prisma.superAdmin.findUnique({
    where: { email: superAdminEmail },
  });

  if (!existingSuperAdmin) {
    const hashedPassword = await bcrypt.hash(superAdminPassword, 10);
    
    await prisma.superAdmin.create({
      data: {
        email: superAdminEmail,
        password: hashedPassword,
      },
    });

    console.log('✅ Super admin created:', superAdminEmail);
    console.log('   Password:', superAdminPassword);
  } else {
    console.log('ℹ️  Super admin already exists:', superAdminEmail);
  }

  // Create test client account
  const clientEmail = 'client@test.com';
  const clientPassword = 'client123';
  const clientName = 'Test Client';

  const existingClientAccount = await prisma.account.findUnique({
    where: { email: clientEmail },
  });

  if (!existingClientAccount) {
    // Hash password
    const hashedClientPassword = await bcrypt.hash(clientPassword, 10);

    // Create account
    const account = await prisma.account.create({
      data: {
        email: clientEmail,
        password: hashedClientPassword,
        role: AccountRole.CLIENT,
        status: AccountStatus.ACTIVE,
      },
    });

    // Create client record
    const client = await prisma.client.create({
      data: {
        name: clientName,
        email: clientEmail,
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
  } else {
    console.log('ℹ️  Test client account already exists:', clientEmail);
  }

  // Create 3 plans: Trial, Basic, Premium
  console.log('📦 Creating subscription plans...');

  // 1. Trial Plan - Most features (exclude E2EE, CUSTOM_BRANDING, VIRTUAL_BACKGROUND)
  let trialPlan = await prisma.plan.findFirst({
    where: { name: 'Trial Plan' },
  });

  if (!trialPlan) {
    trialPlan = await prisma.plan.create({
      data: {
        name: 'Trial Plan',
        description: 'Trial plan with most features enabled (3 days)',
        isActive: true,
      },
    });
  } else {
    await prisma.plan.update({
      where: { id: trialPlan.id },
      data: {
        description: 'Trial plan with most features enabled (3 days)',
        isActive: true,
      },
    });
  }

  // Get all features except the premium ones
  const allFeatures = Object.values(FeatureType);
  const trialExcludedFeatures = ['E2EE', 'CUSTOM_BRANDING', 'VIRTUAL_BACKGROUND'] as FeatureType[];
  const trialFeatures = allFeatures.filter(f => !trialExcludedFeatures.includes(f));

  // Delete existing features and recreate
  await prisma.planFeature.deleteMany({
    where: { planId: trialPlan.id },
  });

  await prisma.planFeature.createMany({
    data: trialFeatures.map(feature => ({
      planId: trialPlan.id,
      feature: feature,
      enabled: true,
    })),
  });

  console.log('✅ Trial Plan created with', trialFeatures.length, 'features');

  // 2. Basic Plan - Limited features
  let basicPlan = await prisma.plan.findFirst({
    where: { name: 'Basic Plan' },
  });

  if (!basicPlan) {
    basicPlan = await prisma.plan.create({
      data: {
        name: 'Basic Plan',
        description: 'Basic plan with essential features',
        isActive: true,
      },
    });
  } else {
    await prisma.plan.update({
      where: { id: basicPlan.id },
      data: {
        description: 'Basic plan with essential features',
        isActive: true,
      },
    });
  }

  const basicFeatures: FeatureType[] = [
    'PRIVATE_CHAT',
    'REACTIONS',
    'RAISE_HAND',
    'WAITING_ROOM',
    'GUEST_UNMUTE',
  ];

  await prisma.planFeature.deleteMany({
    where: { planId: basicPlan.id },
  });

  await prisma.planFeature.createMany({
    data: basicFeatures.map(feature => ({
      planId: basicPlan.id,
      feature: feature,
      enabled: true,
    })),
  });

  console.log('✅ Basic Plan created with', basicFeatures.length, 'features');

  // 3. Premium Plan - All features
  let premiumPlan = await prisma.plan.findFirst({
    where: { name: 'Premium Plan' },
  });

  if (!premiumPlan) {
    premiumPlan = await prisma.plan.create({
      data: {
        name: 'Premium Plan',
        description: 'Premium plan with all features enabled',
        isActive: true,
      },
    });
  } else {
    await prisma.plan.update({
      where: { id: premiumPlan.id },
      data: {
        description: 'Premium plan with all features enabled',
        isActive: true,
      },
    });
  }

  await prisma.planFeature.deleteMany({
    where: { planId: premiumPlan.id },
  });

  await prisma.planFeature.createMany({
    data: allFeatures.map(feature => ({
      planId: premiumPlan.id,
      feature: feature,
      enabled: true,
    })),
  });

  console.log('✅ Premium Plan created with', allFeatures.length, 'features');

  // Create subscription for test client if it doesn't exist
  const clientAccountWithClient = await prisma.account.findUnique({
    where: { email: clientEmail },
    include: { client: true },
  });

  if (clientAccountWithClient && clientAccountWithClient.client) {
    const existingSubscription = await prisma.subscription.findUnique({
      where: { clientId: clientAccountWithClient.client.id },
    });

    if (!existingSubscription) {
      const subscriptionStartDate = new Date();
      const subscriptionEndDate = new Date(subscriptionStartDate.getTime() + 30 * 24 * 60 * 60 * 1000);
      await prisma.subscription.create({
        data: {
          clientId: clientAccountWithClient.client.id,
          planId: premiumPlan.id,
          status: SubscriptionStatus.ACTIVE,
          startDate: subscriptionStartDate,
          endDate: subscriptionEndDate,
          amountEGP: 0,
        },
      });

      console.log('✅ Test client subscription created:');
      console.log('   Email:', clientEmail);
      console.log('   Plan: Premium Plan (all features enabled)');
      console.log('   Subscription: ACTIVE');
    }

    const subscription = await prisma.subscription.findUnique({
      where: { clientId: clientAccountWithClient.client.id },
    });

    let demoRoom = await prisma.room.findFirst({
      where: { clientId: clientAccountWithClient.client.id },
    });

    if (!demoRoom) {
      demoRoom = await prisma.room.create({
        data: {
          name: 'Demo Classroom',
          description: 'Seeded room for analytics previews',
          clientId: clientAccountWithClient.client.id,
          hostLink: randomLink(),
          guestLink: randomLink(),
          enableFileSharing: true,
          enablePdfViewer: true,
          isActive: true,
        },
      });
    }

    const existingFiles = await prisma.roomFile.count({
      where: { roomId: demoRoom.id },
    });

    if (existingFiles === 0) {
      await prisma.roomFile.createMany({
        data: [
          {
            roomId: demoRoom.id,
            filename: 'lesson-plan.pdf',
            originalName: 'lesson-plan.pdf',
            fileType: 'application/pdf',
            size: 4_200_000,
            uploadedBy: 'Teacher A',
          },
          {
            roomId: demoRoom.id,
            filename: 'class-recording.mp4',
            originalName: 'class-recording.mp4',
            fileType: 'video/mp4',
            size: 120_000_000,
            uploadedBy: 'Teacher A',
          },
        ],
      });
    }

    const noteExists = await prisma.accountNote.findFirst({
      where: { accountId: clientAccountWithClient.id },
    });

    if (!noteExists) {
      await prisma.accountNote.create({
        data: {
          accountId: clientAccountWithClient.id,
          content: 'Seed note — this tenant is used for demo dashboards.',
          tags: ['demo', 'priority-low'],
        },
      });
    }

    const activityCount = await prisma.roomActivityLog.count({
      where: { roomId: demoRoom.id },
    });

    if (activityCount === 0) {
      await prisma.roomActivityLog.createMany({
        data: [
          {
            clientId: clientAccountWithClient.client.id,
            roomId: demoRoom.id,
            event: ActivityEventType.ROOM_CREATED,
            description: 'Room created via seed script',
          },
          {
            clientId: clientAccountWithClient.client.id,
            roomId: demoRoom.id,
            event: ActivityEventType.FILE_UPLOADED,
            description: 'lesson-plan.pdf uploaded',
            metadata: { filename: 'lesson-plan.pdf', size: 4200000 },
          },
        ],
      });
    }

    const invoiceExists = await prisma.billingInvoice.count({
      where: { clientId: clientAccountWithClient.client.id },
    });

    if (invoiceExists === 0) {
      await prisma.billingInvoice.create({
        data: {
          clientId: clientAccountWithClient.client.id,
          subscriptionId: subscription?.id,
          status: InvoiceStatus.PAID,
          amountCents: 75000,
          currency: 'EGP',
          description: 'Seeded invoice for dashboard previews',
          periodStart: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          periodEnd: new Date(),
          paidAt: new Date(),
        },
      });
    }

    const snapshotExists = await prisma.storageSnapshot.count({
      where: { clientId: clientAccountWithClient.client.id },
    });

    if (snapshotExists === 0) {
      await prisma.storageSnapshot.create({
        data: {
          clientId: clientAccountWithClient.client.id,
          totalBytes: BigInt(124_200_000),
          totalFiles: 2,
          totalRooms: 1,
          activeRooms: 1,
          breakdown: {
            video: 120_000_000,
            documents: 4_200_000,
          },
        },
      });
    }
  }

  // Initialize default subscription sources if none exist
  const defaultSources = [
    { label: 'التسويق الرقمي', description: 'حملات رقمية وإعلانات' },
    { label: 'المبيعات المباشرة', description: 'تواصل مباشر مع العملاء' },
    { label: 'الشراكات', description: 'قنوات الشركاء' },
  ];

  for (const source of defaultSources) {
    await prisma.subscriptionSource.upsert({
      where: { label: source.label },
      update: {
        description: source.description,
        isActive: true,
      },
      create: source,
    });
  }

  // Referral defaults
  const existingReferralSettings = await prisma.referralSetting.findFirst();
  if (!existingReferralSettings) {
    await prisma.referralSetting.create({
      data: {
        registerPoints: 5,
        subscribePoints: 25,
        largePlanPoints: 40,
        largePlanThreshold: 1000,
        minRedeemPoints: 50,
        creditPointValue: 1,
        freeRoomDays: 30,
      },
    });
    console.log('✅ Referral settings initialized');
  } else {
    console.log('ℹ️  Referral settings already configured');
  }

  const defaultRewards: {
    label: string;
    description: string;
    rewardType: RewardType;
    costPoints: number;
    config: Prisma.JsonValue;
  }[] = [
    {
      label: 'Free Room (30 Days)',
      description: 'Unlock an extra room for 30 days',
      rewardType: RewardType.FREE_ROOMS,
      costPoints: 120,
      config: { freeRoomDays: 30 },
    },
    {
      label: '10% Subscription Discount',
      description: 'Apply 10% off the next subscription invoice',
      rewardType: RewardType.DISCOUNT,
      costPoints: 150,
      config: { percentOff: 10 },
    },
    {
      label: '1 Extra Month',
      description: 'Extend current subscription by one month',
      rewardType: RewardType.MONTH_EXTENSION,
      costPoints: 200,
      config: { months: 1 },
    },
    {
      label: '100 EGP Credit',
      description: 'Redeem 100 EGP credit handled manually by admin',
      rewardType: RewardType.CREDIT,
      costPoints: 100,
      config: { creditAmount: 100, currency: 'EGP' },
    },
  ];

  for (const reward of defaultRewards) {
    await prisma.rewardCatalog.upsert({
      where: { label: reward.label },
      update: {
        description: reward.description,
        rewardType: reward.rewardType,
        costPoints: reward.costPoints,
        config: reward.config,
        isActive: true,
      },
      create: reward,
    });
  }
  console.log('✅ Referral reward catalog seeded');

  const clients = await prisma.client.findMany({
    include: { referralLink: true },
  });

  for (const client of clients) {
    if (!client.referralLink) {
      const codeBase = client.name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 6).toUpperCase();
      const suffix = Math.random().toString(36).substring(2, 6).toUpperCase();
      const code = `${codeBase || 'CLIENT'}-${suffix}`;

      await prisma.referralLink.create({
        data: {
          clientId: client.id,
          code,
        },
      });
      console.log(`✅ Referral link created for client ${client.name}`);
    }
  }

  console.log('✅ Database seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

