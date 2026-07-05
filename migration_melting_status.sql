-- Migration script for adding 'melting' status to delivery_ingots

-- 1. Add status column
ALTER TABLE delivery_ingots ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'completed';

-- 2. Allow nulls in melted_weight and melted_percent for the 'melting' state
ALTER TABLE delivery_ingots ALTER COLUMN melted_weight DROP NOT NULL;
ALTER TABLE delivery_ingots ALTER COLUMN melted_percent DROP NOT NULL;
