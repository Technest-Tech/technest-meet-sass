const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🚀 Starting database initialization...');

  try {
    // Create admin user
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'admin@newmeet.com' }
    });

    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash('admin123', 10);
      
      await prisma.user.create({
        data: {
          email: 'admin@newmeet.com',
          password: hashedPassword,
          role: 'ADMIN'
        }
      });
      
      console.log('✅ Admin user created successfully');
      console.log('   Email: admin@newmeet.com');
      console.log('   Password: admin123');
    } else {
      console.log('ℹ️  Admin user already exists');
    }

    // Create a sample room
    const existingRoom = await prisma.room.findFirst({
      where: { name: 'Sample Meeting Room' }
    });

    if (!existingRoom) {
      const room = await prisma.room.create({
        data: {
          name: 'Sample Meeting Room',
          description: 'A sample room to get you started',
          hostApproval: false,
          maxParticipants: 25,
          isActive: true,
          hostLink: 'sample-host',
          guestLink: 'sample-guest'
        }
      });

      // Create initial participants
      await prisma.participant.createMany({
        data: [
          {
            name: 'Teacher1',
            type: 'HOST',
            roomId: room.id
          },
          {
            name: 'Student1',
            type: 'GUEST',
            roomId: room.id
          }
        ]
      });

      console.log('✅ Sample room created successfully');
      console.log(`   Room ID: ${room.id}`);
      console.log(`   Host Link: /room/${room.hostLink}?type=host`);
      console.log(`   Guest Link: /room/${room.guestLink}?type=guest`);
    } else {
      console.log('ℹ️  Sample room already exists');
    }

    console.log('\n🎉 Database initialization completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Start your development server: npm run dev');
    console.log('2. Access admin panel: http://localhost:3000/admin/login');
    console.log('3. Login with admin@newmeet.com / admin123');
    console.log('4. Create and manage your rooms!');

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
