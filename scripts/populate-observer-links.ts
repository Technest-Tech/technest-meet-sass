/**
 * Script to populate observer links for existing rooms
 * Run with: npx tsx scripts/populate-observer-links.ts
 */

import { PrismaClient } from '@prisma/client';
import { randomBytes } from 'crypto';

const prisma = new PrismaClient();

async function generateObserverLink(): Promise<string> {
  const maxAttempts = 10;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const randomString = randomBytes(3)
      .toString('base64')
      .replace(/[^a-zA-Z0-9]/g, '')
      .substring(0, 4);
    const candidate = `o${randomString}`;

    const existing = await prisma.room.findFirst({
      where: { observerLink: candidate },
      select: { id: true },
    });

    if (!existing) {
      return candidate;
    }
  }

  throw new Error('Failed to generate unique observer link');
}

async function populateObserverLinks() {
  try {
    console.log('🔍 Finding rooms without observer links...');
    
    // Find all rooms that don't have an observer link
    const roomsWithoutObserverLink = await prisma.room.findMany({
      where: {
        observerLink: null,
      },
    });
    
    console.log(`📋 Found ${roomsWithoutObserverLink.length} rooms without observer links`);
    
    if (roomsWithoutObserverLink.length === 0) {
      console.log('✅ All rooms already have observer links!');
      return;
    }
    
    // Update each room with a unique observer link
    let updated = 0;
    for (const room of roomsWithoutObserverLink) {
      const observerLink = await generateObserverLink();
      
      await prisma.room.update({
        where: { id: room.id },
        data: { observerLink },
      });
      
      updated++;
      console.log(`✓ Updated room "${room.name}" (${updated}/${roomsWithoutObserverLink.length})`);
    }
    
    console.log(`\n✅ Successfully populated observer links for ${updated} rooms!`);
    
  } catch (error) {
    console.error('❌ Error populating observer links:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
populateObserverLinks()
  .then(() => {
    console.log('🎉 Script completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Script failed:', error);
    process.exit(1);
  });


