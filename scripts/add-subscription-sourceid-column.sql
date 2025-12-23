-- Migration: Add sourceId column to subscriptions table
-- This column was added to the Prisma schema but doesn't exist in the restored database

-- Check if column exists, if not add it
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






