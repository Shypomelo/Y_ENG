const fs = require("fs");
const path = require("path");
const { chromium } = require(path.join(process.cwd(), "maintenance-probe", "node_modules", "playwright"));

const PORT = Number(process.env.COMPANY_CHROME_PORT || 9229);
const TARGET_URL = "https://solargarden-web-prod.web.app/sg_ops.html?view=report_crud";
const OUTPUT_PATH =
  process.env.OUTPUT_PATH || path.join(process.cwd(), "tmp", "capture-report-crud-full-firestore-live.json");

function trim(value, max = 12000) {
  if (value == null) return value;
  const text = String(value);
  return text.length > max ? `${text.slice(0, max)}...[truncated]` : text;
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

async function applyTargetFilters(page) {
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

    document.querySelectorAll(".error-checkbox").forEach((input) => {
      input.checked = true;
      input.dispatchEvent(new Event("change", { bubbles: true }));
    });
  });

  await page.locator("#run-filter-btn").click({ timeout: 5000 });
  await waitForQueryIdle(page);
}

async function getState(page) {
  return page.evaluate(() => ({
    url: location.href,
    countText: (document.body.innerText.match(/共\s*(\d+)\s*筆記錄/) || [null, null])[0],
    countValue: Number((document.body.innerText.match(/共\s*(\d+)\s*筆記錄/) || [null, 0])[1] || 0),
    rowCount: document.querySelectorAll("#reportDataList > tr").length,
  }));
}

async function main() {
  const browser = await chromium.connectOverCDP(`http://127.0.0.1:${PORT}`);
  const capture = {
    generatedAt: new Date().toISOString(),
    port: PORT,
    requestHits: [],
    responseHits: [],
    before: null,
    after: null,
    containsCaseNos: {},
    error: null,
  };

  try {
    const context = browser.contexts()[0];
    if (!context) throw new Error(`No browser context available on port ${PORT}`);
    let page = context.pages().find((item) => item.url().includes("solargarden-web-prod.web.app")) || context.pages()[0];
    if (!page) page = await context.newPage();

    page.on("request", (request) => {
      const url = request.url();
      if (!/firestore|googleapis|firebase|Listen\/channel|Write\/channel/i.test(url)) return;
      capture.requestHits.push({
        url,
        method: request.method(),
        postData: trim(request.postData()),
      });
    });

    page.on("response", async (response) => {
      const url = response.url();
      if (!/firestore|googleapis|firebase|Listen\/channel|Write\/channel/i.test(url)) return;
      let bodyText = "";
      try {
        bodyText = await response.text();
      } catch {}
      capture.responseHits.push({
        url,
        status: response.status(),
        bodyText: trim(bodyText, 20000),
      });
    });

    await page.goto(TARGET_URL, { waitUntil: "domcontentloaded", timeout: 30000 });
    await page.waitForTimeout(5000);
    capture.before = await getState(page);

    await applyTargetFilters(page);
    capture.after = await getState(page);

    const allResponseText = capture.responseHits.map((item) => item.bodyText || "").join("\n");
    for (const caseNo of ["22SR164", "21SR209", "22SR035"]) {
      capture.containsCaseNos[caseNo] = allResponseText.includes(caseNo);
    }
  } catch (error) {
    capture.error = error.message;
  } finally {
    fs.writeFileSync(OUTPUT_PATH, JSON.stringify(capture, null, 2), "utf8");
    console.log(
      JSON.stringify(
        {
          outputPath: OUTPUT_PATH,
          before: capture.before,
          after: capture.after,
          requestCount: capture.requestHits.length,
          responseCount: capture.responseHits.length,
          containsCaseNos: capture.containsCaseNos,
          error: capture.error,
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
