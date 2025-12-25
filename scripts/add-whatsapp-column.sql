-- Migration: Add whatsappNumber column to clients table
-- This column was added to the Prisma schema but doesn't exist in the restored database

-- Check if column exists, if not add it
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







