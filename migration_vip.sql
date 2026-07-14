ALTER TABLE gold_premiums ADD COLUMN IF NOT EXISTS premium_amount_vip NUMERIC DEFAULT 0;
ALTER TABLE gold_premiums ADD COLUMN IF NOT EXISTS premium_percent_vip NUMERIC DEFAULT 0;
ALTER TABLE gold_premiums ADD COLUMN IF NOT EXISTS premium_amount_vvip NUMERIC DEFAULT 0;
ALTER TABLE gold_premiums ADD COLUMN IF NOT EXISTS premium_percent_vvip NUMERIC DEFAULT 0;

CREATE TABLE IF NOT EXISTS customers (
  id_card TEXT PRIMARY KEY,
  customer_name TEXT,
  tier TEXT DEFAULT 'normal',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public read access to customers" ON customers FOR SELECT USING (true);
CREATE POLICY "Allow authenticated full access to customers" ON customers FOR ALL USING (auth.role() = 'authenticated');
