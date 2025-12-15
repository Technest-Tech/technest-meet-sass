# Digital Ocean Deployment Guide

This guide explains how to deploy the Almajd Meet application to the Digital Ocean server at `152.42.249.147`.

## Prerequisites

- Access to Digital Ocean server (SSH credentials)
- Local machine with:
  - Git
  - Docker (for building)
  - sshpass (will be installed automatically if missing)
  - Access to the repository

## Server Information

- **IP Address**: 152.42.249.147
- **User**: root
- **Password**: Ad@#$E31Ju
- **Deployment Directory**: /opt/almajd-meet

## Quick Deployment

### Option 1: Automated Deployment Script

1. **Create environment file**:
   ```bash
   cp env.do.example env.do
   # Edit env.do with your actual values
   ```

2. **Run deployment script**:
   ```bash
   ./deploy-do.sh
   ```

The script will:
- Connect to the server
- Install required packages (Docker, Docker Compose, etc.)
- Copy all necessary files
- Build and start all services
- Run database migrations

### Option 2: Manual Deployment

#### Step 1: Prepare Environment File

```bash
cp env.do.example env.do
```

Edit `env.do` and update:
- `NEXT_PUBLIC_LIVEKIT_URL` - Should be `ws://152.42.249.147/rtc`
- `APP_URL` - Should be `http://152.42.249.147`
- Database credentials (if changed)
- JWT secret
- Other configuration values

#### Step 2: Connect to Server

```bash
ssh root@152.42.249.147
# Password: Ad@#$E31Ju
```

#### Step 3: Install Required Packages

```bash
apt-get update
apt-get install -y docker.io docker-compose-plugin git curl
```

#### Step 4: Create Deployment Directory

```bash
mkdir -p /opt/almajd-meet
cd /opt/almajd-meet
```

#### Step 5: Copy Files to Server

From your local machine:

```bash
# Copy docker-compose file
scp docker-compose.do.yml root@152.42.249.147:/opt/almajd-meet/docker-compose.yml

# Copy nginx configuration
scp nginx.do.conf root@152.42.249.147:/opt/almajd-meet/nginx.do.conf

# Copy LiveKit configuration
scp livekit.do.yaml root@152.42.249.147:/opt/almajd-meet/livekit.do.yaml

# Copy environment file
scp env.do root@152.42.249.147:/opt/almajd-meet/env.do

# Copy Dockerfile
scp Dockerfile root@152.42.249.147:/opt/almajd-meet/Dockerfile

# Copy application files (you may need to use rsync or tar for large directories)
# Option A: Using tar
tar -czf app-files.tar.gz app lib prisma public styles package.json pnpm-lock.yaml tsconfig.json next.config.js postcss.config.js tailwind.config.js middleware.ts
scp app-files.tar.gz root@152.42.249.147:/opt/almajd-meet/
ssh root@152.42.249.147 "cd /opt/almajd-meet && tar -xzf app-files.tar.gz && rm app-files.tar.gz"
```

#### Step 6: Start Services

On the server:

```bash
cd /opt/almajd-meet
docker compose up -d --build
```

#### Step 7: Run Database Migrations

```bash
docker compose exec newmeet-backend npx prisma migrate deploy
# Or if migrations don't exist:
docker compose exec newmeet-backend npx prisma db push
```

#### Step 8: Verify Deployment

```bash
# Check all containers are running
docker compose ps

# Check application logs
docker compose logs -f newmeet-backend

# Check LiveKit logs
docker compose logs -f livekit

# Check nginx logs
docker compose logs -f nginx
```

## Services

The deployment includes:

1. **PostgreSQL Database** (port 5432)
   - Database: `almajd_meet`
   - User: `almajd_user`
   - Password: `almajd_secure_password_2024`

2. **LiveKit Server** (ports 7880, 7881, 7882)
   - WebSocket: `ws://152.42.249.147/rtc`
   - API: `http://152.42.249.147:7880`

3. **Next.js Application** (port 3000)
   - Accessible via nginx at `http://152.42.249.147`

4. **Nginx Reverse Proxy** (ports 80, 443)
   - Routes traffic to application and LiveKit

## Accessing the Application

- **Web Application**: http://152.42.249.147
- **LiveKit WebSocket**: ws://152.42.249.147/rtc
- **API Endpoints**: http://152.42.249.147/api/*

## Firewall Configuration

Make sure these ports are open:

```bash
# Allow HTTP
ufw allow 80/tcp

# Allow HTTPS (if using SSL)
ufw allow 443/tcp

# Allow LiveKit ports
ufw allow 7880/tcp
ufw allow 7881/tcp
ufw allow 7882/udp

# Allow PostgreSQL (if needed externally)
ufw allow 5432/tcp
```

## Managing Services

### View Logs

```bash
cd /opt/almajd-meet

# All services
docker compose logs -f

# Specific service
docker compose logs -f newmeet-backend
docker compose logs -f livekit
docker compose logs -f postgres
docker compose logs -f nginx
```

### Restart Services

```bash
cd /opt/almajd-meet

# Restart all
docker compose restart

# Restart specific service
docker compose restart newmeet-backend
```

### Stop Services

```bash
cd /opt/almajd-meet
docker compose down
```

### Update Application

1. Pull latest changes (if using git on server)
2. Rebuild and restart:

```bash
cd /opt/almajd-meet
docker compose down
docker compose build --no-cache
docker compose up -d
docker compose exec newmeet-backend npx prisma migrate deploy
```

## Database Management

### Backup Database

```bash
docker compose exec postgres pg_dump -U almajd_user almajd_meet > backup_$(date +%Y%m%d_%H%M%S).sql
```

### Restore Database

```bash
docker compose exec -T postgres psql -U almajd_user almajd_meet < backup.sql
```

### Access Database Console

```bash
docker compose exec postgres psql -U almajd_user almajd_meet
```

## Troubleshooting

### Services Not Starting

1. Check logs:
   ```bash
   docker compose logs
   ```

2. Check disk space:
   ```bash
   df -h
   ```

3. Check Docker:
   ```bash
   docker ps
   docker system df
   ```

### Application Not Accessible

1. Check nginx:
   ```bash
   docker compose logs nginx
   ```

2. Check if port 80 is open:
   ```bash
   netstat -tuln | grep 80
   ```

3. Check firewall:
   ```bash
   ufw status
   ```

### LiveKit Connection Issues

1. Check LiveKit logs:
   ```bash
   docker compose logs livekit
   ```

2. Verify environment variables:
   ```bash
   docker compose exec newmeet-backend env | grep LIVEKIT
   ```

3. Check LiveKit configuration:
   ```bash
   cat /opt/almajd-meet/livekit.do.yaml
   ```

### Database Connection Issues

1. Check PostgreSQL is running:
   ```bash
   docker compose ps postgres
   ```

2. Check database connection:
   ```bash
   docker compose exec postgres psql -U almajd_user -d almajd_meet -c "SELECT 1;"
   ```

3. Verify DATABASE_URL in env.do matches the service name

## SSL/HTTPS Setup (Optional)

If you want to use HTTPS:

1. Install Certbot on the server
2. Get SSL certificate (requires domain name)
3. Update nginx.do.conf to enable HTTPS server block
4. Update env.do to use `https://` and `wss://` URLs

## Monitoring

### Resource Usage

```bash
docker stats
```

### Service Health

```bash
# Application health
curl http://152.42.249.147/api/health

# Container health
docker compose ps
```

## Security Considerations

1. **Change default passwords** in env.do
2. **Use strong JWT secret** (64+ characters)
3. **Restrict database access** (currently exposed on port 5432)
4. **Set up firewall rules** to only allow necessary ports
5. **Keep system updated**: `apt-get update && apt-get upgrade`
6. **Regular backups** of database and uploaded files

## Support

For issues:
1. Check service logs
2. Verify environment variables
3. Check firewall rules
4. Verify all services are running
5. Check disk space and memory

## Notes

- This deployment uses IP-based access (no domain required)
- All services run in Docker containers
- Database data is persisted in Docker volume
- Uploaded files are stored in `/opt/almajd-meet/uploads`
- Application data is stored in `/opt/almajd-meet/data`
