const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createObjectCsvWriter } = require('csv-writer');

const USER_DATA_DIR = path.join(process.cwd(), '.playwright-profile');
const OUTPUT_DIR = path.join(process.cwd(), 'probe-output', 'extraction');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

// Argument parsing
const type = process.argv[2]; // 'projects' or 'reports'
if (!['projects', 'reports'].includes(type)) {
    console.error('用法: node extract.js [projects|reports]');
    process.exit(1);
}

const config = {
    projects: {
        menu: '專案記錄',
        outputPrefix: 'project-records',
        mapping: [
            'case_no', 'case_name', 'capacity', 'created_date', 'region', 
            'address', 'sale_type', 'sales', 'electrical', 'structural', 
            'admin', 'engineering', 'pm', 'customer_email', 'structure_vendor', 
            'electrical_vendor', 'project_status'
        ]
    },
    reports: {
        menu: '通報記錄',
        outputPrefix: 'maintenance-reports',
        mapping: [
            'region', 'case_name', 'case_no', 'report_time', 'reporter', 
            'report_issue', 'monitor_staff', 'monitor_judgement', 'monitor_note', 
            'repair_staff', 'repair_note', 'repair_status', 'work_date', 'complete_date'
        ]
    }
}[type];

async function promptEnter(promptText) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question(promptText, () => {
        rl.close();
        resolve();
    }));
}

async function checkLoggedIn(page) {
    return await page.evaluate(() => {
        return !!document.querySelector('#main-iframe') || document.querySelectorAll('.sub-nav-item').length > 0;
    });
}

async function run() {
    console.log(`[auth] 啟動持久化瀏覽器 (${USER_DATA_DIR})...`);
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        args: ['--disable-popup-blocking', '--disable-infobars', '--window-size=1440,900']
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    const startUrl = 'https://solargarden-web-prod.web.app/main.html';
    
    console.log(`[auth] 前往 ${startUrl}...`);
    await page.goto(startUrl, { waitUntil: 'load' });

    if (!(await checkLoggedIn(page))) {
        console.log('[auth] session 失效，請先完成登入。');
        await promptEnter('\n[auth] 請手動登入並停在主畫面後，回終端按 Enter 開始抽取...');
    } else {
        console.log('[auth] session 有效。');
    }

    console.log(`[open-page] 尋找選單並點擊: ${config.menu}`);
    await page.evaluate((menuText) => {
        const el = Array.from(document.querySelectorAll('.sub-nav-item'))
                        .find(e => e.innerText.trim() === menuText);
        if (el) el.click();
    }, config.menu);

    console.log('[open-page] 等待 iframe 出現...');
    await page.waitForSelector('#main-iframe', { state: 'visible', timeout: 10000 });
    const iframeSrc = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
    console.log(`[open-page] 當前 iframe src: ${iframeSrc}`);

    const frame = page.frameLocator('#main-iframe');
    
    console.log('[wait-table] 等待表格載入 (thead/tbody/tr)...');
    // Using frame.locator().waitFor() is more stable
    try {
        await frame.locator('table thead th').first().waitFor({ state: 'visible', timeout: 15000 });
        await frame.locator('table tbody tr').first().waitFor({ state: 'visible', timeout: 15000 });
    } catch (e) {
        console.log('[wait-table] 警告: 表格或資料列未在預期時間內出現。');
    }

    console.log('[extract-headers] 正在讀取表頭...');
    const headersRaw = await frame.locator('table').evaluate((table) => {
        return Array.from(table.querySelectorAll('th, thead td')).map(th => th.innerText.trim()).filter(Boolean);
    });
    console.log(`[extract-headers] 找到 ${headersRaw.length} 個欄位。`);

    console.log('[extract-rows] 正在讀取資料列...');
    const allRowsRaw = await frame.locator('table tbody tr').evaluateAll((rows) => {
        return rows.filter(tr => tr.innerText.trim().length > 0)
                   .map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()));
    });

    const totalRows = allRowsRaw.length;
    if (totalRows === 0) {
        console.error('[extract-rows] 錯誤: 抓取到 0 筆資料！請檢查頁面是否已載入或結構是否改變。');
        // Do not write files if 0 rows
        process.exit(1);
    }

    console.log(`[extract-rows] 成功讀取 ${totalRows} 筆資料。`);
    if (allRowsRaw[0]) {
        console.log(`[debug] 第一列預覽: ${allRowsRaw[0].join(' | ').substring(0, 100)}...`);
    }

    // Normalization
    console.log('[extract-rows] 執行資料正規化...');
    const normalizedRows = allRowsRaw.map(row => {
        const obj = {};
        config.mapping.forEach((key, i) => {
            obj[key] = row[i] || ''; 
        });
        return obj;
    });

    const timestamp = new Date().toISOString();
    const meta = {
        type,
        page_title: config.menu,
        iframe_src: iframeSrc,
        extracted_at: timestamp,
        total_rows: totalRows,
        headers_count: headersRaw.length,
        headers_raw: headersRaw
    };

    // Files Output
    const rawFile = path.join(OUTPUT_DIR, `${config.outputPrefix}.raw.json`);
    const normFile = path.join(OUTPUT_DIR, `${config.outputPrefix}.normalized.json`);
    const csvFile = path.join(OUTPUT_DIR, `${config.outputPrefix}.csv`);

    console.log('[write-file] 正在將結果寫入檔案...');
    fs.writeFileSync(rawFile, JSON.stringify({ meta, rows: allRowsRaw }, null, 2));
    fs.writeFileSync(normFile, JSON.stringify({ meta, data: normalizedRows }, null, 2));

    const csvWriter = createObjectCsvWriter({
        path: csvFile,
        header: config.mapping.map(k => ({ id: k, title: k }))
    });
    await csvWriter.writeRecords(normalizedRows);

    console.log('\n========================================');
    console.log(`[done] 第一頁穩定抽取完成！`);
    console.log(`- 輸出 CSV: ${csvFile}`);
    console.log(`- 總筆數: ${totalRows}`);
    console.log('========================================\n');

    console.log('[提示] 瀏覽器保持開啟。如需關閉請按 Ctrl + C。');
}

run().catch(err => {
    console.error('執行錯誤:', err);
    process.exit(1);
});
