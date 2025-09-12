#!/bin/bash

# NewMeet Production Deployment Script
# This script automates the deployment process

set -e  # Exit on any error

echo "🚀 Starting NewMeet Production Deployment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if running as root
if [[ $EUID -eq 0 ]]; then
   print_error "This script should not be run as root. Please run as a regular user with sudo privileges."
   print_status "Creating application user and switching..."
   
   # Create application user if it doesn't exist
   if ! id "newmeet" &>/dev/null; then
       useradd -m -s /bin/bash newmeet
       usermod -aG docker newmeet
       print_success "Created 'newmeet' user"
   fi
   
   # Switch to newmeet user and run the script
   print_status "Switching to 'newmeet' user and continuing deployment..."
   sudo -u newmeet bash -c "cd $(pwd) && $0"
   exit $?
fi

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    print_error "Docker is not installed. Please install Docker first."
    exit 1
fi

# Check if Docker Compose is installed
if ! command -v docker-compose &> /dev/null; then
    print_error "Docker Compose is not installed. Please install Docker Compose first."
    exit 1
fi

# Check if Git is installed
if ! command -v git &> /dev/null; then
    print_error "Git is not installed. Please install Git first."
    exit 1
fi

print_status "Prerequisites check passed!"

# Create necessary directories
print_status "Creating necessary directories..."
mkdir -p data uploads ssl

# Setup environment if .env.production doesn't exist
if [ ! -f .env.production ]; then
    print_status "Setting up production environment..."
    ./setup-env.sh
    print_warning "Please update S3 credentials in .env.production before continuing!"
    read -p "Press Enter to continue after updating S3 credentials..."
fi

# Build and start services
print_status "Building Docker images..."
docker-compose -f docker-compose.prod.yml build

print_status "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait for services to start
print_status "Waiting for services to start..."
sleep 10

# Check if services are running
print_status "Checking service status..."
docker-compose -f docker-compose.prod.yml ps

# Initialize database
print_status "Initializing database..."
docker-compose -f docker-compose.prod.yml exec -T newmeet-backend pnpm run db:push

# Create admin user
print_status "Creating admin user..."
docker-compose -f docker-compose.prod.yml exec -T newmeet-backend node -e "
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
"

# Test API endpoints
print_status "Testing API endpoints..."
if curl -f -s http://localhost:3000/health > /dev/null; then
    print_success "Backend API is responding!"
else
    print_warning "Backend API health check failed. Check logs with: docker-compose -f docker-compose.prod.yml logs newmeet-backend"
fi

# Display deployment information
print_success "Deployment completed!"
echo ""
echo "📋 Deployment Information:"
echo "=========================="
echo "Backend API: http://localhost:3000"
echo "Admin Panel: http://localhost:3000/admin/login"
echo "Admin Email: admin@newmeet.com"
echo "Admin Password: admin123"
echo ""
echo "📊 Service Status:"
echo "=================="
docker-compose -f docker-compose.prod.yml ps
echo ""
echo "📝 Useful Commands:"
echo "==================="
echo "View logs: docker-compose -f docker-compose.prod.yml logs -f"
echo "Restart services: docker-compose -f docker-compose.prod.yml restart"
echo "Stop services: docker-compose -f docker-compose.prod.yml down"
echo "Update services: docker-compose -f docker-compose.prod.yml pull && docker-compose -f docker-compose.prod.yml up -d"
echo ""
print_warning "Next Steps:"
echo "1. Configure your domain DNS to point to this server"
echo "2. Obtain SSL certificates for your domain"
echo "3. Update nginx.conf with your domain name"
echo "4. Update Flutter app with production API URL"
echo "5. Test the complete system"
echo ""
print_success "🎉 NewMeet is now deployed and ready for production!"
