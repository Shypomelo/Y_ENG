const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

const getEnv = (key) => {
    const match = envContent.match(new RegExp(`${key}=(.*)`));
    return match ? match[1].trim() : null;
};

const url = getEnv('NEXT_PUBLIC_SUPABASE_URL');
const key = getEnv('SUPABASE_SERVICE_ROLE_KEY');

async function probe() {
    if (!url || !key) {
        console.error('Missing URL or KEY');
        return;
    }
    const supabase = createClient(url, key);

    console.log('Probing daily_schedules table...');
    const { data, error } = await supabase.from('daily_schedules').select('*').limit(1);

    if (error) {
        console.error('Select failed:', error);
    } else if (data && data.length > 0) {
        console.log('Columns found:', Object.keys(data[0]));
    } else {
        console.log('No data found, trying to get columns from information_schema');
        const { data: cols, error: colError } = await supabase.rpc('get_table_columns', { table_name: 'daily_schedules' });
        if (colError) {
            console.error('RPC failed');
            // Try a direct SQL if possible or a trick
            const { data: trick, error: trickError } = await supabase.from('daily_schedules').insert({}).select();
            console.log('Insert trick result keys:', Object.keys(trick?.[0] || {}));
            console.log('Insert trick error:', trickError);
        } else {
            console.log('Columns from RPC:', cols);
        }
    }
}

probe();
