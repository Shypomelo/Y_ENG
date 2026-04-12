const fs = require("fs");
const path = require("path");
const { chromium } = require(path.join(process.cwd(), "maintenance-probe", "node_modules", "playwright"));

const PORT = Number(process.env.COMPANY_CHROME_PORT || 9229);
const TARGET_URL = "https://solargarden-web-prod.web.app/sg_ops.html?view=report_crud";
const OUTPUT_PATH =
  process.env.OUTPUT_PATH || path.join(process.cwd(), "tmp", "report-crud-current-full-baseline.json");
const SNAPSHOT_PATH =
  process.env.SNAPSHOT_PATH ||
  path.join(process.cwd(), "tmp", "browser-north-pending-in-progress-all-time.normalized.json");

function splitLines(text) {
  return String(text || "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function safeNumber(value, fallback = 0) {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

async function waitForQueryIdle(page) {
  await page.waitForFunction(
    () => {
      const button = document.getElementById("run-filter-btn");
      return !button || !button.disabled;
    },
    { timeout: 30000 }
  );
  await page.waitForTimeout(1500);
}

async function extractState(page, label) {
  return page.evaluate((stateLabel) => {
    const splitLinesLocal = (text) =>
      String(text || "")
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);

    const safeNumberLocal = (value, fallback = 0) => {
      const num = Number(value);
      return Number.isFinite(num) ? num : fallback;
    };

    const checkedValues = (selector) =>
      Array.from(document.querySelectorAll(`${selector} input:checked`)).map((el) => el.value);

    const optionStates = (selector) =>
      Array.from(document.querySelectorAll(`${selector} input`)).map((el) => ({
        value: el.value,
        checked: el.checked,
        type: el.type || null,
      }));

    const errorCheckboxes = Array.from(document.querySelectorAll(".error-checkbox")).map((el) => ({
      value: el.value,
      checked: el.checked,
    }));

    const rows = Array.from(document.querySelectorAll("#reportDataList > tr")).map((tr, index) => {
      const cells = Array.from(tr.querySelectorAll("td")).map((td) => (td.innerText || td.textContent || "").trim());
      const caseLines = splitLinesLocal(cells[0] || "");
      const reportLines = splitLinesLocal(cells[1] || "");
      const monitorLines = splitLinesLocal(cells[2] || "");
      const repairLines = splitLinesLocal(cells[3] || "");
      const statusLines = splitLinesLocal(cells[4] || "");

      return {
        index,
        region: caseLines[0] || "",
        case_name: caseLines[1] || "",
        case_no: caseLines[2] || "",
        report_time: reportLines[0] || "",
        reporter: reportLines[1] || "",
        report_issue: reportLines[2] || "",
        monitor_staff: monitorLines[0] || "",
        monitor_judgement: monitorLines[1] || "",
        monitor_note: monitorLines.slice(2).join("\n"),
        repair_staff: repairLines[0] || "",
        repair_note: repairLines.slice(1).join("\n"),
        repair_status: statusLines[0] || "",
        work_date: statusLines[1] || "",
        complete_date: statusLines[2] || "",
        cell_case: cells[0] || "",
        cell_report: cells[1] || "",
        cell_monitor: cells[2] || "",
        cell_repair: cells[3] || "",
        cell_status: cells[4] || "",
      };
    });

    const countText = document.body.innerText.match(/共\s*(\d+)\s*筆記錄/);
    const reportCountText = (document.getElementById("reportCount")?.innerText || "").trim();

    return {
      label: stateLabel,
      checkedAt: new Date().toISOString(),
      url: location.href,
      title: document.title,
      totalRows: rows.length,
      countText: countText ? countText[0] : null,
      countValue: countText ? Number(countText[1]) : safeNumberLocal(reportCountText, rows.length),
      filters: {
        territories: checkedValues("#filter-territories"),
        statuses: checkedValues("#filter-statuses"),
        territoryOptions: optionStates("#filter-territories"),
        statusOptions: optionStates("#filter-statuses"),
        allTime: Boolean(document.getElementById("filter-all-time")?.checked),
        reportSearchInput: document.getElementById("reportSearchInput")?.value || "",
        searchprojectInput: document.getElementById("searchprojectInput")?.value || "",
        dateInputs: Array.from(document.querySelectorAll("input[type='date'], .flatpickr-input"))
          .map((el) => ({
            id: el.id || null,
            value: el.value || "",
            placeholder: el.getAttribute("placeholder") || "",
          }))
          .filter((item) => item.id || item.value || item.placeholder),
        errorCheckboxes,
        selectedErrorCount: errorCheckboxes.filter((item) => item.checked).length,
      },
      rows,
    };
  }, label);
}

async function applyNorthPendingAndInProgressAllTime(page) {
  await page.evaluate(() => {
    const setCheckedValues = (selector, values) => {
      const wanted = new Set(values);
      document.querySelectorAll(`${selector} input`).forEach((input) => {
        input.checked = wanted.has(input.value);
        input.dispatchEvent(new Event("change", { bubbles: true }));
      });
    };

    setCheckedValues("#filter-territories", ["北區"]);
    setCheckedValues("#filter-statuses", ["待處理", "處理中"]);

    const allTime = document.getElementById("filter-all-time");
    if (allTime) {
      allTime.checked = true;
      allTime.dispatchEvent(new Event("change", { bubbles: true }));
    }

    const reportSearchInput = document.getElementById("reportSearchInput");
    if (reportSearchInput) {
      reportSearchInput.value = "";
      reportSearchInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    const searchprojectInput = document.getElementById("searchprojectInput");
    if (searchprojectInput) {
      searchprojectInput.value = "";
      searchprojectInput.dispatchEvent(new Event("input", { bubbles: true }));
    }

    document.querySelectorAll(".error-checkbox").forEach((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  await page.locator("#run-filter-btn").click({ timeout: 5000 });
  await waitForQueryIdle(page);
}

async function main() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const result = {
    generatedAt: new Date().toISOString(),
    port: PORT,
    targetUrl: TARGET_URL,
    asIs: null,
    northPendingAndInProgressAllTime: null,
    error: null,
  };

  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error(`No browser context available on port ${PORT}`);

    let page = context.pages().find((item) => item.url().includes("solargarden-web-prod.web.app")) || context.pages()[0];
    if (!page) page = await context.newPage();

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);

    result.asIs = await extractState(page, "as-is");
    await applyNorthPendingAndInProgressAllTime(page);
    result.northPendingAndInProgressAllTime = await extractState(page, "north-pending-and-in-progress-all-time");

    fs.writeFileSync(
      SNAPSHOT_PATH,
      JSON.stringify(
        {
          meta: {
            type: "reports",
            source: "browser-live-page",
            view: "browser-list",
            territory: "北區",
            included_statuses: ["待處理", "處理中"],
            all_time: true,
            totalRows: result.northPendingAndInProgressAllTime.rows.length,
            generatedAt: result.generatedAt,
            based_on: OUTPUT_PATH,
          },
          data: result.northPendingAndInProgressAllTime.rows,
        },
        null,
        2
      ),
      "utf8"
    );
  } catch (error) {
    result.error = error.message;
  } finally {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(result, null, 2), "utf8");
    console.log(
      JSON.stringify(
        {
          outputPath: OUTPUT_PATH,
          snapshotPath: SNAPSHOT_PATH,
          asIsCount: result.asIs?.countValue ?? null,
          fullCount: result.northPendingAndInProgressAllTime?.countValue ?? null,
          error: result.error,
        },
        null,
        2
      )
    );
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
