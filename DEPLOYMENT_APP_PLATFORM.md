# Digital Ocean App Platform Deployment Guide

## Overview
This guide will help you deploy your NewMeet application to Digital Ocean App Platform using Option 1 (Single App deployment).

## Prerequisites
- Digital Ocean account
- GitHub account
- Your code pushed to GitHub

## Step 1: Prepare Your Repository

### 1.1 Push your code to GitHub
```bash
# Initialize git if not already done
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit for App Platform deployment"

# Add your GitHub repository (replace with your actual repo URL)
git remote add origin https://github.com/yourusername/your-repo-name.git

# Push to GitHub
git push -u origin main
```

### 1.2 Update environment variables
Edit the `env.production` file and replace `your-app-name` with your actual app name:
```
NEXT_PUBLIC_LIVEKIT_URL=wss://your-actual-app-name.ondigitalocean.app/rtc
```

## Step 2: Create Digital Ocean App Platform App

### 2.1 Go to App Platform
1. Visit: https://cloud.digitalocean.com/apps
2. Click "Create App"

### 2.2 Connect GitHub Repository
1. Select "GitHub" as source
2. Choose your repository
3. Select the branch (usually `main`)

### 2.3 Configure the App
1. **App Name**: `almajd-meet` (or your preferred name)
2. **Source Directory**: `/` (root)
3. **Dockerfile Path**: `./Dockerfile`

### 2.4 Set Environment Variables
In the App Platform dashboard, add these environment variables:

```
NODE_ENV=production
DATABASE_URL=file:/app/data/prod.db
JWT_SECRET=almajd-meet-jwt-secret-2024-production-key-64chars-minimum
LIVEKIT_API_KEY=almajd-meet-api-key-prod-2024
LIVEKIT_API_SECRET=almajd-meet-api-secret-production-2024-secure-key
LIVEKIT_URL=http://livekit-server:7880
NEXT_PUBLIC_LIVEKIT_URL=wss://your-app-name.ondigitalocean.app/rtc
NEXT_PUBLIC_LK_RECORD_ENDPOINT=/api/record
```

### 2.5 Configure LiveKit Service (Optional)
If you want LiveKit as a separate service:

1. **Add Service** → **Database/Service**
2. **Service Type**: Custom
3. **Image**: `livekit/livekit-server:latest`
4. **Port**: 7880
5. **Environment Variables**:
   ```
   LIVEKIT_KEYS=almajd-meet-api-key-prod-2024: almajd-meet-api-secret-production-2024-secure-key
   ```

## Step 3: Deploy

1. Click "Create Resources"
2. Wait for deployment (5-10 minutes)
3. Your app will be available at: `https://your-app-name.ondigitalocean.app`

## Step 4: Test Your Deployment

### 4.1 Test the main app
Visit: `https://your-app-name.ondigitalocean.app`

### 4.2 Test a room
Visit: `https://your-app-name.ondigitalocean.app/room/test-room?type=host`

### 4.3 Test API endpoints
```bash
curl https://your-app-name.ondigitalocean.app/api/health
```

## Step 5: Configure Custom Domain (Optional)

### 5.1 Add domain in App Platform
1. Go to your app settings
2. Click "Domains"
3. Add your custom domain

### 5.2 Update DNS
Point your domain to Digital Ocean:
- A record: `@` → `your-app-name.ondigitalocean.app`
- CNAME record: `www` → `your-app-name.ondigitalocean.app`

## Troubleshooting

### Common Issues:

1. **Build fails**: Check the build logs in App Platform dashboard
2. **Environment variables not working**: Make sure they're set in the dashboard
3. **LiveKit not working**: Check if LiveKit service is running and accessible

### Logs:
- View logs in App Platform dashboard
- Check build logs for deployment issues
- Check runtime logs for runtime errors

## Cost Estimation

- **Basic plan**: $5/month (1 service, 512MB RAM)
- **Professional plan**: $12/month (1 service, 1GB RAM, better performance)

## Benefits of App Platform

✅ **No server management** - Digital Ocean handles everything
✅ **Automatic SSL** - HTTPS out of the box
✅ **Automatic scaling** - Handles traffic spikes
✅ **Easy environment management** - Set variables in dashboard
✅ **Git-based deployments** - Deploy by pushing to GitHub
✅ **Health checks** - Automatic monitoring
✅ **Load balancing** - Built-in

## Next Steps

1. **Monitor your app** - Use App Platform dashboard
2. **Set up monitoring** - Add health checks
3. **Configure backups** - Set up database backups
4. **Scale as needed** - Upgrade instance size if needed

## Support

- Digital Ocean App Platform docs: https://docs.digitalocean.com/products/app-platform/
- Digital Ocean support: https://cloud.digitalocean.com/support
