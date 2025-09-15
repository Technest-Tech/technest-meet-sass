#!/bin/bash

# Local Development Start Script for NewMeet
# This script starts the local development environment

set -e

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

# Check if LiveKit is running
check_livekit() {
    print_status "Checking if LiveKit server is running..."
    
    if ! docker compose -f docker-compose.local.yml ps | grep -q "Up"; then
        print_warning "LiveKit server is not running. Starting it now..."
        docker compose -f docker-compose.local.yml up -d
        sleep 5
        print_success "LiveKit server started!"
    else
        print_success "LiveKit server is already running!"
    fi
}

# Start Next.js development server
start_nextjs() {
    print_status "Starting Next.js development server..."
    
    # Load local environment variables
    if [ -f ".env.local" ]; then
        export $(cat .env.local | grep -v '^#' | xargs)
        print_success "Loaded local environment variables"
    else
        print_warning "No .env.local file found. Using default environment."
    fi
    
    # Start the development server
    pnpm dev
}

# Main function
main() {
    print_status "Starting NewMeet local development environment..."
    
    check_livekit
    start_nextjs
}

# Run main function
main "$@"
