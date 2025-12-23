# Deployment Guide: Backend Recording & Egress Services

## 📋 Summary of Changes

### ✅ New Features Added

1. **Backend Recording System**
   - New API endpoints for recording management (`/api/record/*`)
   - Recording status tracking and monitoring
   - File download and streaming capabilities
   - Client recordings management UI

2. **Two Egress Services (DigitalOcean Droplets)**
   - `egress-server1`: Handles recordings for Server 1 (178.128.78.195)
   - `egress-server2`: Handles recordings for Server 2 (167.99.107.128)
   - Automatic server routing based on consistent hashing

3. **Database Schema Updates**
   - New `Recording` model with status tracking
   - New enums: `RecordingStatus`, `StorageType`
   - Recording metadata and storage information

4. **New Dependencies**
   - `@ffmpeg/ffmpeg` and `@ffmpeg/util` for video processing

5. **Client UI Components**
   - Recording management interface
   - Recording player and download modals
   - Backend recording control component

### 📁 New Files

**API Routes:**
- `app/api/record/backend-status/route.ts`
- `app/api/record/start/route.ts`
- `app/api/record/stop/route.ts`
- `app/api/record/file/route.ts`
- `app/api/record/download/route.ts`
- `app/api/record/convert/route.ts`
- `app/api/record/egress-health/route.ts`
- `app/api/client/recordings/route.ts`

**Client Components:**
- `app/client/recordings/RecordingsListClient.tsx`
- `app/client/recordings/RecordingPlayerModal.tsx`
- `app/client/recordings/page.tsx`

**Library Components:**
- `lib/BackendRecordingControl.tsx`
- `lib/BackendRecordingDownloadModal.tsx`
- `lib/services/recordingStorage.ts`

**Configuration:**
- `egress-config-server1.yaml`
- `egress-config-server2.yaml`
- `docker-compose.yml` (updated with egress services)

## ⚠️ Impact Assessment

### Will This Affect Live Code?

**YES - These changes WILL affect production, but in a SAFE way:**

1. **Database Migration Required** ⚠️
   - New `Recording` table will be created
   - New enums added (non-breaking)
   - **Impact**: Requires database migration (downtime: ~30 seconds)

2. **New API Endpoints** ✅
   - All new endpoints are additive (no breaking changes)
   - Existing endpoints remain unchanged
   - **Impact**: No breaking changes to existing functionality

3. **New Dependencies** ✅
   - FFmpeg libraries added (only used for new features)
   - **Impact**: Build time may increase slightly, but no runtime impact on existing features

4. **Environment Variables** ⚠️
   - Uses existing `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`
   - Uses optional `LIVEKIT_1_SERVER_URL`, `LIVEKIT_2_SERVER_URL` (already configured)
   - **Impact**: No new required environment variables

5. **Docker Compose Changes** ⚠️
   - New egress services added (local development only)
   - **Impact**: Production servers don't use `docker-compose.yml` - no impact on production

6. **Client-Side Changes** ✅
   - New recording UI components (only shown when feature enabled)
   - Existing UI remains unchanged
   - **Impact**: No breaking changes to existing UI

### Risk Level: **LOW** 🟢

- All changes are **additive** (new features)
- No breaking changes to existing functionality
- Database migration is safe (creates new table, doesn't modify existing)
- Recording feature can be enabled/disabled per client

## 🚀 Deployment Steps

### Pre-Deployment Checklist

- [ ] Review all changes: `git status` and `git diff`
- [ ] Test locally: Ensure recording works in development
- [ ] Backup database: Create database backup before migration
- [ ] Verify environment variables are set on production servers
- [ ] Check that Redis is running on both LiveKit servers
- [ ] Ensure egress services are running (if deploying to production)

### Step 1: Commit and Push Changes

```bash
# Review all changes
git status
git diff

# Add all changes
git add .

# Commit with descriptive message
git commit -m "feat: Add backend recording system with dual egress services

- Add Recording model and database schema
- Add recording API endpoints (start, stop, status, download)
- Add client recordings management UI
- Configure two egress services for Server 1 and Server 2
- Add FFmpeg dependencies for video processing
- Add recording storage service"

# Push to remote
git push origin cleaned_version
```

### Step 2: Deploy to Application Server (104.248.179.82)

```bash
# SSH to application server
ssh root@104.248.179.82

# Navigate to project directory
cd /opt/almajd-meet-livekit

# Pull latest changes
git pull origin cleaned_version

# Install new dependencies
pnpm install

# Generate Prisma client (includes new Recording model)
npx prisma generate

# Run database migration (creates Recording table)
npx prisma migrate deploy

# Rebuild Next.js application
pnpm build

# Restart application (using docker-compose or systemd)
# If using docker-compose:
docker compose -f docker-compose.prod.yml restart app

# Or if using systemd:
systemctl restart almajd-meet-app
```

### Step 3: Verify Deployment

```bash
# Check application is running
docker ps | grep app
# or
systemctl status almajd-meet-app

# Check logs for errors
docker logs app-container-name --tail 50
# or
journalctl -u almajd-meet-app -n 50

# Test new API endpoint (should return 200 or 401 if not authenticated)
curl -I http://localhost:3000/api/record/egress-health

# Verify database migration
# Connect to database and check Recording table exists
psql $DATABASE_URL -c "\d recordings"
```

### Step 4: Deploy Egress Services (If Needed)

**Note:** Egress services are already running on production servers (178.128.78.195 and 167.99.107.128) as separate DigitalOcean droplets. The configuration files (`egress-config-server1.yaml` and `egress-config-server2.yaml`) are for reference only.

If you need to update egress service configuration:

```bash
# Server 1 Egress (if running as Docker container)
ssh root@178.128.78.195
cd /opt/almajd-meet-livekit
docker compose restart egress-server1

# Server 2 Egress (if running as Docker container)
ssh root@167.99.107.128
cd /opt/almajd-meet-livekit
docker compose restart egress-server2
```

### Step 5: Post-Deployment Verification

1. **Test Recording Feature:**
   - Create a test room
   - Start a recording
   - Verify recording status updates
   - Stop recording and verify file is saved

2. **Check Database:**
   ```sql
   -- Verify Recording table exists
   SELECT * FROM recordings LIMIT 1;
   ```

3. **Check Logs:**
   ```bash
   # Application logs
   docker logs app-container-name --tail 100 | grep -i recording
   
   # Check for errors
   docker logs app-container-name --tail 100 | grep -i error
   ```

4. **Verify Egress Services:**
   ```bash
   # Check egress health (from application server)
   curl http://178.128.78.195:8080  # Server 1 egress
   curl http://167.99.107.128:8081  # Server 2 egress
   ```

## 🔧 Environment Variables

### Required (Already Set)
- `LIVEKIT_API_KEY` ✅
- `LIVEKIT_API_SECRET` ✅
- `DATABASE_URL` ✅

### Optional (For Multi-Server Support)
- `LIVEKIT_1_SERVER_URL` (defaults to `LIVEKIT_URL`)
- `LIVEKIT_2_SERVER_URL` (optional, for Server 2)
- `LIVEKIT_1_CLIENT_URL` (defaults to `NEXT_PUBLIC_LIVEKIT_URL`)
- `LIVEKIT_2_CLIENT_URL` (optional, for Server 2)

## 📊 Database Migration Details

### Migration SQL (Generated by Prisma)

The migration will:
1. Create `RecordingStatus` enum
2. Create `StorageType` enum
3. Create `recordings` table with:
   - `id` (primary key)
   - `roomId` (foreign key to rooms)
   - `egressId` (unique, LiveKit egress ID)
   - `filename`, `originalName`, `fileSize`, `duration`
   - `status` (RecordingStatus enum)
   - `startedAt`, `endedAt`
   - `storageType`, `storagePath`
   - `createdAt`, `updatedAt`
   - Indexes on `roomId`, `status`, `createdAt`

**Estimated Migration Time:** ~5-10 seconds
**Downtime:** None (migration is non-blocking)

## 🐛 Troubleshooting

### Issue: Database Migration Fails

```bash
# Check Prisma migration status
npx prisma migrate status

# If migration is stuck, reset (CAUTION: Only in development)
# npx prisma migrate reset

# In production, manually fix migration
npx prisma migrate resolve --applied <migration-name>
```

### Issue: Recording Not Starting

1. Check egress services are running:
   ```bash
   curl http://178.128.78.195:8080
   curl http://167.99.107.128:8081
   ```

2. Check Redis connectivity:
   ```bash
   # On LiveKit servers
   redis-cli ping
   ```

3. Check LiveKit server logs:
   ```bash
   docker logs livekit-server --tail 50 | grep -i egress
   ```

### Issue: Build Fails

```bash
# Clear Next.js cache
rm -rf .next

# Clear node_modules and reinstall
rm -rf node_modules pnpm-lock.yaml
pnpm install

# Regenerate Prisma client
npx prisma generate

# Rebuild
pnpm build
```

## ✅ Rollback Plan

If deployment fails:

1. **Revert Code:**
   ```bash
   git revert HEAD
   git push origin cleaned_version
   ```

2. **Rollback Database Migration:**
   ```bash
   # Connect to database
   psql $DATABASE_URL
   
   # Drop Recording table (if migration was applied)
   DROP TABLE IF EXISTS recordings;
   DROP TYPE IF EXISTS "RecordingStatus";
   DROP TYPE IF EXISTS "StorageType";
   ```

3. **Restart Application:**
   ```bash
   docker compose -f docker-compose.prod.yml restart app
   ```

## 📝 Notes

- Recording feature is **opt-in** per client (controlled by subscription features)
- Egress services run on separate DigitalOcean droplets (not on application server)
- Recordings are stored locally by default (can be configured for R2 storage later)
- The system automatically routes recording requests to the correct server based on room name hashing

## 🎯 Success Criteria

Deployment is successful when:
- ✅ Application builds without errors
- ✅ Database migration completes successfully
- ✅ Recording API endpoints respond correctly
- ✅ Egress services are accessible and healthy
- ✅ Test recording can be started and stopped
- ✅ Recording file is saved and can be downloaded
- ✅ No errors in application logs

---

**Deployment Date:** _______________
**Deployed By:** _______________
**Status:** ⬜ Pending | ⬜ In Progress | ⬜ Completed | ⬜ Failed

