import { createAdminClient } from './lib/supabase/admin';

async function checkTables() {
    const supabase = createAdminClient();
    
    console.log('--- Checking inventory_master ---');
    const { data: master, error: masterError } = await supabase.from('inventory_master').select('*').limit(1);
    console.log('Master Error:', masterError);
    
    console.log('--- Checking inventory_movements ---');
    const { data: movements, error: movementsError } = await supabase.from('inventory_movements').select('*').limit(1);
    console.log('Movements Error:', movementsError);
    
    console.log('--- Checking maintenance_reports status column ---');
    const { data: reports, error: reportsError } = await supabase.from('maintenance_reports').select('status').limit(1);
    console.log('Reports Error:', reportsError);
}

checkTables();
