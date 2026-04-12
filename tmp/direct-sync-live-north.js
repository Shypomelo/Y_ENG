const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');

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

  const { createAdminClient } = require('./maintenance-live-check/lib/supabase/admin.js');
  const externalRepo = require('./maintenance-live-check/lib/repositories/external-maintenance-tickets.js');
  const settingsRepo = require('./maintenance-live-check/lib/repositories/settings.js');
  const { normalizeNorthReportRows } = require('./maintenance-live-check/lib/maintenance/external-ticket-normalizer.js');
  const { mergeExternalTicketsForUpsert } = require('./maintenance-live-check/lib/maintenance/external-ticket-merge.js');

  const supabase = createAdminClient();
  const snapshotPath = path.resolve(process.cwd(), 'tmp', 'browser-north-pending-in-progress-all-time.normalized.json');
  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const rawRows = Array.isArray(snapshot.data) ? snapshot.data : [];
  const normalizedRows = normalizeNorthReportRows(rawRows);
  const activeFallbackKeys = normalizedRows.map((row) => row.fallback_key);
  const existingRows = await externalRepo.listExternalTicketsByFallbackKeys(normalizedRows.map((row) => row.fallback_key));
  const mergedRows = mergeExternalTicketsForUpsert(normalizedRows, existingRows).map((row) => ({
    id: row.id || randomUUID(),
    ...row,
  }));
  const syncedRows = await externalRepo.upsertExternalTickets(mergedRows);

  const currentNorthRes = await supabase
    .from('external_maintenance_tickets')
    .select('id,fallback_key,source_case_no,source_case_name')
    .eq('is_north', true)
    .eq('source_system', 'solargarden_report_crud')
    .eq('sync_status', 'active');

  if (currentNorthRes.error) throw currentNorthRes.error;

  const staleRows = (currentNorthRes.data || []).filter((row) => !activeFallbackKeys.includes(row.fallback_key));

  const { count: needsRefreshCount, error: needsRefreshError } = await supabase
    .from('external_maintenance_tickets')
    .select('*', { count: 'exact', head: true })
    .eq('is_north', true)
    .eq('conflict_status', 'needs_refresh');

  if (needsRefreshError) throw needsRefreshError;

  const finishedAt = new Date().toISOString();
  const syncStatus = {
    status: 'success',
    last_sync_at: finishedAt,
    last_success_at: finishedAt,
    last_error: null,
    trigger: 'manual',
    synced_count: syncedRows.length,
    needs_refresh_count: needsRefreshCount || 0,
    source_of_truth: 'external',
    identity_mode: 'fallback_key',
  };

  await settingsRepo.updateSetting('maintenance_north_sync_status', syncStatus);

  const totalRes = await supabase
    .from('external_maintenance_tickets')
    .select('id', { count: 'exact', head: true })
    .eq('is_north', true)
    .eq('sync_status', 'active');

  const latestRes = await supabase
    .from('external_maintenance_tickets')
    .select('last_synced_at,updated_at')
    .eq('is_north', true)
    .eq('sync_status', 'active')
    .order('last_synced_at', { ascending: false, nullsFirst: false })
    .limit(1)
    .maybeSingle();

  const rowsRes = await supabase
    .from('external_maintenance_tickets')
    .select('id,fallback_key,source_region,source_case_name,source_case_no,source_report_time,source_reporter,source_monitor_staff,source_monitor_judgement,source_monitor_note,source_repair_status,source_repair_staff,source_repair_note,source_work_date,source_complete_date,conflict_status')
    .eq('is_north', true)
    .eq('sync_status', 'active')
    .order('source_report_time', { ascending: false, nullsFirst: false });

  if (totalRes.error) throw totalRes.error;
  if (latestRes.error) throw latestRes.error;
  if (rowsRes.error) throw rowsRes.error;

  console.log(JSON.stringify({
    snapshot: {
      totalRows: rawRows.length,
      firstRows: rawRows.slice(0, 5),
    },
    syncStatus,
    db: {
      totalRows: totalRes.count || 0,
      latestSyncAt: latestRes.data?.last_synced_at || latestRes.data?.updated_at || null,
      staleDeactivated: staleRows,
      sampleRows: rowsRes.data.slice(0, 5),
    },
  }, null, 2));
})().catch((error) => {
  console.error(JSON.stringify({
    error: error.message,
    stack: error.stack,
  }, null, 2));
  process.exit(1);
});
