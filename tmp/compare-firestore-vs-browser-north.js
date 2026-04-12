const fs = require("fs");
const path = require("path");

const OFFICIAL_BROWSER_BASELINE_PATH = path.join(
  process.cwd(),
  "tmp",
  "browser-north-pending-in-progress-all-time.normalized.json"
);
const HISTORICAL_IN_PROGRESS_SUBSET_PATH = path.join(
  process.cwd(),
  "maintenance-probe",
  "probe-output",
  "console",
  "north-reports.normalized.json"
);

const BROWSER_PATH =
  process.env.BROWSER_PATH || OFFICIAL_BROWSER_BASELINE_PATH;
const FIRESTORE_PATH =
  process.env.FIRESTORE_PATH || path.join(process.cwd(), "tmp", "firestore-north-reports.normalized.json");
const OUTPUT_PATH =
  process.env.OUTPUT_PATH || path.join(process.cwd(), "tmp", "firestore-vs-browser-north-compare.json");
const COMPARE_REPAIR_STATUS = (process.env.COMPARE_REPAIR_STATUS || "").trim();

const COMPARE_FIELDS = [
  "region",
  "case_name",
  "case_no",
  "report_time",
  "reporter",
  "report_issue",
  "monitor_staff",
  "monitor_judgement",
  "monitor_note",
  "repair_staff",
  "repair_note",
  "repair_status",
  "work_date",
  "complete_date",
];

const FIELD_SEMANTICS = {
  region: "browser list header = [territory] + short address",
  work_date: "browser list line 2 = repairEndDate || '---'",
  complete_date: 'browser list line 3 is not rendered, normalized as ""',
  browser_list_date_line2: "repairEndDate || '---'",
};

const BASELINE_LABELS = {
  officialBrowserFullBaseline: "north + pending + in-progress + all-time",
  historicalBrowserInProgressSubset: "north + in-progress + all-time (9-row subset)",
};

function loadJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
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

function filterRows(rows) {
  if (!COMPARE_REPAIR_STATUS) return rows;
  return rows.filter((row) => normalizeText(row.repair_status) === COMPARE_REPAIR_STATUS);
}

function countByRepairStatus(rows) {
  return rows.reduce((acc, row) => {
    const key = normalizeText(row.repair_status) || "(empty)";
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});
}

function compareRows(browserRow, firestoreRow) {
  const fieldMatches = [];
  const fieldDiffs = [];

  for (const field of COMPARE_FIELDS) {
    const browserValue =
      field === "report_issue" || field === "monitor_judgement"
        ? normalizeBracketed(browserRow[field])
        : normalizeText(browserRow[field]);
    const firestoreValue =
      field === "report_issue" || field === "monitor_judgement"
        ? normalizeBracketed(firestoreRow[field])
        : normalizeText(firestoreRow[field]);
    if (browserValue === firestoreValue) {
      fieldMatches.push(field);
    } else {
      fieldDiffs.push({
        field,
        browser: browserValue,
        firestore: firestoreValue,
      });
    }
  }

  return {
    case_no: browserRow.case_no || firestoreRow.case_no || "",
    case_name_browser: browserRow.case_name || "",
    case_name_firestore: firestoreRow.case_name || "",
    fieldMatches,
    fieldDiffs,
  };
}

function main() {
  const browserData = filterRows(loadJson(BROWSER_PATH).data || []);
  const firestoreData = filterRows(loadJson(FIRESTORE_PATH).data || []);

  const browserMap = new Map(browserData.map((row) => [buildRecordKey(row), row]));
  const firestoreMap = new Map(firestoreData.map((row) => [buildRecordKey(row), row]));

  const browserCaseNos = new Set([...browserMap.keys()].filter(Boolean));
  const firestoreCaseNos = new Set([...firestoreMap.keys()].filter(Boolean));

  const intersection = [...browserCaseNos].filter((caseNo) => firestoreCaseNos.has(caseNo)).sort();
  const browserOnly = [...browserCaseNos].filter((caseNo) => !firestoreCaseNos.has(caseNo)).sort();
  const firestoreOnly = [...firestoreCaseNos].filter((caseNo) => !browserCaseNos.has(caseNo)).sort();

  const rowComparisons = intersection.map((caseNo) =>
    compareRows(browserMap.get(caseNo), firestoreMap.get(caseNo))
  );

  const fieldAgreementSummary = {};
  for (const field of COMPARE_FIELDS) {
    fieldAgreementSummary[field] = {
      same: rowComparisons.filter((row) => row.fieldMatches.includes(field)).length,
      different: rowComparisons.filter((row) => row.fieldDiffs.some((diff) => diff.field === field)).length,
    };
  }

  const result = {
    generatedAt: new Date().toISOString(),
    compareKey: "case_no + report_time + normalized(report_issue)",
    compareRepairStatus: COMPARE_REPAIR_STATUS || null,
    compareView: "browser-list",
    fieldSemantics: FIELD_SEMANTICS,
    browserBaselineLabels: BASELINE_LABELS,
    browserPath: BROWSER_PATH,
    officialBrowserFullBaselinePath: OFFICIAL_BROWSER_BASELINE_PATH,
    historicalBrowserInProgressSubsetPath: HISTORICAL_IN_PROGRESS_SUBSET_PATH,
    firestorePath: FIRESTORE_PATH,
    browserCount: browserData.length,
    firestoreCount: firestoreData.length,
    browserStatusCounts: countByRepairStatus(browserData),
    firestoreStatusCounts: countByRepairStatus(firestoreData),
    matchingCaseNos: intersection,
    browserOnlyCaseNos: browserOnly,
    firestoreOnlyCaseNos: firestoreOnly,
    fieldAgreementSummary,
    rowComparisons,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2));
  console.log(
    JSON.stringify(
      {
        outputPath: OUTPUT_PATH,
        compareRepairStatus: result.compareRepairStatus,
        browserCount: result.browserCount,
        firestoreCount: result.firestoreCount,
        matchingCaseCount: result.matchingCaseNos.length,
        browserOnlyCount: result.browserOnlyCaseNos.length,
        firestoreOnlyCount: result.firestoreOnlyCaseNos.length,
        browserStatusCounts: result.browserStatusCounts,
        firestoreStatusCounts: result.firestoreStatusCounts,
      },
      null,
      2
    )
  );
}

main();
