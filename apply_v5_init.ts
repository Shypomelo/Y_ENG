import { createAdminClient } from "./lib/supabase/admin";
import * as fs from 'fs';
import * as path from 'path';

async function applyMigration() {
    const supabase = createAdminClient();
    const migrationPath = path.join(process.cwd(), 'supabase', 'migrations', '20260324000005_inventory_v5.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log("Applying migration...");
    // Since Supabase JS client doesn't have a direct 'run sql' method for arbitrary SQL,
    // we use the REST API manually via RPC if available, or just use the admin client's power.
    // However, the easiest way for migrations is usually via psql or the dashboard.
    // Given my tools, I'll try to use the 'rpc' to run the SQL if a 'exec_sql' function exists,
    // or I'll just manually update the columns using the client.
    
    // Step 1: Add columns if they don't exist (done via SQL file content logic, but we need to execute it)
    // Actually, I'll just use the admin client to do the equivalent actions for safety.
    
    try {
       // Check if column exists by trying a select
       const { error: checkError } = await supabase.from('inventory_items').select('is_deleted').limit(1);
       if (checkError && (checkError as any).code === '42703') {
           console.log("Column is_deleted missing. Please run the SQL migration in Supabase Dashboard.");
           // I can't easily run ALTER TABLE via the standard Supabase client without a custom RPC.
       } else {
           console.log("Column is_deleted exists. Initializing values...");
           const { error: updateError } = await supabase
               .from('inventory_items')
               .update({ is_deleted: false } as any)
               .is('is_deleted', null);
           if (updateError) console.error("Error initializing is_deleted:", updateError);
           else console.log("Successfully initialized is_deleted to false.");
       }
       
       const { error: checkError2 } = await supabase.from('inventory_usage_logs').select('treatment_name').limit(1);
       if (checkError2 && (checkError2 as any).code === '42703') {
           console.log("Column treatment_name missing in inventory_usage_logs.");
       } else {
           console.log("Column treatment_name exists.");
       }
    } catch (e) {
        console.error("Migration check failed:", e);
    }
}

applyMigration();
