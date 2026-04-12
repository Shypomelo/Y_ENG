const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

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
  process.chdir(path.resolve(__dirname, '..', '..'));
  loadEnv(path.resolve(process.cwd(), '.env.local'));

  const actions = require('./app/maintenance/actions.js');
  const { createAdminClient } = require('./lib/supabase/admin.js');
  const supabase = createAdminClient();
  const snapshotPath = path.resolve(process.cwd(), 'tmp', 'browser-north-pending-in-progress-all-time.normalized.json');
  const snapshotRaw = fs.readFileSync(snapshotPath, 'utf8');
  const snapshot = JSON.parse(snapshotRaw);
  const stat = fs.statSync(snapshotPath);
  const digest = crypto.createHash('sha256').update(snapshotRaw).digest('hex');

  const before = await supabase
    .from('external_maintenance_tickets')
    .select('id, fallback_key, source_case_name, source_case_no, source_monitor_staff, source_monitor_judgement, source_monitor_note, source_repair_staff, source_repair_status, source_repair_note, source_work_date, source_complete_date, updated_at, last_synced_at')
    .eq('is_north', true)
    .order('source_report_time', { ascending: false })
    .limit(5);

  const sync = await actions.syncMaintenanceNorthReportsAction('manual');
  const pending = await actions.listMaintenanceNorthReportsAction();
  const status = await actions.getMaintenanceNorthSyncStatusAction();

  const after = await supabase
    .from('external_maintenance_tickets')
    .select('id, fallback_key, source_case_name, source_case_no, source_monitor_staff, source_monitor_judgement, source_monitor_note, source_repair_staff, source_repair_status, source_repair_note, source_work_date, source_complete_date, conflict_status, updated_at, last_synced_at')
    .eq('is_north', true)
    .order('source_report_time', { ascending: false })
    .limit(5);

  const result = {
    snapshot: {
      path: snapshotPath,
      mtime: stat.mtime.toISOString(),
      size: stat.size,
      sha256: digest,
      meta: snapshot.meta,
      first_rows: (snapshot.data || []).slice(0, 3),
    },
    before_error: before.error && { message: before.error.message, code: before.error.code },
    before_rows: before.data,
    sync,
    status,
    after_error: after.error && { message: after.error.message, code: after.error.code },
    after_rows: after.data,
    pending_sample: pending.slice(0, 5),
  };

  console.log(JSON.stringify(result, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({
    error: error.message,
    stack: error.stack,
  }, null, 2));
  process.exit(1);
});
