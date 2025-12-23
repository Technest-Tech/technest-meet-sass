# Database Migration Fix - Missing Columns

## Issues Fixed

### 1. Missing `whatsappNumber` Column in `clients` Table

**Error:**
```
The column `clients.whatsappNumber` does not exist in the current database.
```

**Fix:** Added `whatsappNumber TEXT` column to `clients` table

### 2. Missing `sourceId` Column in `subscriptions` Table

**Error:**
```
The column `subscriptions.sourceId` does not exist in the current database.
```

**Fix:** Added `sourceId TEXT` column to `subscriptions` table

## Root Cause

The database dump that was restored to the server was from an older version that didn't have these columns. The Prisma schema includes these fields, but the database was out of sync.

## Solution

### Step 1: Added Missing Columns Manually

Created SQL migration scripts:
- `scripts/add-whatsapp-column.sql` - Adds `whatsappNumber` to `clients` table
- `scripts/add-subscription-sourceid-column.sql` - Adds `sourceId` to `subscriptions` table

### Step 2: Synced Entire Schema

Ran `prisma db push` to ensure the database is fully in sync with the Prisma schema:

```bash
docker-compose exec -T newmeet-backend npx prisma db push --skip-generate --accept-data-loss
```

**Result:** `🚀 Your database is now in sync with your Prisma schema. Done in 191ms`

## Migration Scripts

### `scripts/add-whatsapp-column.sql`
```sql
-- Migration: Add whatsappNumber column to clients table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'clients' 
        AND column_name = 'whatsappNumber'
    ) THEN
        ALTER TABLE clients ADD COLUMN "whatsappNumber" TEXT;
        RAISE NOTICE 'Column whatsappNumber added to clients table';
    ELSE
        RAISE NOTICE 'Column whatsappNumber already exists in clients table';
    END IF;
END $$;
```

### `scripts/add-subscription-sourceid-column.sql`
```sql
-- Migration: Add sourceId column to subscriptions table
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'subscriptions' 
        AND column_name = 'sourceId'
    ) THEN
        ALTER TABLE subscriptions ADD COLUMN "sourceId" TEXT;
        RAISE NOTICE 'Column sourceId added to subscriptions table';
    ELSE
        RAISE NOTICE 'Column sourceId already exists in subscriptions table';
    END IF;
END $$;
```

## Execution Commands

### For whatsappNumber:
```bash
# Copy script to server
scp scripts/add-whatsapp-column.sql root@152.42.249.147:/tmp/

# Execute in container
docker cp /tmp/add-whatsapp-column.sql $(docker-compose ps -q postgres):/tmp/
docker-compose exec -T postgres psql -U almajd_user -d almajd_meet -f /tmp/add-whatsapp-column.sql
```

### For sourceId:
```bash
# Copy script to server
scp scripts/add-subscription-sourceid-column.sql root@152.42.249.147:/tmp/

# Execute in container
docker cp /tmp/add-subscription-sourceid-column.sql $(docker-compose ps -q postgres):/tmp/
docker-compose exec -T postgres psql -U almajd_user -d almajd_meet -f /tmp/add-subscription-sourceid-column.sql
```

### Full Schema Sync:
```bash
docker-compose exec -T newmeet-backend npx prisma db push --skip-generate --accept-data-loss
```

## Verification

### Check whatsappNumber column:
```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'clients' AND column_name = 'whatsappNumber';
```

**Result:**
```
column_name   | data_type 
--------------+-----------
whatsappNumber | text
```

### Check sourceId column:
```sql
SELECT column_name 
FROM information_schema.columns 
WHERE table_name = 'subscriptions' AND column_name = 'sourceId';
```

**Result:**
```
column_name
------------
sourceId
```

## Result

✅ **All missing columns added**
- `whatsappNumber` column exists in `clients` table
- `sourceId` column exists in `subscriptions` table
- Database is fully synced with Prisma schema
- API endpoints should now work correctly

## Prevention

To prevent this issue in the future:

1. **Always run schema sync after database restore:**
   ```bash
   docker-compose exec newmeet-backend npx prisma db push
   ```

2. **Or use Prisma migrations:**
   ```bash
   docker-compose exec newmeet-backend npx prisma migrate deploy
   ```

3. **Check schema sync before deployment:**
   ```bash
   docker-compose exec newmeet-backend npx prisma db pull
   ```

4. **Include migration scripts in deployment process:**
   - Add migration scripts to deployment pipeline
   - Run `prisma db push` automatically after database restore

---

**Date:** December 15, 2025  
**Status:** ✅ Fixed  
**Migration Scripts:**
- `scripts/add-whatsapp-column.sql`
- `scripts/add-subscription-sourceid-column.sql`






