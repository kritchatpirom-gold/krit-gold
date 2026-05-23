CREATE POLICY "Allow authenticated full access to drawer_balance" ON drawer_balance FOR ALL USING (auth.role() = 'authenticated');
