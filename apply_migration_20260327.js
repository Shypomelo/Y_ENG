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
    const migrationFilePath = path.join(__dirname, 'supabase/migrations/20260327000000_refactor_maintenance_schema.sql');
    const sql_query = fs.readFileSync(migrationFilePath, 'utf8');

    console.log('Applying migration 20260327000000_refactor_maintenance_schema.sql...');
    
    const { error } = await supabase.rpc('exec_sql', {
        sql_query: sql_query
    });

    if (error) {
        console.error('Migration error:', error);
        console.log('If exec_sql is missing, please run the SQL manually in Supabase SQL Editor.');
    } else {
        console.log('Migration successful!');
    }
}

applyMigration();
