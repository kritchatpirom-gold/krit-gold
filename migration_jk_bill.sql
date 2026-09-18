-- Migration for JK-Gold Bill Integration
ALTER TABLE gold_locks ADD COLUMN IF NOT EXISTS jk_bill_id TEXT;
ALTER TABLE gold_locks ADD COLUMN IF NOT EXISTS jk_bill_code TEXT;
ALTER TABLE gold_locks ADD COLUMN IF NOT EXISTS jk_bill_status TEXT;
ALTER TABLE gold_locks ADD COLUMN IF NOT EXISTS jk_type_id TEXT;

-- Settings for caching token and daily sequence counter
INSERT INTO global_settings (key, value, value_text) VALUES ('jk_gold_token', 0, '') ON CONFLICT (key) DO NOTHING;
INSERT INTO global_settings (key, value, value_text) VALUES ('jk_gold_daily_seq', 0, '') ON CONFLICT (key) DO NOTHING;
