
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Try to load from .env or .env.local
dotenv.config({ path: path.join(process.cwd(), '.env.local') });
dotenv.config({ path: path.join(process.cwd(), '.env') });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

console.log('Testing Supabase Connection...');
console.log('URL:', url);
console.log('Key exists:', !!key);

if (!url || !key) {
    console.error('Missing environment variables.');
    process.exit(1);
}

const supabase = createClient(url, key);

async function test() {
    console.log('Fetching system_settings...');
    const { data, error } = await supabase
        .from('system_settings')
        .select('*')
        .limit(1);

    if (error) {
        console.error('Supabase Error:', error);
        if (typeof error.message === 'string' && error.message.includes('<!DOCTYPE html>')) {
            console.error('Detected HTML in error message (likely 502/504).');
        }
    } else {
        console.log('Success! Data:', data);
    }

    console.log('Testing general connectivity (auth.getSession)...');
    try {
        const { data: authData, error: authError } = await supabase.auth.getSession();
        if (authError) console.error('Auth Error:', authError);
        else console.log('Auth check success');
    } catch (e) {
        console.error('Auth exception:', e.message);
    }
}

test();
