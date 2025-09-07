#!/bin/bash

echo "🗄️ Initializing NewMeet database..."

# Ensure data directory exists
mkdir -p data
chmod 755 data

# Check if backend container is running
if ! docker-compose -f docker-compose.prod.yml ps newmeet-backend | grep -q "Up"; then
    echo "❌ Backend container is not running. Starting services first..."
    docker-compose -f docker-compose.prod.yml up -d newmeet-backend
    sleep 10
fi

# Initialize database
echo "Creating database schema..."
# Run as root to ensure proper permissions
docker-compose -f docker-compose.prod.yml exec -T --user root newmeet-backend sh -c "
  mkdir -p /app/data
  chmod 777 /app/data
  chown -R nextjs:nodejs /app/data
  su nextjs -c 'npm run db:push'
"

# Create admin user
echo "Creating admin user..."
docker-compose -f docker-compose.prod.yml exec -T --user root newmeet-backend sh -c "
  chmod 777 /app/data
  chown -R nextjs:nodejs /app/data
  su nextjs -c 'node -e \"
const bcrypt = require('bcryptjs');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.user.upsert({
      where: { email: 'admin@newmeet.com' },
      update: {},
      create: {
        email: 'admin@newmeet.com',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log('✅ Admin user created:', admin.email);
  } catch (error) {
    console.error('❌ Error creating admin user:', error);
  } finally {
    await prisma.\$disconnect();
  }
}

createAdmin();
\"'
"

echo "✅ Database initialization completed!"
echo "Admin login: admin@newmeet.com / admin123"
