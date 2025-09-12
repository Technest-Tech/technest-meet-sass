#!/bin/bash

echo "🗄️ Simple database initialization..."

# Stop the current backend container
echo "Stopping backend container..."
docker-compose -f docker-compose.prod.yml stop newmeet-backend

# Run database initialization as root
echo "Running database initialization as root..."
docker-compose -f docker-compose.prod.yml run --rm --user root newmeet-backend sh -c "
  mkdir -p /app/data
  chmod 777 /app/data
  chown -R nextjs:nodejs /app/data
  su nextjs -c 'npm run db:push'
"

# Create admin user
echo "Creating admin user..."
docker-compose -f docker-compose.prod.yml run --rm --user root newmeet-backend sh -c "
  chmod 777 /app/data
  chown -R nextjs:nodejs /app/data
  su nextjs -c 'node -e \"
const bcrypt = require(\"bcryptjs\");
const { PrismaClient } = require(\"@prisma/client\");

const prisma = new PrismaClient();

async function createAdmin() {
  try {
    const hashedPassword = await bcrypt.hash(\"admin123\", 10);
    const admin = await prisma.user.upsert({
      where: { email: \"admin@newmeet.com\" },
      update: {},
      create: {
        email: \"admin@newmeet.com\",
        password: hashedPassword,
        role: \"ADMIN\"
      }
    });
    console.log(\"✅ Admin user created:\", admin.email);
  } catch (error) {
    console.error(\"❌ Error creating admin user:\", error);
  } finally {
    await prisma.\$disconnect();
  }
}

createAdmin();
\"'
"

# Start the backend container again
echo "Starting backend container..."
docker-compose -f docker-compose.prod.yml up -d newmeet-backend

echo "✅ Database initialization completed!"
echo "Admin login: admin@newmeet.com / admin123"
