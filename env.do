# Digital Ocean Deployment Environment Variables
NODE_ENV=production

# Database (PostgreSQL - will use internal postgres service)
DATABASE_URL=postgresql://almajd_user:almajd_secure_password_2024@postgres:5432/almajd_meet

# Super Admin (for initial setup)
SUPER_ADMIN_EMAIL=admin@almajd.com
SUPER_ADMIN_PASSWORD=admin123

# JWT Authentication
JWT_SECRET=almajd-meet-jwt-secret-2024-production-key-64chars-minimum

# LiveKit Configuration
# Internal URL for server-to-server communication
LIVEKIT_URL=http://livekit:7880
# Public URL for clients (use IP)
NEXT_PUBLIC_LIVEKIT_URL=ws://152.42.249.147/rtc
LIVEKIT_API_KEY=almajd-meet-api-key-prod-2024
LIVEKIT_API_SECRET=almajd-meet-api-secret-production-2024-secure-key

# File storage
ROOM_UPLOAD_ROOT=/app/data/uploads

# Cloudflare R2 Storage Configuration
R2_ACCESS_KEY_ID=7cc88bb0e07b172a19b37cdec4512970
R2_SECRET_ACCESS_KEY=2863ad840ac813b4a496f8b065c353ccee4a088e07a40975d31344414ca24ea3
R2_ENDPOINT=https://3eb7ab379add240613a41c5ea0a1e9e5.r2.cloudflarestorage.com
R2_BUCKET_NAME=academiq-meet
R2_ENABLED=true

# Base URL used in generated links (use IP)
APP_URL=http://152.42.249.147

# Optional path that referral links should open
REFERRAL_TARGET_PATH=/subscription-request

# Next.js Public Variables
NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record
NEXT_PUBLIC_SHOW_SETTINGS_MENU=true
