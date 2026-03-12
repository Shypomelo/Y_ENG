import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testDelete() {
    console.log('Fetching an application to delete...');
    const { data: apps, error: fetchErr } = await supabase
        .from('daily_schedules')
        .select('*')
        .limit(1);

    if (fetchErr || !apps || apps.length === 0) {
        console.error('Fetch error or no apps:', fetchErr);
        return;
    }

    const appToDel = apps[0];
    console.log('Deleting app:', appToDel.id, appToDel.case_name);

    // Attempt Delete
    const { error: delErr } = await supabase
        .from('daily_schedules')
        .delete()
        .eq('id', appToDel.id);

    if (delErr) {
        console.error('DELETE ERROR:', JSON.stringify(delErr, null, 2));
    } else {
        console.log('Delete successful');
    }

    // Attempt Update Date = null (which is what acceptance might do)
    const { error: updErr } = await supabase
        .from('daily_schedules')
        .update({ schedule_date: null })
        .eq('id', appToDel.id);

    if (updErr) {
        console.error('UPDATE ERROR:', JSON.stringify(updErr, null, 2));
    } else {
        console.log('Update successful');
    }
}

testDelete();
