#!/bin/bash

echo "Setting up NewMeet production environment..."

# Generate secure JWT secret
JWT_SECRET=$(openssl rand -base64 32)
echo "JWT_SECRET=$JWT_SECRET" >> .env.production

# Generate LiveKit API key and secret
LIVEKIT_API_KEY=$(openssl rand -hex 16)
LIVEKIT_API_SECRET=$(openssl rand -hex 32)
echo "LIVEKIT_API_KEY=$LIVEKIT_API_KEY" >> .env.production
echo "LIVEKIT_API_SECRET=$LIVEKIT_API_SECRET" >> .env.production

# Set LiveKit URL
echo "LIVEKIT_URL=wss://api.newmeet.com:7880" >> .env.production
echo "NEXT_PUBLIC_LIVEKIT_URL=wss://api.newmeet.com:7880" >> .env.production

# Database URL
echo "DATABASE_URL=file:/app/data/prod.db" >> .env.production

echo "Environment setup complete!"