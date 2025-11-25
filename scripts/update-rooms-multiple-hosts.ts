import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function updateRoomsAllowMultipleHosts() {
  try {
    console.log('🔄 Starting room update: Setting allowMultipleHosts to true for all rooms...');
    
    // First, count how many rooms exist
    const totalRooms = await prisma.room.count();
    console.log(`📊 Total rooms found: ${totalRooms}`);
    
    if (totalRooms === 0) {
      console.log('ℹ️  No rooms to update.');
      return;
    }
    
    // Count rooms that currently have allowMultipleHosts = false
    const roomsToUpdate = await prisma.room.count({
      where: {
        allowMultipleHosts: false,
      },
    });
    
    console.log(`📝 Rooms that need updating: ${roomsToUpdate}`);
    
    // Update all rooms to allow multiple hosts
    const result = await prisma.room.updateMany({
      where: {
        allowMultipleHosts: false, // Only update rooms that are currently false
      },
      data: {
        allowMultipleHosts: true,
      },
    });
    
    console.log(`✅ Successfully updated ${result.count} rooms`);
    
    // Verify the update
    const updatedCount = await prisma.room.count({
      where: {
        allowMultipleHosts: true,
      },
    });
    
    console.log(`✅ Verification: ${updatedCount} rooms now have allowMultipleHosts = true`);
    console.log('🎉 Update completed successfully!');
    
  } catch (error) {
    console.error('❌ Error updating rooms:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
updateRoomsAllowMultipleHosts()
  .then(() => {
    console.log('✅ Migration completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  });

