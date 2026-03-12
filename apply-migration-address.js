const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Read env vars from .env.local
const envPath = path.resolve(__dirname, '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
    console.log('Adding address column to daily_schedules...');
    const { error } = await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS address text;'
    });

    if (error) {
        // If exec_sql doesn't work, we might have to use another way or assume the user will run it.
        // But let's try a direct query if possible, though supabase-js doesn't support direct DDL easily.
        console.error('Migration error (likely missing RPC):', error);
        console.log('Applying via REST is not possible for DDL. Please run the SQL manually in Supabase SQL Editor:');
        console.log('ALTER TABLE public.daily_schedules ADD COLUMN IF NOT EXISTS address text;');
    } else {
        console.log('Migration successful!');
    }
}

applyMigration();
