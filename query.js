const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const envPath = '/Users/krit/.gemini/antigravity/scratch/kritgold/.env';
const envContent = fs.readFileSync(envPath, 'utf8');
let supabaseUrl = '';
let supabaseKey = '';
envContent.split('\n').forEach(line => {
    if (line.startsWith('VITE_SUPABASE_URL=')) supabaseUrl = line.split('=')[1].trim();
    if (line.startsWith('VITE_SUPABASE_ANON_KEY=')) supabaseKey = line.split('=')[1].trim();
});

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { data, error } = await supabase.from('gold_premiums').select('*').order('range_min', { ascending: true });
    if (error) console.error(error);
    else console.log(data);
}
run();
