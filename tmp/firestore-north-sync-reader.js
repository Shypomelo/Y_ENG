const fs = require("fs");
const path = require("path");

const FIREBASE_API_KEY =
  process.env.FIREBASE_API_KEY || "AIzaSyAM9Pzx8rZnZwS5CcBHaz9uziqJ1kmFdC8";
const FIREBASE_PROJECT_ID =
  process.env.FIREBASE_PROJECT_ID || "solargarden-web-prod";
const FIREBASE_APP_ID =
  process.env.FIREBASE_APP_ID || "1:922703462491:web:2557c83ecb316a50333f7e";

const EMAIL = process.env.FIREBASE_EMAIL || process.env.COMPANY_EMAIL || null;
const PASSWORD =
  process.env.FIREBASE_PASSWORD || process.env.COMPANY_PASSWORD || null;

const TARGET_TERRITORY = process.env.FIRESTORE_TARGET_TERRITORY || "\u5317\u5340";
const REPAIR_STATUS_FILTERS = (
  process.env.FIRESTORE_REPAIR_STATUSES ||
  process.env.FIRESTORE_REPAIR_STATUS ||
  process.env.FIRESTORE_INCLUDE_STATUSES ||
  "\u5f85\u8655\u7406,\u8655\u7406\u4e2d"
)
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const SOURCE_JSON_PATH = (process.env.SOURCE_JSON_PATH || "").trim();
const OPERATIONS_CAPTURE_PATH =
  process.env.OPERATIONS_CAPTURE_PATH ||
  path.join(process.cwd(), "tmp", "company-remote-firestore-interaction-capture.json");
const PROJECT_RECORDS_PATH =
  process.env.PROJECT_RECORDS_PATH ||
  path.join(process.cwd(), "maintenance-probe", "probe-output", "console", "project-records.normalized.json");
const BROWSER_LOOKUP_PATH =
  process.env.BROWSER_LOOKUP_PATH ||
  path.join(process.cwd(), "maintenance-probe", "probe-output", "console", "north-reports.normalized.json");
const OPERATIONS_SCAN_LIMIT = Number(process.env.FIRESTORE_OPERATIONS_SCAN_LIMIT || 0);
const OPERATIONS_PAGE_SIZE = Number(process.env.FIRESTORE_OPERATIONS_PAGE_SIZE || 100);
const LOGS_PAGE_SIZE = Number(process.env.FIRESTORE_LOGS_PAGE_SIZE || 100);

const OUTPUT_PATH =
  process.env.OUTPUT_PATH ||
  path.join(process.cwd(), "tmp", "firestore-north-reports.normalized.json");

async function postJson(url, body, extraHeaders = {}) {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { ok: response.ok, status: response.status, json, text };
}

async function getJson(url, headers = {}) {
  const response = await fetch(url, { headers });
  const text = await response.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {}

  return { ok: response.ok, status: response.status, json, text };
}

function decodeFirestoreValue(value) {
  if (!value || typeof value !== "object") return null;
  if ("stringValue" in value) return value.stringValue;
  if ("integerValue" in value) return String(value.integerValue);
  if ("doubleValue" in value) return String(value.doubleValue);
  if ("booleanValue" in value) return Boolean(value.booleanValue);
  if ("timestampValue" in value) return value.timestampValue;
  if ("nullValue" in value) return null;
  if ("mapValue" in value) {
    const fields = value.mapValue?.fields || {};
    const mapped = {};
    for (const [key, nested] of Object.entries(fields)) {
      mapped[key] = decodeFirestoreValue(nested);
    }
    return mapped;
  }
  if ("arrayValue" in value) {
    return (value.arrayValue?.values || []).map(decodeFirestoreValue);
  }
  return null;
}

function decodeFirestoreFields(fields = {}) {
  const decoded = {};
  for (const [key, value] of Object.entries(fields)) {
    decoded[key] = decodeFirestoreValue(value);
  }
  return decoded;
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function normalizeBracketed(value) {
  const text = normalizeText(value).replace(/^\[|\]$/g, "");
  return text ? `[${text}]` : "";
}

function buildRecordKey(row) {
  const caseNo = normalizeText(row.case_no);
  const reportTime = normalizeText(row.report_time);
  const reportIssue = normalizeBracketed(row.report_issue);
  return [caseNo, reportTime, reportIssue].join("||");
}

function formatTimestampToTaipei(value) {
  if (!value) return "---";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "---";

  const parts = new Intl.DateTimeFormat("zh-TW", {
    timeZone: "Asia/Taipei",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((part) => part.type === type)?.value || "";
  return `${get("year")}/${get("month")}/${get("day")} ${get("hour")}:${get("minute")}`;
}

function normalizeDateOnly(value, emptyFallback = "---") {
  const text = String(value || "").trim();
  if (!text || text === "---") return emptyFallback;

  const match = text.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return text;

  const [, year, month, day] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function formatCategory(value) {
  const text = normalizeText(value);
  return text ? `[${text}]` : "";
}

function joinRepairStaff(fields = {}) {
  const parts = [];
  for (let index = 1; index <= 6; index += 1) {
    const value = normalizeText(fields[`repairman${index}`]);
    if (value && value !== "---") {
      parts.push(value);
    }
  }
  return parts.length > 0 ? parts.join(", ") : "---";
}

function shortenAddress(address) {
  const rawAddress = String(address || "").trim();
  if (rawAddress.length >= 5) {
    return `${rawAddress[0]}${rawAddress[1]}${rawAddress[3]}${rawAddress[4]}`;
  }
  return rawAddress || "\u672a\u586b";
}

function extractTerritoryFromRow(row) {
  const direct = normalizeText(row.territory);
  if (direct) return direct;

  const fromRegion = normalizeText(row.region).replace(/^\[|\]$/g, "");
  if (!fromRegion) return TARGET_TERRITORY;
  if (!fromRegion.startsWith("[")) {
    return fromRegion.split("]")[0].replace(/^\[/, "").trim() || TARGET_TERRITORY;
  }
  return TARGET_TERRITORY;
}

function formatRegionFromParts(territory, address) {
  const cleanTerritory = normalizeText(territory) || TARGET_TERRITORY;
  const shortAddress = shortenAddress(address);
  return shortAddress ? `[${cleanTerritory}] ${shortAddress}` : `[${cleanTerritory}]`;
}

function formatRegion(projectFields = {}) {
  return formatRegionFromParts(projectFields.territory, projectFields.address);
}

function getListDateLine2FromFields(fields = {}) {
  return normalizeDateOnly(fields.repairEndDate, "---");
}

function getListDateLine2FromRow(row = {}) {
  return normalizeDateOnly(
    row.browser_list_date_line2 || row.complete_date || row.work_date,
    "---"
  );
}

function buildRowFromFirestore(project, log) {
  const repairStatus = normalizeText(log.fields.repairStatus) || "\u5f85\u8655\u7406";
  const browserListDateLine2 = getListDateLine2FromFields(log.fields);

  return {
    region: formatRegion(project.fields),
    case_name: log.fields.projectName || project.fields.projectName || "",
    case_no: log.fields.projectNumber || project.fields.projectNumber || "",
    report_time: formatTimestampToTaipei(log.fields.timestamp),
    reporter: log.fields.user || "",
    report_issue: formatCategory(log.fields.category),
    monitor_staff: log.fields.monitor || "",
    monitor_judgement: formatCategory(log.fields.error),
    monitor_note: log.fields.monitorNote || "",
    repair_staff: joinRepairStaff(log.fields),
    repair_note: log.fields.repairNote || "",
    repair_status: repairStatus,
    work_date: browserListDateLine2,
    complete_date: "",
    browser_list_date_line2: browserListDateLine2,
    source_projectDocId: project.id,
    source_logDocId: log.id,
    source_fields: Object.keys(log.fields).sort(),
    source_address: project.fields.address || "",
    source_repairStartDate: normalizeDateOnly(log.fields.repairStartDate, ""),
    source_repairEndDate: normalizeDateOnly(log.fields.repairEndDate, ""),
    _timestamp: log.fields.timestamp || "",
  };
}

function buildRowFromSnapshot(row, targetTerritory) {
  const repairStatus = normalizeText(row.repair_status) || "\u5f85\u8655\u7406";
  const territory = targetTerritory || extractTerritoryFromRow(row);
  const browserListDateLine2 = getListDateLine2FromRow(row);
  const resolvedRegion = row.source_address
    ? formatRegionFromParts(territory, row.source_address)
    : normalizeText(row.region) || `[${territory}]`;

  return {
    ...row,
    region: resolvedRegion,
    report_issue: normalizeBracketed(row.report_issue),
    monitor_judgement: normalizeBracketed(row.monitor_judgement),
    repair_status: repairStatus,
    work_date: browserListDateLine2,
    complete_date: "",
    browser_list_date_line2: browserListDateLine2,
    _timestamp: row._timestamp || row.report_time || "",
  };
}

function loadOperationLookupFromCapture(capturePath) {
  if (!capturePath || !fs.existsSync(capturePath)) {
    return new Map();
  }

  const capture = JSON.parse(fs.readFileSync(capturePath, "utf8"));
  const responseHits = Array.isArray(capture.responseHits) ? capture.responseHits : [];
  const docs = new Map();
  const regex =
    /"document"\s*:\s*\{\s*"name"\s*:\s*"[^"]*\/documents\/operations\/([^"]+)"\s*,\s*"fields"\s*:\s*(\{[\s\S]*?\})\s*,\s*"createTime"/g;

  for (const hit of responseHits) {
    const bodyText = typeof hit.bodyText === "string" ? hit.bodyText : "";
    let match;
    while ((match = regex.exec(bodyText)) !== null) {
      const [, docId, fieldsJson] = match;
      if (docs.has(docId)) continue;
      try {
        const rawFields = JSON.parse(fieldsJson);
        docs.set(docId, decodeFirestoreFields(rawFields));
      } catch {}
    }
  }

  return docs;
}

function loadProjectLookup(projectRecordsPath) {
  if (!projectRecordsPath || !fs.existsSync(projectRecordsPath)) {
    return new Map();
  }

  const source = JSON.parse(fs.readFileSync(projectRecordsPath, "utf8"));
  return new Map(
    (source.data || []).map((row) => [
      normalizeText(row.case_no),
      {
        address: row.address || "",
        region: row.region || "",
      },
    ])
  );
}

function loadBrowserLookup(browserPath) {
  if (!browserPath || !fs.existsSync(browserPath)) {
    return new Map();
  }

  const source = JSON.parse(fs.readFileSync(browserPath, "utf8"));
  return new Map((source.data || []).map((row) => [buildRecordKey(row), row]));
}

function createEmptyResult() {
  return {
    meta: {
      type: "reports",
      view: "browser-list",
      source: SOURCE_JSON_PATH ? "firestore-direct-snapshot-remap" : "firestore-direct",
      target_territory: TARGET_TERRITORY,
      repair_status_filters: REPAIR_STATUS_FILTERS,
      totalRows: 0,
      timestamp: new Date().toISOString(),
      scanned_operations: 0,
      scanned_north_operations: 0,
      status_counts: {},
      format_rules: {
        region: "[territory] + short address (same rule as browser list header)",
        work_date: "browser list line 2 = repairEndDate || '---'",
        complete_date: 'browser list line 3 is not rendered, normalized as ""',
        browser_list_date_line2: "repairEndDate || '---'",
      },
      field_semantics: {
        region: "browser list header = [territory] + short address",
        work_date: "aligned to browser list line 2, not Firestore repairStartDate",
        complete_date: 'kept empty to match browser normalized list output ""',
        browser_list_date_line2: "repairEndDate || '---'",
        source_repairStartDate: "kept only as source evidence; not mapped to browser list date line 2",
      },
      limitations: {
        writeback: "not implemented here",
      },
    },
    data: [],
    debug: {
      matched_project_ids: [],
    },
  };
}

function finalizeResult(result, rows, sortByTimestamp = true) {
  if (sortByTimestamp) {
    rows.sort((a, b) => {
      const aTime = new Date(a._timestamp).getTime();
      const bTime = new Date(b._timestamp).getTime();
      return bTime - aTime;
    });
  }

  for (const row of rows) {
    result.meta.status_counts[row.repair_status] =
      (result.meta.status_counts[row.repair_status] || 0) + 1;
    delete row._timestamp;
  }

  result.data = rows;
  result.meta.totalRows = rows.length;
  return result;
}

function loadFromSnapshot(snapshotPath) {
  const source = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
  const operationLookup = loadOperationLookupFromCapture(OPERATIONS_CAPTURE_PATH);
  const projectLookup = loadProjectLookup(PROJECT_RECORDS_PATH);
  const browserLookup = loadBrowserLookup(BROWSER_LOOKUP_PATH);
  const rows = (source.data || [])
    .filter((row) => REPAIR_STATUS_FILTERS.includes(normalizeText(row.repair_status)))
    .map((row) => {
      const operation = operationLookup.get(row.source_projectDocId) || {};
      const projectRecord = projectLookup.get(normalizeText(row.case_no)) || {};
      const browserRow = browserLookup.get(buildRecordKey(row)) || {};
      return buildRowFromSnapshot(
        {
          ...row,
          territory: row.territory || operation.territory || source.meta?.target_territory || TARGET_TERRITORY,
          source_address: row.source_address || operation.address || projectRecord.address || "",
          region: browserRow.region || row.region || "",
        },
        source.meta?.target_territory || TARGET_TERRITORY
      );
    });

  const result = createEmptyResult();
  result.meta.scanned_operations = source.meta?.scanned_operations || 0;
  result.meta.scanned_north_operations = source.meta?.scanned_north_operations || rows.length;
  result.meta.derived_from = snapshotPath;
  return finalizeResult(result, rows, false);
}

async function signInWithPassword() {
  if (!EMAIL || !PASSWORD) {
    throw new Error("Missing FIREBASE_EMAIL/FIREBASE_PASSWORD.");
  }

  const response = await postJson(
    `https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${encodeURIComponent(
      FIREBASE_API_KEY
    )}`,
    {
      email: EMAIL,
      password: PASSWORD,
      returnSecureToken: true,
    }
  );

  if (!response.ok || !response.json?.idToken) {
    throw new Error(response.json?.error?.message || `Firebase sign-in failed (${response.status})`);
  }

  return response.json.idToken;
}

async function listOperationsPage(idToken, pageToken = null) {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/operations`
  );
  url.searchParams.set("pageSize", String(OPERATIONS_PAGE_SIZE));
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  return getJson(url.toString(), {
    authorization: `Bearer ${idToken}`,
    "x-firebase-gmpid": FIREBASE_APP_ID,
  });
}

async function listLogsPageWithToken(idToken, projectDocId, pageToken = null) {
  const url = new URL(
    `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      FIREBASE_PROJECT_ID
    )}/databases/(default)/documents/operations/${encodeURIComponent(projectDocId)}/logs`
  );
  url.searchParams.set("pageSize", String(LOGS_PAGE_SIZE));
  if (pageToken) {
    url.searchParams.set("pageToken", pageToken);
  }

  return getJson(url.toString(), {
    authorization: `Bearer ${idToken}`,
    "x-firebase-gmpid": FIREBASE_APP_ID,
  });
}

async function listAllLogs(idToken, projectDocId) {
  const logs = [];
  let pageToken = null;

  do {
    const page = await listLogsPageWithToken(idToken, projectDocId, pageToken);
    if (!page.ok) {
      return { ok: false, page, logs };
    }

    logs.push(...(page.json?.documents || []));
    pageToken = page.json?.nextPageToken || null;
  } while (pageToken);

  return { ok: true, logs };
}

async function loadFromFirestore() {
  const result = createEmptyResult();
  const idToken = await signInWithPassword();

  const operations = [];
  let pageToken = null;

  do {
    const page = await listOperationsPage(idToken, pageToken);
    if (!page.ok) {
      throw new Error(page.json?.error?.message || `Failed to read operations (${page.status})`);
    }

    const docs = page.json?.documents || [];
    operations.push(...docs);
    pageToken = page.json?.nextPageToken || null;
  } while (pageToken && (OPERATIONS_SCAN_LIMIT <= 0 || operations.length < OPERATIONS_SCAN_LIMIT));

  result.meta.scanned_operations = operations.length;

  const northOperations = operations
    .map((doc) => ({
      id: doc.name.split("/").pop(),
      fields: decodeFirestoreFields(doc.fields || {}),
    }))
    .filter((project) => normalizeText(project.fields.territory) === TARGET_TERRITORY);

  result.meta.scanned_north_operations = northOperations.length;

  const rows = [];

  for (const project of northOperations) {
    const logsResult = await listAllLogs(idToken, project.id);
    if (!logsResult.ok) {
      continue;
    }

    const logs = logsResult.logs.map((doc) => ({
      id: doc.name.split("/").pop(),
      fields: decodeFirestoreFields(doc.fields || {}),
    }));

    const filteredLogs = logs.filter((log) => {
      const repairStatus = normalizeText(log.fields.repairStatus) || "\u5f85\u8655\u7406";
      return REPAIR_STATUS_FILTERS.includes(repairStatus);
    });

    if (filteredLogs.length > 0) {
      result.debug.matched_project_ids.push(project.id);
    }

    for (const log of filteredLogs) {
      rows.push(buildRowFromFirestore(project, log));
    }
  }

  return finalizeResult(result, rows, true);
}

async function main() {
  const result = SOURCE_JSON_PATH ? loadFromSnapshot(SOURCE_JSON_PATH) : await loadFromFirestore();

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        outputPath: OUTPUT_PATH,
        totalRows: result.meta.totalRows,
        scannedOperations: result.meta.scanned_operations,
        scannedNorthOperations: result.meta.scanned_north_operations,
        matchedProjectIds: result.debug.matched_project_ids.length,
        statusCounts: result.meta.status_counts,
        repairStatusFilters: REPAIR_STATUS_FILTERS,
        source: result.meta.source,
        derivedFrom: result.meta.derived_from || null,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
