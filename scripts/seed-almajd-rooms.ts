import { PrismaClient } from '@prisma/client';
import { prisma, getNextParticipantName } from '../lib/database';

async function main() {
  console.log('🌱 Starting Almajd rooms seed...');

  // Find account with email almajd@admin.com
  const account = await prisma.account.findUnique({
    where: { email: 'almajd@admin.com' },
    include: { client: true },
  });

  if (!account) {
    console.error('❌ Account with email almajd@admin.com not found');
    process.exit(1);
  }

  if (!account.client) {
    console.error('❌ Client not found for account almajd@admin.com');
    process.exit(1);
  }

  const client = account.client;
  console.log(`✅ Found client: ${client.name} (ID: ${client.id})`);

  // Delete all existing rooms for this client
  const existingRooms = await prisma.room.findMany({
    where: { clientId: client.id },
    select: { id: true },
  });

  if (existingRooms.length > 0) {
    console.log(`🗑️  Deleting ${existingRooms.length} existing rooms...`);
    
    // Delete participants first (foreign key constraint)
    for (const room of existingRooms) {
      await prisma.participant.deleteMany({
        where: { roomId: room.id },
      });
    }

    // Delete rooms
    await prisma.room.deleteMany({
      where: { clientId: client.id },
    });

    console.log(`✅ Deleted ${existingRooms.length} existing rooms`);
  }

  // Create 116 rooms with names "1" through "116"
  console.log('📦 Creating 116 rooms...');
  const rooms = [];

  for (let i = 1; i <= 116; i++) {
    const roomName = i.toString();
    const roomLink = roomName; // Use the same name as the link

    try {
      const room = await prisma.room.create({
        data: {
          name: roomName,
          description: `Room ${roomName}`,
          clientId: client.id,
          hostLink: roomLink,
          guestLink: roomLink,
          maxParticipants: client.maxParticipants,
          isActive: true,
          canRecord: false,
          requireWaitingRoom: false,
          allowGuestUnmute: true,
          enablePrivateChat: true,
        },
      });

      // Create initial host participant
      const hostName = await getNextParticipantName(room.id, 'HOST');
      await prisma.participant.create({
        data: {
          name: hostName,
          type: 'HOST',
          roomId: room.id,
        },
      });

      // Create initial guest participant
      const guestName = await getNextParticipantName(room.id, 'GUEST');
      await prisma.participant.create({
        data: {
          name: guestName,
          type: 'GUEST',
          roomId: room.id,
        },
      });

      rooms.push(room);
      
      if (i % 20 === 0) {
        console.log(`   Created ${i}/116 rooms...`);
      }
    } catch (error) {
      console.error(`❌ Failed to create room ${roomName}:`, error);
      throw error;
    }
  }

  console.log(`✅ Successfully created ${rooms.length} rooms`);
  console.log(`📋 Room links: almajdmeet.org/1/h through almajdmeet.org/116/h`);
  console.log('✅ Almajd rooms seed completed!');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

