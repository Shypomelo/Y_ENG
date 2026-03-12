import { createAdminClient } from './lib/supabase/admin';
import fs from 'fs';

async function verifyAllSchemas() {
    const supabase = createAdminClient();
    let report = "=== Comprehensive Schema Verification ===\n\n";

    const tables = ['daily_schedules', 'todo_items', 'system_settings', 'tasks', 'task_tracking'];

    for (const t of tables) {
        report += `--- Table: ${t} ---\n`;
        const { data, error } = await supabase.from(t).select('*').limit(1);

        if (error) {
            report += `Error/Absent: ${error.code} (${error.message})\n`;
        } else {
            report += `Status: PRESENT\n`;
            if (data.length > 0) {
                report += `Columns: ${Object.keys(data[0]).join(', ')}\n`;
            } else {
                // Try to get columns even if empty by looking at a non-existent column error or similar
                const { error: colErr } = await supabase.from(t).select('non_existent_column_for_probing');
                if (colErr && colErr.message.includes('column')) {
                    // Extract columns from message if possible, or just note we need to check types/database.ts
                    report += `Probing columns via error... (See types/database.ts for authoritative list)\n`;
                }
            }
        }
        report += "\n";
    }

    fs.writeFileSync('schema_alignment_probe.txt', report);
}

verifyAllSchemas().catch(console.error);
