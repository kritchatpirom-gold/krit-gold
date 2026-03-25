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
