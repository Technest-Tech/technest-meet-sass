#!/usr/bin/env node

/**
 * Local Database Initialization Script
 * This script initializes the local development database with sample data
 */

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'file:./dev-local.db'
    }
  }
});

async function main() {
  console.log('🚀 Initializing local development database...');

  try {
    // Create admin user for local development
    const hashedPassword = await bcrypt.hash('admin123', 10);
    
    const adminUser = await prisma.user.upsert({
      where: { email: 'admin@local.dev' },
      update: {},
      create: {
        email: 'admin@local.dev',
        password: hashedPassword,
        role: 'ADMIN',
      },
    });

    console.log('✅ Admin user created:', adminUser.email);

    // Create sample rooms for local development
    const sampleRooms = [
      {
        name: 'Local Development Room 1',
        description: 'Test room for local development',
        hostApproval: false,
        maxParticipants: 10,
        hostLink: 'local-dev-room-1-host',
        guestLink: 'local-dev-room-1-guest',
      },
      {
        name: 'Local Development Room 2',
        description: 'Another test room for local development',
        hostApproval: true,
        maxParticipants: 5,
        hostLink: 'local-dev-room-2-host',
        guestLink: 'local-dev-room-2-guest',
      },
    ];

    for (const roomData of sampleRooms) {
      const room = await prisma.room.upsert({
        where: { hostLink: roomData.hostLink },
        update: {},
        create: roomData,
      });
      console.log('✅ Sample room created:', room.name);
    }

    console.log('🎉 Local development database initialized successfully!');
    console.log('📝 Admin credentials:');
    console.log('   Email: admin@local.dev');
    console.log('   Password: admin123');
    console.log('🔗 Sample room links:');
    console.log('   Room 1 - Host: local-dev-room-1-host');
    console.log('   Room 1 - Guest: local-dev-room-1-guest');
    console.log('   Room 2 - Host: local-dev-room-2-host');
    console.log('   Room 2 - Guest: local-dev-room-2-guest');

  } catch (error) {
    console.error('❌ Error initializing database:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
