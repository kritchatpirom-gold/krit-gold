-- กฤตหลอมทอง อุบลราชธานี Database Schema

-- Table: gold_premiums
CREATE TABLE IF NOT EXISTS gold_premiums (
  id SERIAL PRIMARY KEY,
  range_min INTEGER NOT NULL,
  range_max INTEGER NOT NULL,
  premium_amount NUMERIC NOT NULL,
  label TEXT NOT NULL
);

-- Insert default rows
INSERT INTO gold_premiums (range_min, range_max, premium_amount, label) VALUES
  (0, 29, 500, '<30%'),
  (30, 49, 1200, '30-49%'),
  (50, 69, 1500, '50-69%'),
  (70, 98, 1700, '70-98%'),
  (99, 100, 1800, '99%');

-- Table: transactions
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_name TEXT,
  phone TEXT,
  type TEXT NOT NULL,
  base_price NUMERIC NOT NULL,
  premium_amount NUMERIC DEFAULT 0,
  percent NUMERIC NOT NULL,
  weight NUMERIC NOT NULL,
  net_price NUMERIC NOT NULL,
  id_card TEXT,
  address TEXT,
  id_card_photo TEXT,
  signature TEXT,
  photo TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Setup RLS
ALTER TABLE gold_premiums ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Allow read access for public on premiums so the calculator works without login
CREATE POLICY "Allow public read-only access to gold_premiums" ON gold_premiums FOR SELECT USING (true);

-- Allow full access for authenticated users
CREATE POLICY "Allow authenticated full access to gold_premiums" ON gold_premiums FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Allow authenticated full access to transactions" ON transactions FOR ALL USING (auth.role() = 'authenticated');

CREATE POLICY "Allow All Access" 
ON storage.objects 
FOR ALL
TO public
USING (bucket_id = 'transaction_assets'::text)
WITH CHECK (bucket_id = 'transaction_assets'::text);

-- Table: global_settings
CREATE TABLE IF NOT EXISTS global_settings (
  key TEXT PRIMARY KEY,
  value NUMERIC NOT NULL
);

-- Insert default silver deduction (13%)
INSERT INTO global_settings (key, value) VALUES ('silver_deduction', 13) ON CONFLICT (key) DO NOTHING;

-- Setup RLS for global_settings
ALTER TABLE global_settings ENABLE ROW LEVEL SECURITY;

-- Allow public read access
CREATE POLICY "Allow public read access to global_settings" ON global_settings FOR SELECT USING (true);

-- Allow authenticated full access
CREATE POLICY "Allow authenticated full access to global_settings" ON global_settings FOR ALL USING (auth.role() = 'authenticated');

-- Table: drawer_balance
CREATE TABLE IF NOT EXISTS drawer_balance (
  id INTEGER PRIMARY KEY DEFAULT 1,
  b1000 INTEGER DEFAULT 0,
  b500 INTEGER DEFAULT 0,
  b100 INTEGER DEFAULT 0,
  b50 INTEGER DEFAULT 0,
  b20 INTEGER DEFAULT 0,
  c10 INTEGER DEFAULT 0,
  c5 INTEGER DEFAULT 0,
  c2 INTEGER DEFAULT 0,
  c1 INTEGER DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Insert initial balance record
INSERT INTO drawer_balance (id, b1000, b500, b100, b50, b20, c10, c5, c2, c1) 
VALUES (1, 0, 0, 0, 0, 0, 0, 0, 0, 0) 
ON CONFLICT (id) DO NOTHING;

-- Setup RLS
ALTER TABLE drawer_balance ENABLE ROW LEVEL SECURITY;

-- Allow authenticated full access to drawer_balance
CREATE POLICY "Allow authenticated full access to drawer_balance" ON drawer_balance FOR ALL USING (auth.role() = 'authenticated');

-- Table: drawer_logs
CREATE TABLE IF NOT EXISTS drawer_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  old_balance JSONB,
  new_balance JSONB,
  reference_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Setup RLS
ALTER TABLE drawer_logs ENABLE ROW LEVEL SECURITY;

-- Allow authenticated full access to drawer_logs
CREATE POLICY "Allow authenticated full access to drawer_logs" ON drawer_logs FOR ALL USING (auth.role() = 'authenticated');