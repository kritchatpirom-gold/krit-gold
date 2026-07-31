-- Table: price_edit_requests
CREATE TABLE IF NOT EXISTS price_edit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status TEXT DEFAULT 'pending', -- 'pending', 'approved', 'rejected', 'completed'
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now()),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Setup RLS
ALTER TABLE price_edit_requests ENABLE ROW LEVEL SECURITY;

-- Allow public read/write access so employees can request and admins can approve
CREATE POLICY "Allow public full access to price_edit_requests" ON price_edit_requests FOR ALL USING (true);

-- Enable real-time for this table
alter publication supabase_realtime add table price_edit_requests;
