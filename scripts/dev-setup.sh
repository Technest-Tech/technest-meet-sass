#!/bin/bash

# Local Development Setup Script for NewMeet
# This script sets up the local development environment

set -e

echo "🚀 Setting up NewMeet local development environment..."

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

# Check if required tools are installed
check_requirements() {
    print_status "Checking requirements..."
    
    if ! command -v node &> /dev/null; then
        print_error "Node.js is not installed. Please install Node.js 18 or higher."
        exit 1
    fi
    
    if ! command -v pnpm &> /dev/null; then
        print_error "pnpm is not installed. Please install pnpm."
        exit 1
    fi
    
    if ! command -v docker &> /dev/null; then
        print_error "Docker is not installed. Please install Docker."
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        print_error "Docker Compose is not available. Please ensure Docker Desktop is running."
        exit 1
    fi
    
    print_success "All requirements are met!"
}

# Install dependencies
install_dependencies() {
    print_status "Installing Node.js dependencies..."
    pnpm install
    print_success "Node.js dependencies installed!"
    
    print_status "Installing Flutter dependencies..."
    cd newmeet_mobile
    flutter pub get
    cd ..
    print_success "Flutter dependencies installed!"
}

# Setup environment files
setup_environment() {
    print_status "Setting up environment files..."
    
    if [ ! -f ".env.local" ]; then
        print_warning ".env.local not found. Please copy env.local to .env.local"
        print_warning "cp env.local .env.local"
    fi
    
    print_success "Environment files ready!"
}

# Start LiveKit server
start_livekit() {
    print_status "Starting LiveKit server for local development..."
    docker compose -f docker-compose.local.yml up -d
    print_success "LiveKit server started!"
}

# Setup database
setup_database() {
    print_status "Setting up local database..."
    
    # Generate Prisma client
    pnpm db:generate
    
    # Push database schema
    pnpm db:push
    
    # Initialize with sample data
    node scripts/init-local-db.js
    
    print_success "Database setup complete!"
}

# Main setup function
main() {
    print_status "Starting NewMeet local development setup..."
    
    check_requirements
    install_dependencies
    setup_environment
    start_livekit
    setup_database
    
    print_success "🎉 Local development environment setup complete!"
    echo ""
    print_status "Next steps:"
    echo "1. Start the Next.js development server: pnpm dev:local"
    echo "2. Start the Flutter app: cd newmeet_mobile && flutter run"
    echo "3. Access the web app at: http://localhost:3000"
    echo "4. Admin login: admin@local.dev / admin123"
    echo ""
    print_status "To stop LiveKit server: docker-compose -f docker-compose.local.yml down"
}

# Run main function
main "$@"
