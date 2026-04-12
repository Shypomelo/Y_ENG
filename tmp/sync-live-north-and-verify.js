const fs = require('fs');
const path = require('path');

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, 'utf8');
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, '\n');
    if (!(key in process.env)) process.env[key] = value;
  }
}

(async () => {
  process.chdir(path.resolve(__dirname, '..'));
  loadEnv(path.resolve(process.cwd(), '.env.local'));

  const actions = require('./maintenance-live-check/app/maintenance/actions.js');
  const { createAdminClient } = require('./maintenance-live-check/lib/supabase/admin.js');
  const supabase = createAdminClient();

  const snapshotPath = path.resolve(process.cwd(), 'tmp', 'browser-north-pending-in-progress-all-time.normalized.json');
  const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8').replace(/^\uFEFF/, '');
  const snapshot = JSON.parse(snapshotRaw);
  fs.writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf8');

  const sync = await actions.syncMaintenanceNorthReportsAction('manual');
  const status = await actions.getMaintenanceNorthSyncStatusAction();
  const pending = await actions.listMaintenanceNorthReportsAction();

  const totalRes = await supabase
    .from('external_maintenance_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('is_north', true)
    .eq('sync_status', 'active');

  const latestRes = await supabase
    .from('external_maintenance_tickets')
    .select('last_synced_at, updated_at')
    .eq('is_north', true)
    .eq('sync_status', 'active')
    .order('last_synced_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const rowsRes = await supabase
    .from('external_maintenance_tickets')
    .select('id,fallback_key,source_region,source_case_name,source_case_no,source_report_time,source_reporter,source_monitor_staff,source_monitor_judgement,source_monitor_note,source_repair_status,source_repair_staff,source_repair_note,source_work_date,source_complete_date')
    .eq('is_north', true)
    .eq('sync_status', 'active')
    .order('source_report_time', { ascending: false, nullsFirst: false });

  if (totalRes.error) throw totalRes.error;
  if (latestRes.error) throw latestRes.error;
  if (rowsRes.error) throw rowsRes.error;

  const rows = rowsRes.data || [];
  const requiredCompleteCount = rows.filter((row) =>
    row.fallback_key &&
    row.source_region &&
    row.source_case_name &&
    row.source_case_no &&
    row.source_report_time
  ).length;

  const monitorRepairFieldCoverage = {
    source_monitor_staff: rows.filter((row) => row.source_monitor_staff).length,
    source_monitor_judgement: rows.filter((row) => row.source_monitor_judgement).length,
    source_monitor_note: rows.filter((row) => row.source_monitor_note).length,
    source_repair_status: rows.filter((row) => row.source_repair_status).length,
    source_repair_staff: rows.filter((row) => row.source_repair_staff).length,
    source_repair_note: rows.filter((row) => row.source_repair_note).length,
    source_work_date: rows.filter((row) => row.source_work_date).length,
    source_complete_date: rows.filter((row) => row.source_complete_date).length,
  };

  console.log(JSON.stringify({
    snapshot: {
      totalRows: snapshot.meta?.totalRows ?? (snapshot.data || []).length,
      firstRows: (snapshot.data || []).slice(0, 5),
    },
    sync,
    status,
    db: {
      totalRows: totalRes.count || 0,
      latestSyncAt: latestRes.data?.last_synced_at || latestRes.data?.updated_at || null,
      requiredCompleteCount,
      monitorRepairFieldCoverage,
      sampleRows: rows.slice(0, 5),
    },
    maintenancePending: {
      count: pending.length,
      sample: pending.slice(0, 5),
    },
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({
    error: error.message,
    stack: error.stack,
  }, null, 2));
  process.exit(1);
});
