-- Table: attendance
CREATE TABLE IF NOT EXISTS attendance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  id_card TEXT NOT NULL,
  name TEXT NOT NULL,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  check_in_time TIME NOT NULL DEFAULT CURRENT_TIME,
  late_minutes INTEGER DEFAULT 0,
  deduction_amount NUMERIC DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc', now())
);

-- Setup RLS for attendance
ALTER TABLE attendance ENABLE ROW LEVEL SECURITY;

-- Allow read/write access for authenticated users
CREATE POLICY "Allow authenticated full access to attendance" ON attendance FOR ALL USING (auth.role() = 'authenticated');

-- Insert default late deduction rate (1 baht per minute)
INSERT INTO global_settings (key, value) VALUES ('late_deduction_rate', 1) ON CONFLICT (key) DO NOTHING;
