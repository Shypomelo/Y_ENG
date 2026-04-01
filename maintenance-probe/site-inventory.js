const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const OUTPUT_DIR = path.join(process.cwd(), 'probe-output', 'site-inventory');
const SCREENSHOTS_DIR = path.join(OUTPUT_DIR, 'screenshots');
const USER_DATA_DIR = path.join(process.cwd(), '.playwright-profile');

if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}
if (!fs.existsSync(SCREENSHOTS_DIR)) {
    fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });
}

// Argument parsing
const args = process.argv.slice(2);
const isFreshLogin = args.includes('--fresh-login');

if (isFreshLogin && fs.existsSync(USER_DATA_DIR)) {
    console.log('[auth] --fresh-login detected, clearing old session...');
    fs.rmSync(USER_DATA_DIR, { recursive: true, force: true });
}

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
        const hasIframe = !!document.querySelector('#main-iframe');
        const hasNav = document.querySelectorAll('.sub-nav-item').length > 0;
        return hasIframe || hasNav;
    });
}

async function probe() {
    console.log('[open] 啟動持久化瀏覽器實例...');
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: false,
        viewport: null,
        args: [
            '--disable-popup-blocking',
            '--disable-infobars',
            '--window-size=1440,900'
        ]
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    context.on('page', newPage => {
        newPage.on('dialog', async dialog => {
            console.log(`[系統提示] 網頁對話框: ${dialog.message()}`);
            await dialog.dismiss().catch(() => {});
        });
    });

    const startUrl = 'https://solargarden-web-prod.web.app/main.html';
    console.log(`[open] 前往整合頁面: ${startUrl}`);
    await page.goto(startUrl, { waitUntil: 'load' }).catch(e => {
        console.log('[open] 載入有誤:', e.message);
    });

    // Check login state
    let isLoggedIn = await checkLoggedIn(page);
    if (!isLoggedIn) {
        console.log('[auth] session expired or not logged in, manual login required.');
        await promptEnter('\n[login-wait] 請手動登入。完成並停在主畫面後，回終端按 Enter 鍵開始「定點深掃」...');
        isLoggedIn = await checkLoggedIn(page);
        if (!isLoggedIn) {
            console.log('[auth] 依舊未偵測到登入狀態，請檢查頁面結構是否改變。');
        }
    } else {
        console.log('[auth] 成功沿用既有 session，跳過登入步驟。');
    }

    // Define target pages
    const targets = ['專案總覽', '專案記錄', '通報記錄'];
    console.log(`[target-filter] 正在鎖定目標頁面: ${targets.join(', ')}`);

    const menuItems = await page.evaluate((targetList) => {
        const elements = Array.from(document.querySelectorAll('.sub-nav-item[data-perm]'));
        const results = [];
        for (const el of elements) {
            const text = el.innerText.trim();
            // 精準比對關鍵字
            if (targetList.includes(text)) {
                results.push({
                    text,
                    dataPerm: el.getAttribute('data-perm')
                });
            }
        }
        return results;
    }, targets);

    console.log(`[discover-menu] 找到 ${menuItems.length} 個符合的目標選單。`);

    const deepSummaries = [];
    
    for (let i = 0; i < menuItems.length; i++) {
        const item = menuItems[i];
        console.log(`\n[click-menu] (${i+1}/${menuItems.length}) 正在深掃: ${item.text}`);

        try {
            const oldSrc = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
            
            await page.evaluate((menuText) => {
                const el = Array.from(document.querySelectorAll('.sub-nav-item'))
                                .find(e => e.innerText.trim() === menuText);
                if (el) el.click();
            }, item.text);

            console.log('[wait-iframe] 等待 iframe 內容切換與載入...');
            let newSrc = oldSrc;
            const startTime = Date.now();
            while (Date.now() - startTime < 5000) {
                newSrc = await page.evaluate(() => document.querySelector('#main-iframe')?.src);
                if (newSrc && newSrc !== oldSrc) break;
                await page.waitForTimeout(500);
            }

            const frame = page.frameLocator('#main-iframe');
            await page.waitForTimeout(3000); 

            console.log('[extract-deep] 正在執行 iframe 內部深度擷取...');
            
            const deepData = await frame.locator('body').evaluate((body, menuText) => {
                const title = body.querySelector('h1, h2, h3, .title, .page-title')?.innerText || '';
                const labels = Array.from(body.querySelectorAll('label, .form-label, .q-field__label')).map(l => l.innerText.trim()).filter(Boolean);
                const tables = Array.from(body.querySelectorAll('table'));
                const cards = Array.from(body.querySelectorAll('.card, .project-card, .v-card, .q-card'));
                
                let pageType = 'unknown';
                if (tables.length > 0) pageType = 'table';
                else if (cards.length > 0) pageType = 'card_list';
                else if (labels.length > 10) pageType = 'form';

                const tableInfo = tables.map(t => {
                    const headers = Array.from(t.querySelectorAll('th, thead td')).map(th => th.innerText.trim()).filter(Boolean);
                    const rows = Array.from(t.querySelectorAll('tbody tr')).filter(tr => tr.innerText.trim().length > 0).slice(0, 3);
                    
                    const sampleRows = rows.map(tr => {
                        const cells = Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
                        return cells;
                    });
                    
                    return { headers, totalVisibleRows: Array.from(t.querySelectorAll('tbody tr')).length, sampleRows };
                });

                const cardInfo = cards.slice(0, 3).map(c => {
                    const text = c.innerText.trim();
                    const caseNo = text.match(/案號[:\s]*([A-Z0-9-]+)/)?.[1] || '';
                    const caseName = text.match(/案名[:\s]*(.+)/)?.[1]?.split('\n')[0] || '';
                    const status = text.match(/狀態[:\s]*(.+)/)?.[1]?.split('\n')[0] || '';
                    const date = text.match(/日期[:\s]*(\d{4}[-/]\d{2}[-/]\d{2})/)?.[1] || '';
                    return { fullText: text, caseNo, caseName, status, date };
                });

                return {
                    title,
                    pageType,
                    iframeSrc: window.location.href,
                    formLabels: labels,
                    tables: tableInfo,
                    cards: cardInfo,
                    visibleRowCount: tableInfo[0]?.totalVisibleRows || cards.length
                };
            }, item.text);

            const safeLabel = item.text.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_').substring(0, 20);
            const screenshotName = `deep-${String(i+1).padStart(2, '0')}-${safeLabel}.png`;
            const screenshotPath = path.join(SCREENSHOTS_DIR, screenshotName);

            console.log(`[screenshot] 擷取畫面: ${screenshotName}`);
            await page.screenshot({ path: screenshotPath, fullPage: true });

            const entry = {
                id: i + 1,
                menu_path: item.text,
                iframe_src: deepData.iframeSrc,
                page_title: deepData.title,
                page_type: deepData.pageType,
                visible_row_count: deepData.visibleRowCount,
                table_headers: deepData.tables[0]?.headers || [],
                sample_rows: deepData.tables[0]?.sampleRows || deepData.cards || [],
                form_labels: deepData.formLabels,
                screenshot: `screenshots/${screenshotName}`,
                timestamp: new Date().toISOString()
            };

            deepSummaries.push(entry);

        } catch (e) {
            console.error(`[skip] 處理頁面錯誤 ${item.text}:`, e.message);
        }
    }

    console.log('\n[done] 深掃完成，正在存檔 deep-page-summary.json...');
    fs.writeFileSync(path.join(OUTPUT_DIR, 'deep-page-summary.json'), JSON.stringify(deepSummaries, null, 2));

    console.log('\n========================================');
    console.log('定點深掃報告總結 (持久化 Session 版)');
    console.log('========================================');
    console.log(`共完成深掃了 ${deepSummaries.length} 個目標區域。`);
    
    deepSummaries.forEach(s => {
        console.log(`\n[${s.id}] ${s.menu_path} (${s.page_type})`);
        console.log(`   Iframe Src: ${s.iframe_src}`);
        if (s.page_type === 'table') {
            console.log(`   表頭: ${s.table_headers.join(' | ')}`);
            console.log(`   可見資料列數: ${s.visible_row_count}`);
        }
    });

    console.log('\n[提示] 持久化 Context 已生效。');
    console.log('[提示] 瀏覽器保持開啟中，如需關閉請按 Ctrl + C。');
    console.log('[提示] 強制重登指令: node site-inventory.js --fresh-login');
    console.log('========================================\n');
}

probe().catch(err => {
    console.error('執行錯誤:', err);
    process.exit(1);
});
