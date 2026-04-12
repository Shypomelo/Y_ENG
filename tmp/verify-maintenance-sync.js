const fs = require("fs");
const path = require("path");
const { execFileSync } = require("node:child_process");
const { chromium } = require(path.resolve(process.cwd(), "maintenance-probe", "node_modules", "playwright"));

const WORKSPACE = process.cwd();
const BROWSER_BASELINE_SCRIPT = path.resolve(WORKSPACE, "tmp", "report-crud-current-full-baseline.js");
const BROWSER_BASELINE_PATH = path.resolve(WORKSPACE, "tmp", "browser-north-pending-in-progress-all-time.normalized.json");
const VERIFICATION_OUTPUT_PATH = path.resolve(WORKSPACE, "tmp", "maintenance-sync-verification.json");
const VERIFY_URL = process.env.MAINTENANCE_VERIFY_URL || "http://localhost:3000/maintenance";
const COMPANY_CHROME_PORT = String(process.env.COMPANY_CHROME_PORT || "9230");
const SOURCE_SYSTEMS = {
  browser: "solargarden_report_crud",
  "firestore-readonly": "solargarden_firestore_readonly_browser_list",
};

function loadEnv(file) {
  if (!fs.existsSync(file)) return;
  const text = fs.readFileSync(file, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    value = value.replace(/\\n/g, "\n");
    if (!(key in process.env)) process.env[key] = value;
  }
}

function normalizeIssue(value) {
  return String(value || "").replace(/\s+/g, " ").trim().toLowerCase();
}

function formatIsoToBrowserReportTime(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return `${parts.year}/${parts.month}/${parts.day} ${parts.hour}:${parts.minute}`;
}

function formatSyncLabel(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleString("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

function makeCompareKey(row) {
  return [
    String(row.case_no || "").trim(),
    String(row.report_time || "").trim(),
    normalizeIssue(row.report_issue),
  ].join("::");
}

function countByStatus(rows, field) {
  return rows.reduce((acc, row) => {
    const value = String(row[field] || "").trim() || "(empty)";
    acc[value] = (acc[value] || 0) + 1;
    return acc;
  }, {});
}

function compareFieldSummary(browserRows, syncedRows, matchedKeys) {
  const browserByKey = new Map(browserRows.map((row) => [makeCompareKey(row), row]));
  const syncedByKey = new Map(syncedRows.map((row) => [makeCompareKey(row), row]));
  const fields = ["region", "work_date", "complete_date"];
  const summary = {};

  for (const field of fields) {
    let same = 0;
    let different = 0;
    for (const key of matchedKeys) {
      if ((browserByKey.get(key)?.[field] || "") === (syncedByKey.get(key)?.[field] || "")) {
        same += 1;
      } else {
        different += 1;
      }
    }
    summary[field] = { same, different };
  }

  return summary;
}

function readBrowserBaseline() {
  if (!fs.existsSync(BROWSER_BASELINE_PATH)) {
    throw new Error(`Browser baseline not found: ${BROWSER_BASELINE_PATH}`);
  }

  const parsed = JSON.parse(fs.readFileSync(BROWSER_BASELINE_PATH, "utf8"));
  const rows = Array.isArray(parsed.data) ? parsed.data : [];
  const meta = parsed.meta || {};
  return {
    path: BROWSER_BASELINE_PATH,
    generatedAt: meta.generatedAt || null,
    meta,
    rows,
    totalRows: rows.length,
    statusCounts: countByStatus(rows, "repair_status"),
  };
}

function rebuildBrowserBaseline() {
  execFileSync(process.execPath, [BROWSER_BASELINE_SCRIPT], {
    cwd: WORKSPACE,
    env: {
      ...process.env,
      COMPANY_CHROME_PORT,
    },
    stdio: "pipe",
  });

  return readBrowserBaseline();
}

async function queryDb() {
  loadEnv(path.resolve(WORKSPACE, ".env.local"));
  const { createAdminClient } = require("./maintenance-live-check/lib/supabase/admin.js");
  const { getSetting } = require("./maintenance-live-check/lib/repositories/settings.js");
  const supabase = createAdminClient();

  const syncStatus = await getSetting("maintenance_north_sync_status");
  const syncSource = syncStatus?.sync_source || "browser";
  const sourceSystem = SOURCE_SYSTEMS[syncSource] || SOURCE_SYSTEMS.browser;

  const [{ data, error }, reportsRes] = await Promise.all([
    supabase
    .from("external_maintenance_tickets")
    .select("id,source_system,source_region,source_case_name,source_case_no,source_report_time,source_report_issue,source_repair_status,source_work_date,source_complete_date,sync_status,last_seen_at,last_synced_at,updated_at")
    .eq("is_north", true)
    .eq("sync_status", "active")
    .eq("source_system", sourceSystem)
    .order("source_report_time", { ascending: false, nullsFirst: false }),
    supabase
      .from("maintenance_reports")
      .select("external_ticket_id,case_no,case_name,workflow_state"),
  ]);

  if (error) throw error;
  if (reportsRes.error) throw reportsRes.error;

  const activeRows = (data || []).map((row) => ({
    id: row.id,
    region: row.source_region || "",
    case_name: row.source_case_name || "",
    case_no: row.source_case_no || "",
    report_time: formatIsoToBrowserReportTime(row.source_report_time),
    report_issue: row.source_report_issue || "",
    repair_status: row.source_repair_status || "",
    work_date: row.source_work_date || "---",
    complete_date: row.source_complete_date || "",
    batch_marker: row.last_seen_at || row.updated_at || row.last_synced_at || null,
  }));

  const reports = reportsRes.data || [];
  const visibleRows = activeRows.filter((row) => {
    const matchedReport = reports.find((report) =>
      (report.external_ticket_id && report.external_ticket_id === row.id) ||
      (report.case_no && row.case_no && report.case_no.trim() === row.case_no.trim()) ||
      (report.case_name && row.case_name && report.case_name.trim() === row.case_name.trim()),
    );

    return matchedReport?.workflow_state !== "confirmed";
  });

  return {
    syncStatus: syncStatus || null,
    syncSource,
    sourceSystem,
    activeRows,
    visibleRows,
    activeCount: activeRows.length,
    visibleCount: visibleRows.length,
    statusCounts: countByStatus(activeRows, "repair_status"),
  };
}

async function triggerSyncAndReadPage() {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(VERIFY_URL, {
      waitUntil: "networkidle",
      timeout: 120000,
    });
    await page.waitForTimeout(4000);

    const manualSyncButton = page.locator('[data-testid="manual-sync-button"]');
    await manualSyncButton.waitFor({ state: "visible", timeout: 30000 });
    await manualSyncButton.click();
    await page.waitForTimeout(6000);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2000);

    return await page.evaluate(() => {
      const text = (selector) => document.querySelector(selector)?.textContent?.trim() || null;
      const caseNos = Array.from(document.querySelectorAll("span.font-mono"))
        .map((node) => node.textContent?.trim() || "")
        .filter(Boolean);

      return {
        syncLastTime: text('[data-testid="sync-last-time"]'),
        syncLastSuccessLabel: text('[data-testid="sync-last-success-label"]'),
        syncLastAttemptLabel: text('[data-testid="sync-last-attempt-label"]'),
        syncCountLabel: text('[data-testid="sync-count-label"]'),
        syncStatusBadge: text('[data-testid="sync-status-badge"]'),
        triggerLabel: text('[data-testid="sync-trigger-label"]'),
        needsRefreshCount: text('[data-testid="needs-refresh-count"]'),
        renderedCount: caseNos.length,
        renderedCaseNos: caseNos,
      };
    });
  } finally {
    await browser.close();
  }
}

function buildComparison(browserRows, syncedRows) {
  const browserByKey = new Map(browserRows.map((row) => [makeCompareKey(row), row]));
  const syncedByKey = new Map(syncedRows.map((row) => [makeCompareKey(row), row]));
  const browserKeys = new Set(browserByKey.keys());
  const syncedKeys = new Set(syncedByKey.keys());
  const matchingKeys = [...browserKeys].filter((key) => syncedKeys.has(key));
  const browserOnlyKeys = [...browserKeys].filter((key) => !syncedKeys.has(key));
  const syncedOnlyKeys = [...syncedKeys].filter((key) => !browserKeys.has(key));

  return {
    browserCount: browserRows.length,
    syncedCount: syncedRows.length,
    matchingCaseCount: matchingKeys.length,
    browserOnlyCount: browserOnlyKeys.length,
    syncedOnlyCount: syncedOnlyKeys.length,
    browserOnlyCases: browserOnlyKeys.map((key) => browserByKey.get(key)),
    syncedOnlyCases: syncedOnlyKeys.map((key) => syncedByKey.get(key)),
    fieldAgreementSummary: compareFieldSummary(browserRows, syncedRows, matchingKeys),
  };
}

(async () => {
  process.chdir(path.resolve(__dirname, ".."));

  const browserBaseline = rebuildBrowserBaseline();
  const page = await triggerSyncAndReadPage();
  const db = await queryDb();
  const comparison = buildComparison(browserBaseline.rows, db.activeRows);
  const expectedMainSyncTime = formatSyncLabel(db.syncStatus?.last_success_at || null);
  const expectedAttemptTime = formatSyncLabel(db.syncStatus?.last_sync_at || null);

  const anomalies = [];
  if (db.syncStatus?.status !== "success") {
    anomalies.push(`sync status is ${String(db.syncStatus?.status)} instead of success`);
  }
  if (comparison.browserOnlyCount > 0) {
    anomalies.push(`browserOnlyCount=${comparison.browserOnlyCount}`);
  }
  if (comparison.syncedOnlyCount > 0) {
    anomalies.push(`syncedOnlyCount=${comparison.syncedOnlyCount}`);
  }
  if (comparison.browserCount !== comparison.syncedCount) {
    anomalies.push(`browserCount(${comparison.browserCount}) != syncedCount(${comparison.syncedCount})`);
  }
  if (page.renderedCount !== db.visibleCount) {
    anomalies.push(`page.renderedCount(${page.renderedCount}) != visibleCount(${db.visibleCount})`);
  }
  if (page.syncLastTime !== expectedMainSyncTime) {
    anomalies.push(`page.sync-last-time(${page.syncLastTime}) != last_success_at(${expectedMainSyncTime})`);
  }
  if (page.syncLastAttemptLabel && expectedAttemptTime && !page.syncLastAttemptLabel.includes(expectedAttemptTime)) {
    anomalies.push(`page sync-last-attempt-label does not contain last_sync_at(${expectedAttemptTime})`);
  }

  const result = {
    checkedAt: new Date().toISOString(),
    mode: "browser-full-baseline-sync",
    browserBaseline: {
      path: browserBaseline.path,
      generatedAt: browserBaseline.generatedAt,
      totalRows: browserBaseline.totalRows,
      statusCounts: browserBaseline.statusCounts,
      meta: browserBaseline.meta,
    },
    db: {
      syncSource: db.syncSource,
      sourceSystem: db.sourceSystem,
      activeCount: db.activeCount,
      visibleCount: db.visibleCount,
      statusCounts: db.statusCounts,
      syncStatus: db.syncStatus,
    },
    page: {
      renderedCount: page.renderedCount,
      syncLastTime: page.syncLastTime,
      syncLastSuccessLabel: page.syncLastSuccessLabel,
      syncLastAttemptLabel: page.syncLastAttemptLabel,
      syncCountLabel: page.syncCountLabel,
      syncStatusBadge: page.syncStatusBadge,
      triggerLabel: page.triggerLabel,
      needsRefreshCount: page.needsRefreshCount,
    },
    comparison,
    freshnessIntegrity: {
      display_timestamp_source: "sync-last-time = maintenance_north_sync_status.last_success_at",
      attempt_timestamp_source: "sync-last-attempt-label = maintenance_north_sync_status.last_sync_at",
      pageMainTimeMatchesLastSuccessAt: page.syncLastTime === expectedMainSyncTime,
      pageAttemptTimeMatchesLastSyncAt: page.syncLastAttemptLabel
        ? page.syncLastAttemptLabel.includes(expectedAttemptTime || "")
        : null,
    },
    verdict: {
      ok: anomalies.length === 0,
      anomalies,
    },
  };

  fs.writeFileSync(VERIFICATION_OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");
  console.log(JSON.stringify({ outPath: VERIFICATION_OUTPUT_PATH, ...result }, null, 2));

  if (anomalies.length > 0) {
    process.exitCode = 1;
  }
})().catch((error) => {
  const failure = {
    checkedAt: new Date().toISOString(),
    error: error.message,
    stack: error.stack,
  };
  fs.writeFileSync(VERIFICATION_OUTPUT_PATH, JSON.stringify(failure, null, 2), "utf8");
  console.error(JSON.stringify(failure, null, 2));
  process.exit(1);
});
