import { PrismaClient, AccountRole, AccountStatus, SubscriptionStatus, FeatureType } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

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
      await prisma.subscription.create({
        data: {
          clientId: clientAccountWithClient.client.id,
          planId: premiumPlan.id,
          status: SubscriptionStatus.ACTIVE,
        },
      });

      console.log('✅ Test client subscription created:');
      console.log('   Email:', clientEmail);
      console.log('   Plan: Premium Plan (all features enabled)');
      console.log('   Subscription: ACTIVE');
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

