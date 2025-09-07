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

# S3 Configuration (update with your values)
echo "S3_KEY_ID=your-s3-access-key" >> .env.production
echo "S3_KEY_SECRET=your-s3-secret-key" >> .env.production
echo "S3_BUCKET=your-recording-bucket" >> .env.production
echo "S3_ENDPOINT=https://s3.amazonaws.com" >> .env.production
echo "S3_REGION=us-east-1" >> .env.production

echo "Environment setup complete!"
echo "Please update S3 credentials in .env.production"