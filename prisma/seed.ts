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
        maxHosts: 50,
        maxGuests: 500,
      },
    });

    // Update account with clientId
    await prisma.account.update({
      where: { id: account.id },
      data: { clientId: client.id },
    });

    // Create a plan with all features
    const plan = await prisma.plan.create({
      data: {
        name: 'Premium Plan',
        description: 'Premium plan with all features enabled',
        isActive: true,
      },
    });

    // Add all features to the plan
    const allFeatures = Object.values(FeatureType);
    await prisma.planFeature.createMany({
      data: allFeatures.map(feature => ({
        planId: plan.id,
        feature: feature,
        enabled: true,
      })),
    });

    // Create subscription for the client
    await prisma.subscription.create({
      data: {
        clientId: client.id,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    console.log('✅ Test client account created:');
    console.log('   Email:', clientEmail);
    console.log('   Password:', clientPassword);
    console.log('   Client Name:', clientName);
    console.log('   Plan: Premium Plan (all features enabled)');
    console.log('   Subscription: ACTIVE');
  } else {
    console.log('ℹ️  Test client account already exists:', clientEmail);
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

