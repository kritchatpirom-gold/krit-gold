CREATE TABLE IF NOT EXISTS gold_targets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    merchant_email TEXT NOT NULL,
    merchant_name TEXT,
    target_price DECIMAL(10, 2) NOT NULL,
    weight_baht DECIMAL(10, 2) NOT NULL,
    type TEXT NOT NULL DEFAULT 'buy',
    status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'triggered', 'cancelled')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    triggered_at TIMESTAMP WITH TIME ZONE
);

-- Enable RLS
ALTER TABLE gold_targets ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Admin can do all on gold_targets" 
ON gold_targets FOR ALL 
USING (auth.jwt() ->> 'role' = 'admin' OR auth.jwt() ->> 'role' = 'employee');

CREATE POLICY "Merchants can read own targets" 
ON gold_targets FOR SELECT 
USING (auth.jwt() ->> 'email' = merchant_email);

CREATE POLICY "Merchants can insert own targets" 
ON gold_targets FOR INSERT 
WITH CHECK (auth.jwt() ->> 'email' = merchant_email);

CREATE POLICY "Merchants can update own active targets" 
ON gold_targets FOR UPDATE 
USING (auth.jwt() ->> 'email' = merchant_email AND status = 'active');
