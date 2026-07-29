const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://cjithgqbtwuxfxrauvax.supabase.co';
const supabaseKey = 'sb_publishable_lSgOgg-mkQ6cTOxnBe5ZBA_1Jt7nETG';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const { error } = await supabase.from('customers').upsert({
        id_card: '9999999999999',
        customer_name: 'Test Network',
        tier: 'network'
    });
    if (error) console.error("Error:", error.message);
    else {
        console.log("Success");
        await supabase.from('customers').delete().eq('id_card', '9999999999999');
    }
}
run();
