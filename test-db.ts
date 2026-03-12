import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Parse .env.local manually
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: Record<string, string> = {};
envContent.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1].trim()] = match[2].trim();
});

const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing ANON_KEY or URL");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkRemote() {
    console.log("Checking todo_items...");
    try {
        const { data: todos, error: todosErr } = await supabase.from('todo_items').select('id').limit(1);
        if (todosErr) {
            console.error("❌ todo_items:", todosErr.message, todosErr.code);
        } else {
            console.log("✅ todo_items exists.");
        }
    } catch (e: any) {
        console.error("❌ todo_items exception:", e.message);
    }

    console.log("Checking system_settings...");
    try {
        const { data: settings, error: settingsErr } = await supabase.from('system_settings').select('id').limit(1);
        if (settingsErr) {
            console.error("❌ system_settings:", settingsErr.message, settingsErr.code);
        } else {
            console.log("✅ system_settings exists.");
        }
    } catch (e: any) {
        console.error("❌ system_settings exception:", e.message);
    }

    console.log("Checking daily_schedules...");
    try {
        const { data: schedules, error: schedulesErr } = await supabase.from('daily_schedules').select('id').limit(1);
        if (schedulesErr) {
            console.error("❌ daily_schedules:", schedulesErr.message, schedulesErr.code);
        } else {
            console.log("✅ daily_schedules exists.");
        }
    } catch (e: any) {
        console.error("❌ daily_schedules exception:", e.message);
    }
}

checkRemote();
