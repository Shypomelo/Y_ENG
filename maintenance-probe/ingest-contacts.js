/**
 * Ingest Contacts from Google Sheets (Consolidated Version)
 * This script fetches all regional tabs and merges them into a single list.
 */

const https = require('https');
const fs = require('fs');
const path = require('path');

const SHEET_BASE_URL = "https://docs.google.com/spreadsheets/d/1tUqOOZ4WiJ_kNTmySuCbKuhHKhBFQvbP/export?format=csv";
const OUTPUT_PATH = path.resolve(__dirname, 'probe-output/console/north-contacts.normalized.json');

const REGIONS = [
  { name: "基隆", gid: "1543676540" },
  { name: "台北", gid: "1004489147" },
  { name: "新北", gid: "2097106085" },
  { name: "桃園", gid: "605364944" },
  { name: "新竹", gid: "646757250" }
];
// Note: Double check GID for Hsinchu if it changed or keep existing 646757250 -> I'll stick to the one I had if not sure, but user specified these names.
// Wait, looking at my previous view of the file, Hsinchu was 646757250.

async function fetchSheet(region, maxRedirects = 5) {
  const url = region.gid ? `${SHEET_BASE_URL}&gid=${region.gid}` : region;
  
  if (maxRedirects < 0) {
    throw new Error('Too many redirects');
  }

  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      // Handle Redirects (301, 302, 307, 308)
      if ([301, 302, 307, 308].includes(res.statusCode) && res.headers.location) {
        resolve(fetchSheet(res.headers.location, maxRedirects - 1));
        return;
      }

      if (res.statusCode !== 200) {
        reject(new Error(`Failed to fetch sheet: HTTP ${res.statusCode}`));
        return;
      }

      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

function parseCSV(csvText, sourceName) {
  const allRows = [];
  let currentRowChars = [];
  let inQuotes = false;

  // 1. Properly split into rows respecting newlines inside quotes
  for (let i = 0; i < csvText.length; i++) {
    const char = csvText[i];
    if (char === '"') inQuotes = !inQuotes;

    if (!inQuotes && (char === '\n' || char === '\r')) {
      const row = currentRowChars.join('').trim();
      if (row) allRows.push(row);
      currentRowChars = [];
      if (char === '\r' && csvText[i + 1] === '\n') i++; // Skip next \n
    } else {
      currentRowChars.push(char);
    }
  }
  const lastRow = currentRowChars.join('').trim();
  if (lastRow) allRows.push(lastRow);

  if (allRows.length < 1) return [];

  // 2. Helper to split a single row into columns
  const splitCSVRow = (row) => {
    const result = [];
    let startValueIndex = 0;
    let inQuotesLocal = false;
    for (let i = 0; i < row.length; i++) {
      if (row[i] === '"') {
        inQuotesLocal = !inQuotesLocal;
      } else if (row[i] === ',' && !inQuotesLocal) {
        result.push(row.substring(startValueIndex, i));
        startValueIndex = i + 1;
      }
    }
    result.push(row.substring(startValueIndex));
    return result.map(v => v.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
  };

  const headers = splitCSVRow(allRows[0]);
  
  const jsonData = allRows.slice(1).map(row => {
    const values = splitCSVRow(row);
    const entry = {};
    headers.forEach((header, i) => {
      const cleanValue = values[i] || '';
      if (header) entry[header] = cleanValue;
    });
    // Add source sheet
    entry["來源工作表"] = sourceName;
    return entry;
  });

  return jsonData;
}

async function main() {
  console.log(`Starting consolidated ingestion of ${REGIONS.length} sheets...`);
  let allData = [];

  for (const region of REGIONS) {
    try {
      console.log(`Fetching ${region.name}...`);
      // Note: In local env, https.get might hit redirect/cert issues. 
      // This script works best when run in an environment that allows following redirects.
      const csv = await fetchSheet(region);
      
      // Basic check if it's actually CSV and not HTML
      if (csv.includes('<HTML>')) {
        console.error(`  Warning: ${region.name} returned HTML redirect instead of CSV. Skip.`);
        continue;
      }

      const parsed = parseCSV(csv, region.name);
      allData = allData.concat(parsed);
      console.log(`  Done. Added ${parsed.length} rows.`);
    } catch (err) {
      console.error(`  Failed to fetch ${region.name}:`, err.message);
    }
  }

  // Final sorting by Case No (案號)
  allData.sort((a, b) => {
    const noA = (a["案號"] || "").toString();
    const noB = (b["案號"] || "").toString();
    return noA.localeCompare(noB);
  });

  const output = {
    meta: {
      type: "consolidated-contacts",
      totalRows: allData.length,
      timestamp: new Date().toISOString(),
      source: "https://docs.google.com/spreadsheets/d/1tUqOOZ4WiJ_kNTmySuCbKuhHKhBFQvbP/edit",
      mergedSheets: REGIONS.map(r => r.name)
    },
    data: allData
  };

  fs.mkdirSync(path.dirname(OUTPUT_PATH), { recursive: true });
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`Successfully merged ${allData.length} rows into ${OUTPUT_PATH}`);
}

main();
