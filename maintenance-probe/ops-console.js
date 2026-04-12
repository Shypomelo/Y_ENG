const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { createObjectCsvWriter } = require('csv-writer');

const USER_DATA_DIR = path.join(process.cwd(), '.playwright-profile');
const OUTPUT_DIR = path.join(process.cwd(), 'probe-output', 'console');
const DEBUG_DIR = path.join(process.cwd(), 'probe-output', 'debug');
const HEADLESS = process.env.OPS_HEADLESS === '1';
const REMOTE_DEBUG_URL = process.env.OPS_REMOTE_DEBUG_URL || '';
const CHROME_EXECUTABLES = [
    'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
    'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
];
const CHROME_EXECUTABLE = CHROME_EXECUTABLES.find(file => fs.existsSync(file)) || null;

[OUTPUT_DIR, DEBUG_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

let context = null;
let page = null;

async function initBrowser() {
    if (context) {
        try {
            const pages = context.pages();
            if (pages.length > 0) {
                await pages[0].evaluate(() => 1).catch(() => { throw new Error('context dead'); });
                page = pages[0];
                return;
            }
        } catch (e) {
            console.log('[auth] 既存實例已失效，正在重新啟動...');
            await context.close().catch(() => {});
            context = null;
        }
    }

    if (REMOTE_DEBUG_URL) {
        console.log(`[auth] 連線既有 Chrome CDP: ${REMOTE_DEBUG_URL}`);
        const browser = await chromium.connectOverCDP(REMOTE_DEBUG_URL);
        const contexts = browser.contexts();
        context = contexts[0] || await browser.newContext();
        page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
        return;
    }
    
    console.log(`[auth] 啟動持久化瀏覽器實例 (${USER_DATA_DIR})...`);
    try {
        context = await chromium.launchPersistentContext(USER_DATA_DIR, {
            headless: HEADLESS,
            viewport: null,
            executablePath: CHROME_EXECUTABLE || undefined,
            args: ['--disable-popup-blocking', '--disable-infobars']
        });

        page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
        
        const startUrl = 'https://solargarden-web-prod.web.app/main.html';
        const currentUrl = page.url();
        if (!currentUrl.includes('main.html') && !currentUrl.includes('home.html')) {
            console.log(`[open] 前往整合頁面: ${startUrl}`);
            await page.goto(startUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
        }
        
        // 等待頁面穩定
        await page.waitForTimeout(2000);
    } catch (err) {
        console.log(`[auth] 啟動失敗: ${err.message}`);
        if (err.message.includes('locked')) {
            console.log('  -> 提示: 偵測到 profile 被佔用，請關閉其他 Chrome 視窗或刪除 lockfile。');
        }
        throw err;
    }
}

async function checkLoggedIn() {
    await initBrowser();
    try {
        // 1. 檢查目前 URL 是否明確在登入頁或首頁 (index.html)
        const url = page.url();
        if (url.includes('index.html') || url.endsWith('.app/')) {
            // 在首頁時，檢查是否有側邊欄。如果沒有，那通常是需要登入
            const sidebarCount = await page.locator('aside.sidebar, .nav-group-title').count();
            if (sidebarCount === 0) return false;
        }

        // 2. 檢查是否有側邊欄 (登入後的特徵)
        const sidebar = page.locator('aside.sidebar, .nav-group-title');
        if (await sidebar.count() > 0) return true;
        
        // 3. 檢查登入按鈕文字 (登入頁的特徵)
        const loginBtn = page.locator('button:has-text("登入"), .login-card');
        if (await loginBtn.count() > 0) return false;

        // 預設：如果都不確定，我們假設需要檢查導航
        return true;
    } catch (e) {
        return false;
    }
}

async function navigateTo(menuName) {
    console.log(`[nav] 正在導航至: ${menuName}`);

    // 1. 確保 Sidebar 是開啟的 (透過檢查 body class 或特定變數)
    await page.evaluate(() => {
        // 如果 sidebar 是縮起來的 (collapsed)，點擊漢堡選單展開它
        const sidebar = document.querySelector('aside.sidebar');
        if (sidebar && sidebar.classList.contains('collapsed')) {
            const toggle = document.querySelector('header button');
            if (toggle) toggle.click();
        }
        // 或者直接透過 Alpine.js 變數 (如果有的話)
    });
    await page.waitForTimeout(500);

    // 2. 定義選單群組對應關係
    const menuGroups = {
        '案場總覽': '維運管理系統',
        '通報記錄': '維運管理系統',
        '維修通報': '維運管理系統',
        '工時查詢': '維運管理系統',
        '專案記錄': '專案管理系統'
    };

    // 2. 確保群組已展開
    const groupName = menuGroups[menuName];
    if (groupName) {
        console.log(`[nav] 確保群組已展開: ${groupName}`);
        try {
            await page.waitForSelector('.nav-group-title', { timeout: 5000 });
            await page.evaluate((g) => {
                const title = Array.from(document.querySelectorAll('.nav-group-title'))
                    .find(el => el.innerText.includes(g));
                if (title) {
                    const groupRoot = title.parentElement;
                    const subMenu = groupRoot.querySelector('.mt-1');
                    const isExpanded = subMenu && window.getComputedStyle(subMenu).display !== 'none';
                    if (!isExpanded) {
                        title.click();
                    }
                }
            }, groupName);
            await page.waitForTimeout(1000);
        } catch (e) {
            console.log(`[nav] 展開群組失敗: ${e.message}`);
        }
    }

    // 3. 點擊子項目
    try {
        await page.waitForSelector('.sub-nav-item', { timeout: 5000 });
    } catch (e) {
        console.log(`[nav] 等待 .sub-nav-item 超時，當前 DOM 可能異常。`);
    }

    const clickSuccess = await page.evaluate((m) => {
        const items = Array.from(document.querySelectorAll('.sub-nav-item'));
        if (items.length === 0) return { error: 'no_items_found', html: document.body.innerText.substring(0, 500) };
        
        const permMap = { '案場總覽': 'ops_view', '通報記錄': 'ops_rplist' };
        let item = items.find(el => el.getAttribute('data-perm') === permMap[m]);
        
        if (!item) {
            const urlMap = { '案場總覽': 'sg_ops.html?view=list', '通報記錄': 'sg_ops.html?view=report_crud' };
            item = items.find(el => el.getAttribute('onclick')?.includes(urlMap[m]));
        }

        if (!item) {
            item = items.find(el => {
                const text = el.innerText.replace(/\s+/g, ' ').trim();
                return new RegExp(m, 'i').test(text);
            });
        }

        if (item) {
            item.click();
            return { success: true };
        }
        return { error: 'item_not_found', items: items.map(i => i.innerText.trim()) };
    }, menuName);

    if (!clickSuccess.success) {
        console.log(`[nav] 導航失敗: ${JSON.stringify(clickSuccess)}`);
        return false;
    }

    console.log(`[nav] 等待頁面載入...`);
    await page.waitForTimeout(5000);
    
    const finalSrc = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
    console.log(`[nav] 當前 iframe src: ${finalSrc}`);
    
    return true;
}

async function extractData(type, filterRegion = null) {
    const config = {
        projects: {
            menu: '專案記錄',
            outputPrefix: 'project-records',
            mapping: [
                'case_no', 'case_name', 'capacity', 'created_date', 'region', 
                'address', 'sale_type', 'sales', 'electrical', 'structural', 
                'admin', 'engineering', 'pm', 'customer_email', 'structure_vendor', 
                'electrical_vendor', 'project_status'
            ],
            rowSelector: 'table tbody tr'
        },
        reports: {
            menu: '通報記錄',
            outputPrefix: 'maintenance-reports',
            mapping: [
                'region', 'case_name', 'case_no', 'report_time', 'reporter', 
                'report_issue', 'monitor_staff', 'monitor_judgement', 'monitor_note', 
                'repair_staff', 'repair_note', 'repair_status', 'work_date', 'complete_date',
                'cell_case', 'cell_report', 'cell_monitor', 'cell_repair', 'cell_status'
            ],
            rowSelector: '#reportDataList > tr'
        },
        sites: {
            menu: '案場總覽',
            outputPrefix: 'north-sites',
            mapping: [
                'case_no', 'case_name', 'region', 'address', 'site_type', 
                'capacity', 'warranty_status', 'sales_owner', 'maintenance_owner', 'site_status'
            ],
            rowSelector: '#projectList > div',
            isCard: true
        }
    }[type];

    if (!config) return false;

    // 1. 導覽
    if (!(await navigateTo(config.menu))) {
        console.log('[abort] extract cancelled due to invalid navigation');
        return false;
    }

    // 2. 重新獲取新鮮的 Frame
    console.log('[wait-iframe] 重新取得 Iframe Context...');
    const frame = page.frameLocator('#main-iframe');
    
    // 等待資料載入指示器消失 (如有) 或特定容器出現
    console.log(`[wait-stable] 正在等待資料穩定 (Max 30s)...`);
    
    // 如果是案場總覽且過濾北區，嘗試執行篩選
    if (type === 'sites' && filterRegion) {
        // 先等待搜尋框出現
        const searchInput = frame.locator('#searchprojectInput');
        try {
            await searchInput.waitFor({ state: 'visible', timeout: 10000 });
            console.log(`[filter] 正在頁面搜尋框輸入: ${filterRegion}`);
            await searchInput.evaluate((el, val) => {
                el.value = val;
                el.dispatchEvent(new Event('input', { bubbles: true }));
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', code: 'Enter', bubbles: true }));
            }, filterRegion);
            await page.waitForTimeout(3000); // 等待篩選結果反應
        } catch (e) {
            console.log(`[filter] 搜尋框未就緒或填入失敗: ${e.message}`);
        }
    }

    let lastCount = -1;
    let countsLog = [];
    let stableCount = 0;

    for (let sec = 1; sec <= 30; sec++) {
        const currentCount = await frame.locator(config.rowSelector).count().catch(() => 0);
        countsLog.push(currentCount);

        if (currentCount > 0 && currentCount === lastCount) {
            stableCount = currentCount;
            console.log(`[wait-stable] 資料已穩定在 ${stableCount} 筆 (${countsLog.join(' -> ')})`);
            break;
        }
        
        lastCount = currentCount;
        await page.waitForTimeout(1000);
    }

    if (stableCount <= 0) {
        console.log(`[abort] live site list container not identified yet (0 results).`);
        const debugDump = await frame.locator('body').evaluate(body => body.innerText.substring(0, 1000));
        console.log(`[debug] iframe body snapshot: ${debugDump}`);
        return false;
    }

    console.log(`[extract] 資料已穩定 (${stableCount} 筆)，執行抽取...`);
    
    let rawData2D = [];
    if (config.isCard) {
        console.log('[extract] 偵測到 Card 結構，執行區塊內容分析...');
        rawData2D = await frame.locator(config.rowSelector).evaluateAll((cards) => {
            return cards.map(card => {
                const text = card.innerText.trim();
                const map = {};
                text.split('\n').forEach(line => {
                    const parts = line.split(/[：:]/);
                    if (parts.length >= 2) {
                        const key = parts[0].trim();
                        const val = parts.slice(1).join('：').trim();
                        map[key] = val;
                    }
                });
                
                return [
                    map['案號'] || '',
                    map['案名'] || '',
                    map['案場區域'] || '',
                    map['地址'] || '',
                    map['案件型式'] || '',
                    map['容量'] || '',
                    map['保固狀態'] || '',
                    map['負責業務'] || '',
                    '', // maintenance_owner
                    ''  // site_status
                ];
            });
        });
    } else {
        const snapshot = await frame.locator('body').evaluate((body, sel) => {
            const rows = Array.from(body.querySelectorAll(sel));
            return rows.map(tr => Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim()));
        }, config.rowSelector);
        rawData2D = snapshot.filter(row => row.length > 0);
    }

    // 輸出 Raw Snapshot (JSON)
    const rawSnapshot = {
        meta: { type, totalRows: rawData2D.length, extracted_at: new Date().toISOString() },
        data: rawData2D
    };
    const rawSnapshotPath = path.join(OUTPUT_DIR, type === 'sites' ? 'north-sites.raw.json' : 'reports-raw-snapshot.json');
    fs.writeFileSync(rawSnapshotPath, JSON.stringify(rawSnapshot, null, 2));
    console.log(`[debug] 已輸出原始結構快照至: ${rawSnapshotPath}`);

    // 5. 存檔與過濾
    const saveFiles = async (data, prefix) => {
        const normalized = data.map(row => {
            const obj = type === 'reports' ? parseReportRowFromCells(row) : {};
            if (type !== 'reports') {
                config.mapping.forEach((key, i) => {
                    obj[key] = row[i] || '';
                // 額外增加通用欄位
                    if (key === 'source_page') obj[key] = config.menu;
                    if (key === 'extracted_at') obj[key] = new Date().toISOString();
                });
            }
            // 補齊缺失欄位
            if (!obj.source_page) obj.source_page = config.menu;
            if (!obj.extracted_at) obj.extracted_at = new Date().toISOString();
            return obj;
        });

        const base = path.join(OUTPUT_DIR, prefix);
        const jsonPath = path.resolve(`${base}.normalized.json`);
        const csvPath = path.resolve(`${base}.csv`);

        fs.writeFileSync(jsonPath, JSON.stringify({ meta: { type, totalRows: data.length, timestamp: new Date().toISOString() }, data: normalized }, null, 2));
        
        // 確保 CSV Header 包含所有 mapping 欄位
        const csvHeader = config.mapping.map(k => ({ id: k, title: k }));
        if (!csvHeader.find(h => h.id === 'source_page')) csvHeader.push({ id: 'source_page', title: 'source_page' });
        if (!csvHeader.find(h => h.id === 'extracted_at')) csvHeader.push({ id: 'extracted_at', title: 'extracted_at' });

        const csvWriter = createObjectCsvWriter({ path: csvPath, header: csvHeader });
        await csvWriter.writeRecords(normalized);
        console.log(` > 已存檔: ${jsonPath} (${data.length} 筆)`);
    };

    console.log('----------------------------------------');
    console.log(`[write-file] 開始輸出資料檔...`);
    
    // 輸出主要檔案
    await saveFiles(rawData2D, type === 'sites' ? 'north-sites' : config.outputPrefix);
    
    if (filterRegion && type !== 'sites') { // sites 已經在搜尋框過濾過一次，為了保險也可以再 filter 一次
        console.log(`\n[filter] 正在產出過濾版本 (區域: ${filterRegion})...`);
        const filteredRows = rawData2D.filter(r => {
            const rowText = r.join(' ');
            return rowText.includes(filterRegion);
        });
        await saveFiles(filteredRows, 'north-reports');
    }
    console.log('----------------------------------------');
    return true;
}

function splitCellLines(value) {
    return String(value || '')
        .split('\n')
        .map(part => part.trim())
        .filter(Boolean);
}

function parseReportRowFromCells(cells) {
    const safeCells = Array.isArray(cells) ? cells : [];
    const caseLines = splitCellLines(safeCells[0]);
    const reportLines = splitCellLines(safeCells[1]);
    const monitorLines = splitCellLines(safeCells[2]);
    const repairLines = splitCellLines(safeCells[3]);
    const statusLines = splitCellLines(safeCells[4]);

    const region = caseLines[0] || '';
    const case_name = caseLines[1] || '';
    const case_no = caseLines[2] || '';

    const report_time = reportLines[0] || '';
    const reporter = reportLines[1] || '';
    const report_issue = reportLines.slice(2).join('\n');

    const monitor_staff = monitorLines[0] || '';
    const monitor_judgement = monitorLines[1] || '';
    const monitor_note = monitorLines.slice(2).join('\n');

    const repair_staff = repairLines[0] || '';
    const repair_note = repairLines.slice(1).join('\n');

    const repair_status = statusLines[0] || '';
    const work_date = statusLines[1] || '';
    const complete_date = statusLines[2] || '';

    return {
        region,
        case_name,
        case_no,
        report_time,
        reporter,
        report_issue,
        monitor_staff,
        monitor_judgement,
        monitor_note,
        repair_staff,
        repair_note,
        repair_status,
        work_date,
        complete_date,
        cell_case: safeCells[0] || '',
        cell_report: safeCells[1] || '',
        cell_monitor: safeCells[2] || '',
        cell_repair: safeCells[3] || '',
        cell_status: safeCells[4] || '',
    };
}

function getReportProbeBaseName() {
    return path.join(DEBUG_DIR, 'reports-external-id');
}

async function installExternalIdProbe() {
    await page.addInitScript(() => {
        if (window.__opsExternalIdProbeInstalled) return;
        window.__opsExternalIdProbeInstalled = true;

        const maxEntries = 200;
        const state = {
            fetches: [],
            xhrs: [],
            clicks: []
        };

        const pushEntry = (bucket, entry) => {
            bucket.push(entry);
            if (bucket.length > maxEntries) bucket.shift();
        };

        window.__opsExternalIdProbe = state;

        const originalFetch = window.fetch.bind(window);
        window.fetch = async (...args) => {
            const input = args[0];
            const init = args[1] || {};
            let url = '';
            if (typeof input === 'string') url = input;
            else if (input && typeof input.url === 'string') url = input.url;

            pushEntry(state.fetches, {
                ts: new Date().toISOString(),
                url,
                method: init.method || 'GET'
            });

            return originalFetch(...args);
        };

        const originalOpen = XMLHttpRequest.prototype.open;
        XMLHttpRequest.prototype.open = function(method, url, ...rest) {
            this.__opsProbeRequest = { method, url, ts: new Date().toISOString() };
            return originalOpen.call(this, method, url, ...rest);
        };

        const originalSend = XMLHttpRequest.prototype.send;
        XMLHttpRequest.prototype.send = function(body) {
            if (this.__opsProbeRequest) {
                pushEntry(state.xhrs, {
                    ...this.__opsProbeRequest,
                    bodyPreview: typeof body === 'string' ? body.slice(0, 300) : ''
                });
            }
            return originalSend.call(this, body);
        };

        document.addEventListener('click', (event) => {
            const target = event.target instanceof Element ? event.target.closest('button, a, tr, [onclick]') : null;
            if (!target) return;

            pushEntry(state.clicks, {
                ts: new Date().toISOString(),
                tag: target.tagName,
                id: target.id || '',
                className: target.className || '',
                text: (target.innerText || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
                onclick: target.getAttribute && target.getAttribute('onclick') || '',
                dataset: Object.assign({}, target.dataset || {})
            });
        }, true);
    });
}

async function getReportCrudFrame() {
    await page.waitForSelector('#main-iframe', { state: 'visible', timeout: 15000 });

    for (let i = 0; i < 30; i++) {
        const frame = page.frames().find(f => f.url().includes('sg_ops.html?view=report_crud'));
        if (frame) return frame;
        await page.waitForTimeout(500);
    }

    throw new Error('report_crud frame not found');
}

async function waitForReportRows(frame) {
    for (let i = 0; i < 30; i++) {
        const count = await frame.evaluate(() => document.querySelectorAll('#reportDataList > tr').length).catch(() => 0);
        if (count > 0) return count;
        await page.waitForTimeout(1000);
    }

    return 0;
}

async function debugReportsExternalId() {
    await installExternalIdProbe();

    if (!(await navigateTo('通報記錄'))) return;

    console.log('[debug] Inspecting report_crud for stable external id signals...');

    const frame = await getReportCrudFrame();
    const rowCount = await waitForReportRows(frame);

    if (rowCount <= 0) {
        throw new Error('report rows did not load');
    }

    const preClickSnapshot = await frame.evaluate(() => {
        const toAttributes = (el) => Array.from(el.attributes || []).map(attr => ({
            name: attr.name,
            value: attr.value
        }));

        const pickIdentityCandidates = (source) => {
            if (!source) return [];
            const candidates = [];
            const text = String(source);
            const regexes = [
                /projects\/[^'"\s)]+/g,
                /reports?\/[^'"\s)]+/g,
                /tickets?\/[^'"\s)]+/g,
                /[A-Za-z0-9_-]{16,}/g
            ];

            for (const regex of regexes) {
                const matches = text.match(regex) || [];
                for (const match of matches) {
                    if (!candidates.includes(match)) candidates.push(match);
                }
            }

            return candidates.slice(0, 10);
        };

        const summarizeNode = (el) => ({
            tag: el.tagName,
            id: el.id || '',
            className: el.className || '',
            name: el.getAttribute('name') || '',
            type: el.getAttribute('type') || '',
            text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 160),
            value: (el.value || el.getAttribute('value') || '').slice(0, 200),
            onclick: el.getAttribute('onclick') || '',
            dataset: Object.assign({}, el.dataset || {}),
            attributes: toAttributes(el).filter(attr =>
                attr.name.startsWith('data-') ||
                attr.name === 'onclick' ||
                attr.name === 'id' ||
                attr.name === 'name' ||
                attr.name === 'value' ||
                attr.name === 'type'
            )
        });

        const rows = Array.from(document.querySelectorAll('#reportDataList > tr')).map((tr, index) => {
            const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            const rowAttrs = toAttributes(tr);
            const hiddenInputs = Array.from(tr.querySelectorAll('input[type="hidden"], input[type="text"], input[type="search"], textarea'))
                .map(summarizeNode)
                .filter(input => input.type === 'hidden' || input.value || input.name || input.id);
            const actionNodes = Array.from(tr.querySelectorAll('[onclick], button, a, [data-id], [data-doc-id], [data-key], [role="button"]'))
                .map(summarizeNode);

            const candidateSources = [
                tr.outerHTML,
                JSON.stringify(Object.assign({}, tr.dataset || {})),
                ...rowAttrs.map(attr => `${attr.name}=${attr.value}`),
                ...hiddenInputs.map(input => `${input.name}:${input.value}:${input.onclick}`),
                ...actionNodes.map(node => `${node.id}:${node.name}:${node.value}:${node.onclick}:${JSON.stringify(node.dataset)}`)
            ];

            const identityCandidates = Array.from(new Set(candidateSources.flatMap(pickIdentityCandidates)));

            return {
                index,
                cells,
                dataset: Object.assign({}, tr.dataset || {}),
                attributes: rowAttrs,
                hiddenInputs,
                actionNodes,
                identityCandidates,
                outerHTMLSnippet: tr.outerHTML.slice(0, 1200)
            };
        });

        const globalCandidates = Object.keys(window)
            .filter(key => /report|ticket|firebase|firestore|project|crud/i.test(key))
            .slice(0, 100)
            .map(key => {
                let valueType = typeof window[key];
                let preview = '';
                try {
                    if (valueType === 'string') preview = window[key].slice(0, 200);
                    else if (valueType === 'object' && window[key]) preview = JSON.stringify(window[key]).slice(0, 200);
                    else if (valueType === 'function') preview = String(window[key]).slice(0, 200);
                } catch (error) {
                    preview = `[unserializable:${error.message}]`;
                }

                return { key, valueType, preview };
            });

        return {
            href: location.href,
            title: document.title,
            rowCount: rows.length,
            rows,
            globalCandidates,
            probeState: window.__opsExternalIdProbe || null
        };
    });

    const firstClickable = await frame.evaluate(() => {
        const firstRow = document.querySelector('#reportDataList > tr');
        if (!firstRow) return { clicked: false, reason: 'no-row' };

        const candidates = Array.from(firstRow.querySelectorAll('[onclick], button, a, [role="button"]'));
        const target = candidates.find(el => /edit|detail|view|檢視|查看|編輯/i.test(
            `${el.getAttribute('onclick') || ''} ${el.innerText || ''} ${el.className || ''}`
        )) || candidates[0] || firstRow;

        target.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

        return {
            clicked: true,
            tag: target.tagName,
            id: target.id || '',
            className: target.className || '',
            text: (target.innerText || target.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 120),
            onclick: target.getAttribute && target.getAttribute('onclick') || '',
            dataset: Object.assign({}, target.dataset || {})
        };
    }).catch(error => ({ clicked: false, reason: error.message }));

    await page.waitForTimeout(2000);

    const postClickSnapshot = await frame.evaluate(() => {
        const visibleNodes = Array.from(document.querySelectorAll('dialog, [role="dialog"], .modal, .modal.show, .fixed, .swal2-container'))
            .filter(el => {
                const style = window.getComputedStyle(el);
                return style.display !== 'none' && style.visibility !== 'hidden' && Number(style.opacity || '1') !== 0;
            })
            .slice(0, 10)
            .map(el => ({
                tag: el.tagName,
                id: el.id || '',
                className: el.className || '',
                text: (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 500),
                hiddenInputs: Array.from(el.querySelectorAll('input, textarea, select')).map(input => ({
                    tag: input.tagName,
                    id: input.id || '',
                    name: input.getAttribute('name') || '',
                    type: input.getAttribute('type') || '',
                    value: (input.value || input.getAttribute('value') || '').slice(0, 300),
                    dataset: Object.assign({}, input.dataset || {})
                }))
            }));

        const probeState = window.__opsExternalIdProbe || { fetches: [], xhrs: [], clicks: [] };
        const firestoreLikeRequests = [...probeState.fetches, ...probeState.xhrs].filter(entry =>
            /firestore|googleapis|firebase|report|ticket|project/i.test(`${entry.url || ''} ${entry.bodyPreview || ''}`)
        );

        return {
            modalCandidates: visibleNodes,
            probeState,
            firestoreLikeRequests
        };
    });

    const summary = (() => {
        const rowCandidates = preClickSnapshot.rows
            .map(row => row.identityCandidates)
            .filter(list => list.length > 0);

        const flattened = rowCandidates.flat();
        const uniqueCandidates = Array.from(new Set(flattened));
        const repeatedCandidates = uniqueCandidates.filter(candidate =>
            rowCandidates.filter(list => list.includes(candidate)).length > 1
        );

        const firestoreRequestUrls = postClickSnapshot.firestoreLikeRequests.map(entry => entry.url).filter(Boolean);
        const hasDocumentPath = uniqueCandidates.some(candidate => candidate.includes('/')) ||
            firestoreRequestUrls.some(url => /documents|firestore/i.test(url));

        return {
            rowCount: preClickSnapshot.rowCount,
            rowsWithCandidates: rowCandidates.length,
            uniqueCandidateCount: uniqueCandidates.length,
            repeatedCandidateCount: repeatedCandidates.length,
            hasDocumentPath,
            likelyStable: uniqueCandidates.length > 0 && repeatedCandidates.length === 0,
            note: uniqueCandidates.length === 0
                ? 'No obvious row-level identifier was found in DOM attributes, hidden inputs, onclick, or captured requests.'
                : 'Candidates found. Verify whether each row has a unique candidate that remains stable across repeated runs.'
        };
    })();

    const result = {
        generatedAt: new Date().toISOString(),
        iframeSrc: await page.evaluate(() => document.querySelector('#main-iframe')?.src),
        firstClickable,
        summary,
        preClickSnapshot,
        postClickSnapshot
    };

    const baseName = getReportProbeBaseName();
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(result, null, 2));
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    console.log(`[debug] External id probe written:\n > ${baseName}.json\n > ${baseName}.png`);
    console.log(`[debug] Summary: ${JSON.stringify(summary)}`);
}

// --- Debug Commands ---

async function debugReportsDom() {
    if (!(await navigateTo('通報記錄'))) return;

    console.log('[debug] 正在分析 "通報記錄" 頁面結構...');
    const frame = page.frameLocator('#main-iframe');
    
    const debugInfo = await frame.locator('body').evaluate(body => {
        const table = body.querySelector('table');
        const headers = table ? Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim()) : [];
        const rows = table ? Array.from(table.querySelectorAll('tbody tr')).slice(0, 5).map(tr => {
            const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            return { text: tr.innerText.trim(), cell_count: cells.length, cells };
        }) : [];

        // 搜尋控制項
        const controls = Array.from(body.querySelectorAll('select, input, button'))
            .filter(el => /區域|北區|搜尋|查詢|filter|search/i.test(el.innerText + el.id + el.name + el.className + el.placeholder))
            .map(el => ({
                tag: el.tagName,
                id: el.id,
                name: el.name,
                className: el.className,
                text: el.innerText.trim() || el.value,
                placeholder: el.placeholder || ''
            }));

        return {
            page_title: document.title,
            ready_state: document.readyState,
            table_count: body.querySelectorAll('table').length,
            table_info: {
                headers,
                row_count: table ? table.querySelectorAll('tbody tr').length : 0,
                sample_rows: rows
            },
            controls,
            outer_html_sample: table ? table.outerHTML.substring(0, 3000) : 'No table found',
            body_text_sample: body.innerText.substring(0, 3000)
        };
    });

    debugInfo.iframe_src = await page.evaluate(() => document.querySelector('#main-iframe')?.src);

    const baseName = path.join(DEBUG_DIR, 'reports-dom');
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(debugInfo, null, 2));
    fs.writeFileSync(`${baseName}.txt`, debugInfo.body_text_sample);
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    console.log(`[debug] 完成！分析結果已存至: \n > ${baseName}.json \n > ${baseName}.png`);
}

async function debugReportsNorth() {
    if (!(await navigateTo('通報記錄'))) return;

    console.log('[debug] 正在分析 "北區" 過濾邏輯...');
    const frame = page.frameLocator('#main-iframe');

    // 嘗試抓取 raw rows
    const rows = await frame.locator('#reportDataList tr').evaluateAll(trs => {
        return trs.slice(0, 10).map(tr => {
            const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
            return { raw_text: tr.innerText.trim(), cells };
        });
    });

    const checkResults = rows.map((r, i) => {
        const firstCell = r.cells[0] || 'N/A';
        const regionLine = firstCell.split('\n')[0].trim();
        const isMatch = regionLine.includes('北區');
        return {
            index: i,
            raw_text: r.raw_text.substring(0, 50),
            parsed_region: regionLine,
            is_match: isMatch
        };
    });

    const debugReport = {
        filter_rule: "Using cell[0].split('\\n')[0].trim() and includes('北區')",
        total_checked: checkResults.length,
        match_count: checkResults.filter(c => c.is_match).length,
        results: checkResults,
        failure_analysis: checkResults.length === 0 ? "No rows found in #reportDataList." : (checkResults.filter(c => c.is_match).length === 0 ? "None of the rows matched '北區' in the parsed region." : "Normal.")
    };

    const targetPath = path.join(DEBUG_DIR, 'reports-north-check.json');
    fs.writeFileSync(targetPath, JSON.stringify(debugReport, null, 2));
    console.log(`[debug] 完成！過濾分析已存至: ${targetPath}`);
}

async function debugReportsLoad() {
    if (!(await navigateTo('通報記錄'))) return;

    console.log('[debug] 正在執行 "reports-load" 深度載入分析 (預計 20 秒)...');
    const frame = page.frameLocator('#main-iframe');

    const loadingLog = [];
    for (let i = 1; i <= 20; i++) {
        const stats = await frame.locator('body').evaluate(body => {
            const list = body.querySelector('#reportDataList');
            return {
                timestamp: new Date().toLocaleTimeString(),
                reportDataList_exists: !!list,
                children_count: list ? list.children.length : 0,
                innerHTML_length: list ? list.innerHTML.length : 0,
                has_tr: list ? !!list.querySelector('tr') : false
            };
        });
        loadingLog.push(stats);
        if (i % 5 === 0) console.log(` - 已記錄 ${i} 秒: rows=${stats.children_count}, html=${stats.innerHTML_length}`);
        await page.waitForTimeout(1000);
    }

    const extraInfo = await frame.locator('body').evaluate(body => {
        const scripts = Array.from(document.querySelectorAll('script')).map(s => ({
            src: s.src || 'inline',
            content: s.src ? '' : s.innerText.substring(0, 500)
        }));

        const globals = Object.keys(window).filter(k => /report|ops|load|fetch/i.test(k));
        const overlay = !!document.querySelector('.loading, .spinner, .overlay, .v-loading, .v-overlay');

        return {
            iframe_src: location.href,
            readyState: document.readyState,
            scripts_found: scripts,
            suspicious_globals: globals,
            loading_overlay_visible: overlay
        };
    });

    const finalResult = {
        meta: extraInfo,
        polling_log: loadingLog
    };

    const jsonPath = path.join(DEBUG_DIR, 'reports-load.json');
    const pngPath = path.join(DEBUG_DIR, 'reports-load.png');
    fs.writeFileSync(jsonPath, JSON.stringify(finalResult, null, 2));
    await page.screenshot({ path: pngPath, fullPage: true });

    console.log(`[debug] 載入分析完成！\n > JSON: ${jsonPath}\n > PNG:  ${pngPath}`);
}

async function debugSitesDom() {
    if (!(await navigateTo('案場總覽'))) return;

    console.log('[debug] 正在分析 "案場總覽" 頁面結構 (詳細模式)...');
    
    const iframesInfo = await page.evaluate(() => {
        return {
            iframes: Array.from(document.querySelectorAll('iframe')).map((f, i) => ({
                index: i, id: f.id, className: f.className, src: f.src, 
                offsetWidth: f.offsetWidth, offsetHeight: f.offsetHeight
            })),
            switchPageSource: window.switchPage ? window.switchPage.toString() : 'undefined'
        };
    });
    console.log(`[debug] 頁面共有 ${iframesInfo.iframes.length} 個 iframe:`, iframesInfo.iframes);
    console.log(`[debug] switchPage Source:`, iframesInfo.switchPageSource);

    let frame = null;
    let info = {
        iframes_on_page: iframesInfo.iframes,
        switchPageSource: iframesInfo.switchPageSource,
        page_title: await page.title(),
        ready_state: await page.evaluate(() => document.readyState)
    };

    if (iframesInfo.length > 0) {
        frame = page.frameLocator('#main-iframe').locator('body');
        info.iframe_href = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
    } else {
        console.log('[debug] 警告: 未找到 iframe，改為分析主頁面 Body...');
        frame = page.locator('body');
        info.iframe_href = 'N/A (main page)';
    }

    const debugInfo = await frame.evaluate((body, baseInfo) => {
        const getSnippet = (text, len = 300) => (text || '').replace(/\s+/g, ' ').trim().substring(0, len);
        
        // 5. 所有可疑資料容器
        const suspicious = Array.from(document.querySelectorAll('div, section, ul, article, table'))
            .filter(el => el.children.length > 2)
            .slice(0, 50)
            .map(el => ({
                tag: el.tagName,
                id: el.id,
                className: el.className,
                child_count: el.children.length,
                text_sample: getSnippet(el.innerText, 300)
            }));

        // 6. 尋找 Card/List 容器
        const possible_containers = Array.from(document.querySelectorAll('div, section, ul'))
            .filter(el => /card|list|grid|item|container|content/i.test(el.className))
            .filter(el => el.children.length > 0)
            .slice(0, 20)
            .map(el => ({
                id: el.id,
                className: el.className,
                child_count: el.children.length,
                children_raw: Array.from(el.children).slice(0, 5).map(c => getSnippet(c.innerText, 200))
            }));

        // 7. Table 分析
        const tables = Array.from(document.querySelectorAll('table')).map(t => {
            const headers = Array.from(t.querySelectorAll('th, td[style*="font-weight"]')).map(th => th.innerText.trim());
            const rows = Array.from(t.querySelectorAll('tr')).slice(0, 3).map(tr => 
                Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim())
            );
            return { headers, rows_sample: rows };
        });

        // 8. 關鍵字相關 Controls
        const keywords = ['區域', '北區', '查詢', '搜尋', 'filter', 'search'];
        const controls = Array.from(document.querySelectorAll('input, select, button, a'))
            .filter(el => {
                const searchStr = (el.innerText || el.value || el.placeholder || el.id || el.className || '').toLowerCase();
                return keywords.some(k => searchStr.includes(k.toLowerCase()));
            })
            .map(el => ({
                tag: el.tagName,
                id: el.id,
                name: el.name,
                className: el.className,
                text: el.innerText?.trim(),
                value: el.value,
                placeholder: el.placeholder
            }));

        // 9. Regional Elements
        const regional = Array.from(document.querySelectorAll('button, a, div, span, label'))
            .filter(el => /全區|北區|中區|南區|保固|案件型式/i.test(el.innerText || ''))
            .map(el => ({
                tag: el.tagName,
                text: el.innerText.trim(),
                className: el.className,
                id: el.id,
                is_clickable: el.onclick || el.tagName === 'BUTTON' || el.tagName === 'A'
            }));

        return { ...baseInfo, suspicious, possible_containers, tables, controls, regional };
    }, info).catch(err => ({ error: err.message, ...info }));

    const debugJsonPath = path.join(DEBUG_DIR, 'sites-dom.json');
    const debugPngPath = path.join(DEBUG_DIR, 'sites-dom.png');
    
    fs.writeFileSync(debugJsonPath, JSON.stringify(debugInfo, null, 2));
    await page.screenshot({ path: debugPngPath, fullPage: true });

    console.log(`\n[debug] Deep analysis complete:`);
    console.log(` - JSON: ${debugJsonPath}`);
    console.log(` - PNG:  ${debugPngPath}`);
}

async function debugSitesVisible() {
    if (!(await navigateTo('案場總覽'))) return;
    const frame = page.frameLocator('#main-iframe');
    console.log('[debug] 正在分析 "案場總覽" 可見結構 (debug sites-visible)...');
    
    await page.waitForTimeout(5000);

    const debugData = await frame.locator('body').evaluate(async (body) => {
        const isVisible = (el) => {
            const style = window.getComputedStyle(el);
            return el.offsetParent !== null && style.display !== 'none' && style.visibility !== 'hidden';
        };
        const getSnippet = (text, len = 300) => (text || '').replace(/\s+/g, ' ').trim().substring(0, len);
        
        const info = {
            iframe_href: window.location.href,
            page_title: document.title,
            ready_state: document.readyState
        };

        // 只找可見的 Controls
        const controls = Array.from(document.querySelectorAll('input, select, button, a'))
            .filter(isVisible)
            .filter(el => !el.closest('#edit-project-modal, #view-report-crud-container, #note-modal, #log-modal'))
            .map(el => ({
                tag: el.tagName,
                id: el.id,
                name: el.name,
                text: el.innerText?.trim(),
                value: el.value,
                placeholder: el.placeholder
            }));

        // 找可見的資料容器
        const containers = Array.from(document.querySelectorAll('div, section, ul, table'))
            .filter(isVisible)
            .filter(el => !el.closest('#edit-project-modal, #view-report-crud-container, #note-modal, #log-modal'))
            .filter(el => el.children.length > 2)
            .slice(0, 10)
            .map(el => ({
                tag: el.tagName,
                id: el.id,
                className: el.className,
                visible_child_count: Array.from(el.children).filter(isVisible).length,
                children_text: Array.from(el.children).filter(isVisible).slice(0, 10).map(c => getSnippet(c.innerText, 200))
            }));

        return { ...info, visible_controls: controls, visible_containers: containers };
    });

    const baseName = path.join(DEBUG_DIR, 'sites-visible');
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(debugData, null, 2));
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    console.log(`\n[debug] 可見分析完成！`);
    console.log(` - JSON: ${baseName}.json`);
    console.log(` - PNG:  ${baseName}.png`);
}

async function debugSitesRoot() {
    if (!(await navigateTo('案場總覽'))) return;
    const frame = page.frameLocator('#main-iframe');
    console.log('[debug] 正在分析 "案場總覽" 根容器結構 (debug sites-root)...');
    
    await page.waitForTimeout(5000);

    const debugData = await frame.locator('body').evaluate(async (body) => {
        const getElementInfo = (el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            return {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                childElementCount: el.childElementCount,
                innerText: el.innerText?.substring(0, 200).replace(/\s+/g, ' ').trim(),
                rect: { width: rect.width, height: rect.height },
                style: {
                    display: style.display,
                    visibility: style.visibility,
                    opacity: style.opacity,
                    overflow: style.overflow
                },
                has_hidden_class: el.classList.contains('hidden'),
                aria_hidden: el.getAttribute('aria-hidden')
            };
        };

        const body_children = Array.from(document.body.children).slice(0, 30).map(getElementInfo);
        
        const large_containers = Array.from(document.querySelectorAll('div, section, main, #app'))
            .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 200 && rect.height > 100 && el.childElementCount > 0;
            })
            .slice(0, 30)
            .map(el => {
                const info = getElementInfo(el);
                return {
                    ...info,
                    selector_hint: el.id ? `#${el.id}` : el.className ? `.${el.className.split(' ').join('.')}` : el.tagName,
                    innerText: el.innerText?.substring(0, 300).replace(/\s+/g, ' ').trim()
                };
            });

        const controls = Array.from(document.querySelectorAll('input, select, button'))
            .map(el => {
                const info = getElementInfo(el);
                return {
                    ...info,
                    placeholder: el.placeholder,
                    value: el.value,
                    text: el.innerText?.trim()
                };
            });

        return {
            iframe_href: window.location.href,
            page_title: document.title,
            body_children,
            large_containers,
            controls
        };
    });

    const baseName = path.join(DEBUG_DIR, 'sites-root');
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(debugData, null, 2));
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    console.log(`\n[debug] 根容器分析完成！`);
    console.log(` - JSON: ${baseName}.json`);
    console.log(` - PNG:  ${baseName}.png`);
}

async function debugSitesLive() {
    if (!(await navigateTo('案場總覽'))) return;
    const frame = page.frameLocator('#main-iframe');
    console.log('[debug] 正在分析 "案場總覽" 真實可見結構 (debug sites-live)...');
    
    await page.waitForTimeout(5000);

    const debugData = await frame.locator('body').evaluate(async (body) => {
        const getSnippet = (text, len = 200) => (text || '').replace(/\s+/g, ' ').trim().substring(0, len);
        const getElementInfo = (el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const ancestors = [];
            let curr = el.parentElement;
            while (curr && ancestors.length < 5) {
                ancestors.push({ tag: curr.tagName, id: curr.id, className: curr.className });
                curr = curr.parentElement;
            }

            const hiddenAncestor = el.closest('.hidden, [style*="display: none"], [style*="visibility: hidden"], #edit-project-modal, #view-report-crud-container, #note-modal, #log-modal, #app-view');

            return {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                innerText: getSnippet(el.innerText),
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                style: { display: style.display, visibility: style.visibility, opacity: style.opacity },
                hidden_by_ancestor: !!hiddenAncestor,
                closest_hidden_ancestor: hiddenAncestor ? { id: hiddenAncestor.id, className: hiddenAncestor.className, tag: hiddenAncestor.tagName } : null,
                ancestor_path: ancestors
            };
        };

        const EXCLUDED_SELECTORS = '#edit-project-modal, #view-report-crud-container, #note-modal, #log-modal, #app-view';
        const isExcluded = (el) => !!el.closest(EXCLUDED_SELECTORS);

        const live_elements = Array.from(document.querySelectorAll('*'))
            .filter(el => !/SCRIPT|STYLE|LINK/i.test(el.tagName))
            .filter(el => !isExcluded(el))
            .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 20 && rect.height > 20;
            })
            .slice(0, 100)
            .map(getElementInfo);

        const live_containers = Array.from(document.querySelectorAll('div, section, main, ul, table'))
            .filter(el => !isExcluded(el))
            .filter(el => {
                const rect = el.getBoundingClientRect();
                return rect.width > 200 && rect.height > 100 && el.childElementCount > 0;
            })
            .sort((a, b) => {
                const ra = a.getBoundingClientRect();
                const rb = b.getBoundingClientRect();
                return (rb.width * rb.height) - (ra.width * ra.height);
            })
            .slice(0, 20)
            .map(el => ({
                ...getElementInfo(el),
                child_count: el.childElementCount,
                children_text: Array.from(el.children).slice(0, 5).map(c => getSnippet(c.innerText, 200))
            }));

        const controls = Array.from(document.querySelectorAll('input, select, button'))
            .map(el => {
                const info = getElementInfo(el);
                return {
                    ...info,
                    placeholder: el.placeholder,
                    value: el.value,
                    is_excluded: isExcluded(el)
                };
            });

        return {
            iframe_href: window.location.href,
            page_title: document.title,
            live_elements,
            live_containers,
            controls
        };
    });

    const baseName = path.join(DEBUG_DIR, 'sites-live');
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(debugData, null, 2));
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    console.log(`\n[debug] Live DOM 分析完成！`);
    console.log(` - JSON: ${baseName}.json`);
    console.log(` - PNG:  ${baseName}.png`);
}

async function debugSitesHitmap() {
    if (!(await navigateTo('案場總覽'))) return;
    const frame = page.frameLocator('#main-iframe');
    console.log('[debug] 正在分析 "案場總覽" 真實可見結構 (debug sites-hitmap)...');
    
    await page.waitForTimeout(5000);

    const debugData = await frame.locator('body').evaluate(async (body) => {
        const getSnippet = (text, len = 200) => (text || '').replace(/\s+/g, ' ').trim().substring(0, len);
        const getElementInfo = (el) => {
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);
            const ancestors = [];
            let curr = el.parentElement;
            while (curr && ancestors.length < 8) {
                ancestors.push({ tag: curr.tagName, id: curr.id, className: curr.className });
                curr = curr.parentElement;
            }

            const EXCLUDED_SELECTORS = '#edit-project-modal, #view-report-crud-container, #note-modal, #log-modal';
            const hiddenAncestor = el.closest(EXCLUDED_SELECTORS);

            return {
                tag: el.tagName,
                id: el.id,
                className: el.className,
                innerText: getSnippet(el.innerText),
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                style: { display: style.display, visibility: style.visibility, opacity: style.opacity },
                invalid_hit_reason: hiddenAncestor ? 'hidden_root' : null,
                ancestor_path: ancestors
            };
        };

        const sampling_points = [];
        const x_steps = [10, 30, 50, 70, 90];
        const y_steps = [10, 20, 30, 40, 50, 60, 70, 80];
        
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        const hits = [];
        x_steps.forEach(xp => {
            y_steps.forEach(yp => {
                const x = (xp * vw) / 100;
                const y = (yp * vh) / 100;
                const el = document.elementFromPoint(x, y);
                if (el) {
                    hits.push({ x, y, el });
                }
            });
        });

        const unique_elements = new Map();
        hits.forEach(hit => {
            const el = hit.el;
            const info = getElementInfo(el);
            const key = `${info.tag}-${info.id}-${info.className}`;
            if (!unique_elements.has(key)) {
                unique_elements.set(key, { ...info, hit_count: 1, points: [{ x: hit.x, y: hit.y }] });
            } else {
                unique_elements.get(key).hit_count++;
                unique_elements.get(key).points.push({ x: hit.x, y: hit.y });
            }
        });

        const sorted_hits = Array.from(unique_elements.values())
            .sort((a, b) => b.hit_count - a.hit_count);

        const container_hits = new Map();
        sorted_hits.forEach(hit => {
            hit.ancestor_path.forEach(anc => {
                const key = `${anc.tag}-${anc.id}-${anc.className}`;
                if (!container_hits.has(key)) {
                    container_hits.set(key, { ...anc, hit_count: 1 });
                } else {
                    container_hits.get(key).hit_count++;
                }
            });
        });

        const sorted_containers = Array.from(container_hits.values())
            .sort((a, b) => b.hit_count - a.hit_count)
            .slice(0, 20);

        return {
            iframe_href: window.location.href,
            page_title: document.title,
            viewport: { width: vw, height: vh },
            sorted_hits: sorted_hits.slice(0, 50),
            sorted_containers
        };
    });

    const baseName = path.join(DEBUG_DIR, 'sites-hitmap');
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(debugData, null, 2));
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    console.log(`\n[debug] Hitmap 分析完成！`);
    console.log(` - JSON: ${baseName}.json`);
    console.log(` - PNG:  ${baseName}.png`);
}

async function debugSitesMutations() {
    const MAX_RETRIES = 2;
    let retryCount = 0;

    while (retryCount <= MAX_RETRIES) {
        try {
            const oldSrc = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
            console.log(`[nav] click 案場總覽 (retry: ${retryCount})`);
            console.log(`[frame] old iframe src = ${oldSrc}`);
            
            // 執行導覽
            if (!(await navigateTo('案場總覽'))) return;

            console.log(`[frame] waiting for fresh frame...`);
            
            // 穩定等待：等待 iframe 存在且 src 穩定
            let frame = null;
            for (let i = 0; i < 10; i++) {
                const f = page.frames().find(f => f.name() === 'main-iframe' || f.url().includes('sg_ops.html'));
                if (f) {
                    const ready = await f.evaluate(() => document.readyState).catch(() => 'loading');
                    if (ready === 'interactive' || ready === 'complete') {
                        frame = f;
                        break;
                    }
                }
                await page.waitForTimeout(1000);
            }

            if (!frame) {
                console.log(`[frame] stable frame not found, retrying...`);
                retryCount++;
                continue;
            }

            const freshSrc = frame.url();
            console.log(`[frame] fresh iframe src = ${freshSrc}`);
            console.log('[observer] attach success');

            const mutationHandle = await frame.evaluateHandle(async () => {
                window.__mutations = [];
                window.__snapshots = [];
                const observer = new MutationObserver((mutations) => {
                    mutations.forEach(m => {
                        if (!m.target || m.target.nodeType !== 1) return;
                        const el = m.target;
                        const rect = el.getBoundingClientRect();
                        const ancestors = [];
                        let cur = el.parentElement;
                        while (cur && ancestors.length < 8) {
                            ancestors.push({ tag: cur.tagName, id: cur.id, className: cur.className });
                            cur = cur.parentElement;
                        }
                        window.__mutations.push({
                            type: m.type,
                            target: {
                                tag: el.tagName, id: el.id, className: el.className,
                                innerText: el.innerText?.substring(0, 300).replace(/\s+/g, ' ').trim(),
                                outerHTML: el.outerHTML.substring(0, 1000),
                                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                                ancestor_path: ancestors
                            },
                            timestamp: Date.now()
                        });
                    });
                });
                observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
                const interval = setInterval(() => {
                    window.__snapshots.push({
                        timestamp: Date.now(),
                        innerText: document.body.innerText.substring(0, 1000).replace(/\s+/g, ' ').trim(),
                        childCount: document.body.childElementCount,
                        scrollHeight: document.documentElement.scrollHeight
                    });
                }, 1000);
                return {
                    stop: () => {
                        observer.disconnect();
                        clearInterval(interval);
                        return { mutations: window.__mutations, snapshots: window.__snapshots };
                    }
                };
            });

            await page.waitForTimeout(10000);
            const results = await mutationHandle.evaluate(h => h.stop()).catch(err => {
                if (err.message.includes('detached')) throw err;
                return { mutations: [], snapshots: [] };
            });

            const bodyData = await frame.evaluate(() => {
                const getInfo = (el) => {
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);
                    return {
                        tag: el.tagName, id: el.id, className: el.className,
                        rect: { width: rect.width, height: rect.height },
                        innerText: el.innerText.substring(0, 200).replace(/\s+/g, ' ').trim(),
                        style: { display: style.display, visibility: style.visibility, opacity: style.opacity }
                    };
                };
                return {
                    outerHTML_start: document.body.outerHTML.slice(0, 5000),
                    children: Array.from(document.body.children).map(getInfo)
                };
            }).catch(() => ({ outerHTML_start: '', children: [] }));

            const debugData = {
                iframe_href: frame.url(),
                page_title: await page.title(),
                results,
                body_analysis: bodyData
            };

            const baseName = path.join(DEBUG_DIR, 'sites-mutations');
            fs.writeFileSync(`${baseName}.json`, JSON.stringify(debugData, null, 2));
            await page.screenshot({ path: `${baseName}.png`, fullPage: true });

            console.log(`[done] Mutation 分析完成！`);
            return;

        } catch (err) {
            if (err.message.includes('detached')) {
                console.log(`[observer] frame detached, retrying... (${retryCount}/${MAX_RETRIES})`);
                retryCount++;
            } else {
                console.log(`執行錯誤: ${err.message}`);
                return;
            }
        }
    }

    console.log('[abort] iframe kept detaching before observer could stabilize');
}

async function debugSitesNav() {
    console.log('[debug] 正在分析 "維運管理系統" 選單結構與導覽行為 (debug sites-nav)...');
    
    // 確保回到首頁且選單可見
    await page.goto('https://solargarden-web-prod.web.app/main.html', { waitUntil: 'load' });
    
    // 展開「維運管理系統」如果是摺疊的話
    const parentMenu = page.locator('.main-nav-item:has-text("維運管理系統")');
    if (await parentMenu.count() > 0) {
        const isExpanded = await parentMenu.evaluate(el => el.classList.contains('active') || el.nextElementSibling?.offsetParent !== null);
        if (!isExpanded) {
            console.log('[nav] 嘗試展開 維運管理系統...');
            await parentMenu.click();
            await page.waitForTimeout(1000);
        }
    }

    const navItems = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('.sub-nav-item, .main-nav-item, a, button, div'))
            .filter(el => /案場總覽/i.test(el.innerText))
            .map(el => {
                const rect = el.getBoundingClientRect();
                return {
                    tag: el.tagName,
                    id: el.id,
                    className: el.className,
                    text: el.innerText.trim(),
                    outerHTML: el.outerHTML.substring(0, 500),
                    onclick: el.getAttribute('onclick'),
                    data_attrs: Object.assign({}, el.dataset),
                    rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
                    is_visible: rect.width > 0 && rect.height > 0
                };
            });
        return items;
    });

    const results = {
        candidates: navItems,
        tests: []
    };

    console.log(`[debug] 找到 ${navItems.length} 個「案場總覽」候選元素。`);

    for (let i = 0; i < navItems.length; i++) {
        const item = navItems[i];
        if (!item.is_visible) continue;

        console.log(`[test] 測試候選元素 #${i}: ${item.tag}.${item.className}`);
        const oldSrc = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
        
        // 測試不同點擊方式
        const methods = ['locator.click', 'evaluate.click'];
        for (const method of methods) {
            console.log(`  -> 正在測試點擊方式: ${method}`);
            try {
                if (method === 'locator.click') {
                    // 使用 text 鎖定
                    await page.locator(`${item.tag}:has-text("案場總覽")`).nth(i).click();
                } else {
                    await page.evaluate((idx) => {
                        const els = Array.from(document.querySelectorAll('*')).filter(el => /案場總覽/i.test(el.innerText));
                        if (els[idx]) els[idx].click();
                    }, i);
                }
                
                await page.waitForTimeout(3000);
                const newSrc = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
                const success = newSrc !== oldSrc && !newSrc.includes('home.html');
                
                results.tests.push({
                    index: i,
                    method,
                    oldSrc,
                    newSrc,
                    success
                });

                if (success) {
                    console.log(`  [win] 點擊成功！iframe 已切換至: ${newSrc}`);
                    break;
                } else {
                    console.log(`  [fail] iframe src 未改變或仍為 home.html: ${newSrc}`);
                }
            } catch (err) {
                console.log(`  [error] 測試失敗: ${err.message}`);
            }
        }
    }

    const baseName = path.join(DEBUG_DIR, 'sites-nav');
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(results, null, 2));
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    const won = results.tests.find(t => t.success);
    if (!won) {
        console.log('\n[abort] 案場總覽 nav target not resolved');
    } else {
        console.log(`\n[done] 分析完成！有效點擊方式為: ${won.method}`);
    }
}

async function debugSitesNavDeep() {
    console.log('[debug] 正在執行 "案場總覽" 深度導航分析 (debug sites-nav-deep)...');
    
    await page.goto('https://solargarden-web-prod.web.app/main.html', { waitUntil: 'load' });
    
    const parentMenu = page.locator('.main-nav-item:has-text("維運管理系統")');
    if (await parentMenu.count() > 0) {
        await parentMenu.click();
        await page.waitForTimeout(1000);
    }

    const candidates = await page.evaluate(() => {
        const getInfo = (el) => {
            const rect = el.getBoundingClientRect();
            return {
                tag: el.tagName, id: el.id, className: el.className,
                text: el.innerText.trim(),
                onclick: el.getAttribute('onclick'),
                role: el.getAttribute('role'),
                aria_expanded: el.getAttribute('aria-expanded'),
                data_attrs: Object.assign({}, el.dataset),
                outerHTML: el.outerHTML.substring(0, 800),
                rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
            };
        };
        return Array.from(document.querySelectorAll('*'))
            .filter(el => /案場總覽/i.test(el.innerText) && el.innerText.trim().length < 20)
            .map((el, idx) => {
                const ancestors = [];
                let curr = el.parentElement;
                while (curr && ancestors.length < 6) {
                    ancestors.push(getInfo(curr));
                    curr = curr.parentElement;
                }
                return { index: idx, self: getInfo(el), ancestors };
            });
    });

    const results = { candidates, tests: [] };
    console.log(`[debug] 找到 ${candidates.length} 個候選元素。`);

    for (let cIdx = 0; cIdx < candidates.length; cIdx++) {
        const targets = [candidates[cIdx].self, ...candidates[cIdx].ancestors];
        for (let tIdx = 0; tIdx < targets.length; tIdx++) {
            const target = targets[tIdx];
            if (target.rect.width === 0) continue;

            for (const method of ['locator.click', 'evaluate.click']) {
                const oldState = await page.evaluate(() => ({
                    src: document.querySelector('#main-iframe')?.src,
                    body: document.body.className
                }));

                console.log(`[test] Cand#${cIdx} Lvl#${tIdx} (${target.tag}) via ${method}`);
                let testStatus = 'no_change';
                let errorMsg = null;

                try {
                    if (method === 'locator.click') {
                        await page.evaluate(({ cI, tI }) => {
                            const cands = Array.from(document.querySelectorAll('*')).filter(el => /案場總覽/i.test(el.innerText) && el.innerText.trim().length < 20);
                            let el = cands[cI];
                            for(let i=0; i<tI; i++) el = el.parentElement;
                            el.scrollIntoView();
                        }, { cI: cIdx, tI: tIdx });
                        await page.mouse.click(target.rect.x + target.rect.width/2, target.rect.y + target.rect.height/2);
                    } else {
                        await page.evaluate(({ cI, tI }) => {
                            const cands = Array.from(document.querySelectorAll('*')).filter(el => /案場總覽/i.test(el.innerText) && el.innerText.trim().length < 20);
                            let el = cands[cI];
                            for(let i=0; i<tI; i++) el = el.parentElement;
                            el.click();
                        }, { cI: cIdx, tI: tIdx });
                    }

                    await page.waitForTimeout(3000);
                    const newState = await page.evaluate(() => ({
                        src: document.querySelector('#main-iframe')?.src,
                        body: document.body.className
                    }));

                    const srcChanged = newState.src !== oldState.src && !newState.src?.includes('home.html');
                    if (srcChanged) testStatus = 'success';
                    else if (newState.body !== oldState.body) testStatus = 'class_changed';

                    results.tests.push({
                        cIdx, tIdx, method, status: testStatus,
                        oldSrc: oldState.src, newSrc: newState.src,
                        targetTag: target.tag, targetClass: target.className
                    });

                    if (testStatus === 'success') {
                        console.log(`  [win] SUCCESS! src: ${newState.src}`);
                        break;
                    }
                } catch (err) {
                    console.log(`  [error] ${err.message}`);
                    results.tests.push({ cIdx, tIdx, method, status: 'test_error', error: err.message });
                }
            }
            if (results.tests.some(t => t.status === 'success' && t.cIdx === cIdx && t.tIdx === tIdx)) break;
        }
    }

    const baseName = path.join(DEBUG_DIR, 'sites-nav-deep');
    fs.writeFileSync(`${baseName}.json`, JSON.stringify(results, null, 2));
    await page.screenshot({ path: `${baseName}.png`, fullPage: true });

    const win = results.tests.find(t => t.status === 'success');
    if (win) console.log(`\n[done] Valid target found at Lvl#${win.tIdx}`);
    else console.log('\n[abort] Navigation tests complete, no success detected.');
}

async function doScan() {
    console.log('[scan] 開始掃描全站選單...');
    const menuItems = await page.evaluate(() => {
        return Array.from(document.querySelectorAll('.sub-nav-item[data-perm]'))
                    .map(el => el.innerText.trim())
                    .filter(Boolean);
    });
    console.log(`[scan] 找到 ${menuItems.length} 個選單標籤:`);
    console.log(menuItems.map(m => ` - ${m}`).join('\n'));
}

async function promptEnter() {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => rl.question('', () => {
        rl.close();
        resolve();
    }));
}

async function doLogin() {
    console.log('[login] opening browser...');
    try {
        await initBrowser();
        if (!page) throw new Error('Failed to initialize page');
        
        const startUrl = 'https://solargarden-web-prod.web.app/main.html';
        console.log(`[login] navigating to ${startUrl}...`);
        await page.goto(startUrl, { waitUntil: 'load' });
        
        console.log('[login] waiting for manual login...');
        console.log('  -> 請在彈出的瀏覽器中完成登入，直到看見儀表板。');
        console.log('  -> 完成後，回到此處按 Enter 繼續...');
        await promptEnter();
        
        const loggedIn = await checkLoggedIn();
        if (loggedIn) {
            console.log('[login] session saved');
        } else {
            console.log('[login] login not detected');
        }
    } catch (err) {
        console.log(`[error] login launch failed: ${err.message}`);
    }
}

async function handleCommand(line, rl) {
    const input = line.trim();
    if (!input) {
        if (rl) rl.prompt();
        return;
    }
    const [cmd, arg1, arg2] = input.split(/\s+/);

    try {
        switch (cmd) {
            case 'help':
                console.log('\n支援指令:');
                console.log('  login                    - 開啟瀏覽器協助手動登入');
                console.log('  scan                     - 盤點左側所有選單');
                console.log('  extract projects         - 抽取專案記錄');
                console.log('  extract reports          - 抽取通報記錄');
                console.log('  extract north-reports    - 抽取通報記錄 (僅限北區)');
                console.log('  extract north-sites      - 抽取案場總覽 (僅限北區)');
                console.log('  debug sites-nav          - 分析左側選單點擊與導覽');
                console.log('  debug sites-nav-deep     - 深度分析選單祖先鏈與點擊');
                console.log('  debug sites-dom          - 分析案場總覽結構');
                console.log('  debug sites-mutations    - 深度追蹤案場載入變更');
                console.log('  refresh                  - 重新整理當前頁面');
                console.log('  close / exit             - 結束並關閉瀏覽器\n');
                break;

            case 'login':
                await doLogin();
                break;

            case 'scan': await doScan(); break;

            case 'extract':
                let type = arg1 || 'sites';
                if (type === 'north-sites') type = 'sites';
                else if (type === 'north-reports') type = 'reports';
                
                const filterRegion = arg1 === 'north-sites' ? '北區' : (arg1 === 'north-reports' ? '北區' : arg2 || null);
                
                await initBrowser();
                // 增加初始穩定等待
                await page.waitForTimeout(3000);
                
                if (await page.locator('aside.sidebar, .nav-group-title').count() === 0) {
                    console.log('[auth] 未偵測到登入狀態，啟動登入程序...');
                    await doLogin();
                    // 登入後再次等待穩定
                    await page.waitForTimeout(3000);
                }
                
                let success = await extractData(type, filterRegion);
                if (!success) {
                    console.log('[warn] 抽取失敗，嘗試第二次機會...');
                    await page.reload({ waitUntil: 'load' });
                    await page.waitForTimeout(3000);
                    await extractData(type, filterRegion);
                }
                break;

            case 'debug':
                await initBrowser();
                if (await page.locator('aside.sidebar, .nav-group-title').count() === 0) {
                    await doLogin();
                }
                if (arg1 === 'reports-dom') await debugReportsDom();
                else if (arg1 === 'reports-north') await debugNorthFilter();
                else if (arg1 === 'reports-load') await debugReportsLoad(20000);
                else if (arg1 === 'reports-external-id') await debugReportsExternalId();
                else if (arg1 === 'sites-dom') await debugSitesDom();
                else if (arg1 === 'sites-visible') await debugSitesVisible();
                else if (arg1 === 'sites-root') await debugSitesRoot();
                else if (arg1 === 'sites-live') await debugSitesLive();
                else if (arg1 === 'sites-hitmap') await debugSitesHitmap();
                else if (arg1 === 'sites-mutations') await debugSitesMutations();
                else if (arg1 === 'sites-nav') await debugSitesNav();
                else if (arg1 === 'sites-nav-deep') await debugSitesNavDeep();
                else console.log('[warn] 未知 debug 對象');
                break;

            case 'refresh':
                console.log('[refresh] 重新整理頁面...');
                await page.reload({ waitUntil: 'load' });
                break;

            case 'close':
            case 'exit':
                if (rl) rl.close();
                else await closeBrowser();
                return;

            default:
                console.log(`未知指令: ${cmd}`);
        }
    } catch (err) {
        console.log(`執行錯誤: ${err.message}`);
    }

    if (rl) rl.prompt();
}

async function closeBrowser() {
    console.log('[exit] 正在關閉瀏覽器...');
    if (context) await context.close();
    process.exit(0);
}

async function startConsole() {
    await initBrowser();
    
    // 支援直接從 CLI 帶參數執行 (例如: node ops-console.js extract north-sites)
    const args = process.argv.slice(2);
    if (args.length > 0) {
        const line = args.join(' ');
        console.log(`[cli] 偵測到參數，自動執行指令: ${line}`);
        await handleCommand(line, null);
        await closeBrowser();
        return;
    }

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: '[ops-console] command > '
    });

    console.log('\n========================================');
    console.log('營運控制台 (Resident Mode) 已啟動');
    console.log('輸入 "help" 查看支援指令');
    console.log('========================================\n');

    rl.prompt();

    rl.on('line', async (line) => {
        await handleCommand(line, rl);
    }).on('close', async () => {
        await closeBrowser();
    });

    process.on('SIGINT', async () => {
        await closeBrowser();
    });
}

startConsole().catch(err => {
    console.error('執行錯誤:', err);
    process.exit(1);
});
