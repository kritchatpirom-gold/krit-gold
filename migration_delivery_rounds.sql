-- Migration script for Delivery Rounds & Ingots

-- Create delivery_rounds table
CREATE TABLE IF NOT EXISTS delivery_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending',
  gold_payment NUMERIC DEFAULT 0,
  silver_payment NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  completed_at TIMESTAMP WITH TIME ZONE
);

ALTER TABLE delivery_rounds ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to delivery_rounds" ON delivery_rounds FOR ALL USING (auth.role() = 'authenticated');

-- Create delivery_ingots table
CREATE TABLE IF NOT EXISTS delivery_ingots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  round_id UUID REFERENCES delivery_rounds(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  melted_weight NUMERIC NOT NULL,
  melted_percent NUMERIC NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE delivery_ingots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow authenticated full access to delivery_ingots" ON delivery_ingots FOR ALL USING (auth.role() = 'authenticated');

-- Add ingot_id to transactions table
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS ingot_id UUID REFERENCES delivery_ingots(id) ON DELETE SET NULL;
