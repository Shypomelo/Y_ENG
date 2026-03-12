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

async function applyMigration() {
    if (!url || !key) {
        console.error('Missing URL or KEY');
        return;
    }
    const supabase = createClient(url, key);

    const sql = `
DO $$ 
BEGIN
    -- 1. Rename 'title' to 'case_name' if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='title') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_name') THEN
        ALTER TABLE public.daily_schedules RENAME COLUMN title TO case_name;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_name') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN case_name text NOT NULL DEFAULT '未命名案件';
    END IF;

    -- 2. Rename 'work_type' to 'case_type' if exists
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='work_type') 
       AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_type') THEN
        ALTER TABLE public.daily_schedules RENAME COLUMN work_type TO case_type;
    ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='case_type') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN case_type text;
    END IF;

    -- 3. Ensure 'address' column exists
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name='daily_schedules' AND column_name='address') THEN
        ALTER TABLE public.daily_schedules ADD COLUMN address text;
    END IF;

    -- 4. Update status check constraint if exists
    ALTER TABLE public.daily_schedules DROP CONSTRAINT IF EXISTS daily_schedules_status_check;
    ALTER TABLE public.daily_schedules ADD CONSTRAINT daily_schedules_status_check CHECK (status IN ('pending_claim', 'scheduled', 'done', 'cancelled', 'application'));

    -- 5. Notify PostgREST to reload schema
    NOTIFY pgrst, 'reload schema';
END $$;
`;

    console.log('Applying migration to rename columns...');
    const { error } = await supabase.rpc('exec_sql', { sql_query: sql });

    if (error) {
        console.error('Migration failed via RPC:', error);
        console.log('Please run the following SQL manually in Supabase SQL Editor:');
        console.log(sql);
    } else {
        console.log('Migration successfully applied!');
    }
}

applyMigration();
