#!/bin/bash

echo "🔄 Restarting NewMeet services..."

# Stop all services
echo "Stopping services..."
docker-compose -f docker-compose.prod.yml down

# Remove any problematic containers
echo "Cleaning up containers..."
docker container prune -f

# Start services again
echo "Starting services..."
docker-compose -f docker-compose.prod.yml up -d

# Wait a moment for services to start
echo "Waiting for services to start..."
sleep 10

# Check status
echo "Service status:"
docker-compose -f docker-compose.prod.yml ps

# Check logs for any errors
echo ""
echo "Recent logs:"
docker-compose -f docker-compose.prod.yml logs --tail=20

echo ""
echo "✅ Services restarted. Check the status above."
