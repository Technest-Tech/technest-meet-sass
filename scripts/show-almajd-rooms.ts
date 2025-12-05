import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔍 Finding rooms for almajd@admin.com...\n');

  const account = await prisma.account.findUnique({
    where: { email: 'almajd@admin.com' },
    include: { client: true },
  });

  if (!account?.client) {
    console.error('❌ Account or client not found');
    process.exit(1);
  }

  console.log(`✅ Found client: ${account.client.name} (ID: ${account.client.id})\n`);

  const rooms = await prisma.room.findMany({
    where: { clientId: account.client.id },
    select: {
      name: true,
      hostLink: true,
      guestLink: true,
      isActive: true,
    },
    orderBy: {
      name: 'asc',
    },
  });

  if (rooms.length === 0) {
    console.log('⚠️  No rooms found for this client.');
    process.exit(0);
  }

  console.log(`📋 Found ${rooms.length} rooms:\n`);
  console.log('Room Links (https://almajdmeet.org/):');
  console.log('='.repeat(80));
  
  rooms.forEach((room) => {
    const hostUrl = `https://almajdmeet.org/${room.hostLink}/h`;
    const guestUrl = `https://almajdmeet.org/${room.guestLink}/g`;
    const status = room.isActive ? '✅ Active' : '❌ Inactive';
    console.log(`Room: ${room.name.padEnd(10)} | ${status}`);
    console.log(`  Host:  ${hostUrl}`);
    console.log(`  Guest: ${guestUrl}`);
    console.log('');
  });

  console.log('='.repeat(80));
  console.log(`\nTotal: ${rooms.length} rooms`);
}

main()
  .catch((e) => {
    console.error('Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

