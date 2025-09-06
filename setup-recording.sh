#!/bin/bash

# Setup script for NewMeet Recording Feature
# This script helps configure the recording functionality

echo "🎥 NewMeet Recording Setup"
echo "=========================="
echo ""

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please run setup.sh first to create your environment file."
    exit 1
fi

echo "📋 Recording Configuration Options:"
echo ""
echo "1. Local Development (No S3 required - recordings saved locally)"
echo "2. Production with S3 (Recordings uploaded to AWS S3)"
echo "3. Skip recording setup"
echo ""

read -p "Choose an option (1-3): " choice

case $choice in
    1)
        echo ""
        echo "🔧 Setting up local development recording..."
        
        # Add recording endpoint to .env
        if ! grep -q "NEXT_PUBLIC_LK_RECORD_ENDPOINT" .env; then
            echo "NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record" >> .env
            echo "✅ Added recording endpoint to .env"
        else
            echo "✅ Recording endpoint already configured"
        fi
        
        # Add placeholder S3 variables (not used in local dev)
        if ! grep -q "S3_KEY_ID" .env; then
            echo "S3_KEY_ID=local-dev" >> .env
            echo "S3_KEY_SECRET=local-dev" >> .env
            echo "S3_BUCKET=local-dev" >> .env
            echo "S3_ENDPOINT=https://s3.amazonaws.com" >> .env
            echo "S3_REGION=us-east-1" >> .env
            echo "✅ Added placeholder S3 variables for local development"
        else
            echo "✅ S3 variables already configured"
        fi
        
        echo ""
        echo "🎉 Local recording setup complete!"
        echo ""
        echo "📝 Note: In local development mode, recordings will be saved to your LiveKit server."
        echo "   For production use, configure S3 storage for better reliability."
        ;;
        
    2)
        echo ""
        echo "🔧 Setting up production recording with S3..."
        
        # Add recording endpoint
        if ! grep -q "NEXT_PUBLIC_LK_RECORD_ENDPOINT" .env; then
            echo "NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record" >> .env
            echo "✅ Added recording endpoint to .env"
        else
            echo "✅ Recording endpoint already configured"
        fi
        
        echo ""
        echo "📋 Please provide your S3 configuration:"
        echo ""
        
        read -p "S3 Access Key ID: " s3_key_id
        read -p "S3 Secret Access Key: " s3_secret
        read -p "S3 Bucket Name: " s3_bucket
        read -p "S3 Region (e.g., us-east-1): " s3_region
        read -p "S3 Endpoint (e.g., https://s3.amazonaws.com): " s3_endpoint
        
        # Update or add S3 variables
        if grep -q "S3_KEY_ID" .env; then
            sed -i.bak "s/S3_KEY_ID=.*/S3_KEY_ID=$s3_key_id/" .env
            sed -i.bak "s/S3_KEY_SECRET=.*/S3_KEY_SECRET=$s3_secret/" .env
            sed -i.bak "s/S3_BUCKET=.*/S3_BUCKET=$s3_bucket/" .env
            sed -i.bak "s/S3_REGION=.*/S3_REGION=$s3_region/" .env
            sed -i.bak "s/S3_ENDPOINT=.*/S3_ENDPOINT=$s3_endpoint/" .env
            rm .env.bak
        else
            echo "S3_KEY_ID=$s3_key_id" >> .env
            echo "S3_KEY_SECRET=$s3_secret" >> .env
            echo "S3_BUCKET=$s3_bucket" >> .env
            echo "S3_REGION=$s3_region" >> .env
            echo "S3_ENDPOINT=$s3_endpoint" >> .env
        fi
        
        echo ""
        echo "🎉 Production recording setup complete!"
        echo ""
        echo "📝 Important: Make sure your S3 bucket has the correct permissions:"
        echo "   - Your S3 access key needs 's3:PutObject' permission"
        echo "   - The bucket should allow public read access for recordings (optional)"
        echo "   - Consider setting up lifecycle policies for old recordings"
        ;;
        
    3)
        echo ""
        echo "⏭️  Skipping recording setup."
        echo "   You can configure recording later by running this script again."
        ;;
        
    *)
        echo ""
        echo "❌ Invalid option. Please run the script again and choose 1, 2, or 3."
        exit 1
        ;;
esac

echo ""
echo "🚀 Next steps:"
echo "1. Restart your LiveKit server: ./start-livekit.sh"
echo "2. Restart your Next.js application: npm run dev"
echo "3. Join a meeting as a host to test recording functionality"
echo ""
echo "📖 For more information, see the RECORDING_README.md file"

