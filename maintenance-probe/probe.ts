import { chromium, Page, Browser, BrowserContext, Dialog } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { createObjectCsvWriter } from 'csv-writer';
import * as readline from 'readline';

// Configuration
const ENTRY_URL = 'https://solargarden-web-prod.web.app/';
const TARGET_TABLE_TITLE = '通報列表(待處理/處理中)';
const ARTIFACTS_DIR = 'C:/Users/User/.gemini/antigravity/brain/b8e61a61-9a2d-4f60-94ac-f75d071aa575/maintenance-probe';
const SCREENSHOTS_DIR = path.join(ARTIFACTS_DIR, 'screenshots');

async function prompt(question: string): Promise<string> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer);
        });
    });
}

async function runProbe() {
    let browser: Browser | null = null;
    try {
        // Ensure directories exist
        if (!fs.existsSync(ARTIFACTS_DIR)) fs.mkdirSync(ARTIFACTS_DIR, { recursive: true });
        if (!fs.existsSync(SCREENSHOTS_DIR)) fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

        console.log('🚀 開始執行公司維運系統探測器...');
        browser = await chromium.launch({ 
            headless: false,
            args: [] 
        });
        const context: BrowserContext = await browser.newContext({
            viewport: { width: 1280, height: 720 },
            ignoreHTTPSErrors: true
        });
        
        const page: Page = await context.newPage();
        
        // Dialog handler to prevent auto-dismissal
        page.on('dialog', async (dialog: Dialog) => {
            console.log(`💬 偵測到彈窗: [${dialog.type()}] ${dialog.message()}`);
            if (dialog.type() === 'beforeunload') {
                await dialog.accept();
            } else {
                console.log('請手動在瀏覽器中處理此彈窗 (或等待 30 秒自動關閉)...');
                setTimeout(async () => {
                    const dialogPage = dialog.page();
                    if (dialogPage && !dialogPage.isClosed()) {
                        try { await dialog.dismiss(); } catch (e) {}
                    }
                }, 30000);
            }
        });

        await new Promise(resolve => setTimeout(resolve, 1000));
        console.log(`🔗 正在開啟: ${ENTRY_URL}`);
        await page.goto(ENTRY_URL);

        console.log('\n請在瀏覽器中完成以下操作：');
        console.log('1. 手動登入系統');
        console.log(`2. 切換到包含「${TARGET_TABLE_TITLE}」的頁面`);
        console.log('\n完成後，請回到此視窗並按 Enter 開始探測...');

        await prompt('');

        console.log('🔎 正在探測目前頁面...');

        const tableHeaderElement = await page.locator(`text=${TARGET_TABLE_TITLE}`).first();
        if (!await tableHeaderElement.isVisible()) {
            console.error(`❌ 找不到標題為「${TARGET_TABLE_TITLE}」的表格。`);
            return;
        }

        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '01-target-table.png') });
        console.log('📸 已擷取初始頁面截圖');

        let tableElement = await page.locator('table').filter({ has: page.locator(`xpath=./preceding::*[contains(text(), "${TARGET_TABLE_TITLE}")]`) }).first();
        
        if (!await tableElement.isVisible()) {
            tableElement = await page.locator('table').first();
        }

        if (!await tableElement.isVisible()) {
            console.error('❌ 找不到目標表格。');
            return;
        }

        await tableElement.evaluate((el: HTMLElement) => el.style.border = '5px solid red');
        await page.screenshot({ path: path.join(SCREENSHOTS_DIR, '02-target-table-highlight.png') });
        console.log('📸 已擷取表格標記截圖');

        const headers = await tableElement.locator('thead th, tr:first-child th, tr:first-child td').evaluateAll((ths: Element[]) => 
            ths.map(th => th.textContent?.trim() || '')
        );
        console.log('📊 抓到的表頭:', headers);
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'north-zone-headers.json'), JSON.stringify(headers, null, 2));

        const rows = await tableElement.locator('tbody tr, tr:not(:first-child)').evaluateAll((trs: Element[], headers: string[]) => {
            return trs.map(tr => {
                const cells = Array.from(tr.querySelectorAll('td'));
                const rowData: Record<string, string> = {};
                cells.forEach((cell, index) => {
                    const header = headers[index] || `column_${index}`;
                    rowData[header] = cell.textContent?.trim() || '';
                });
                return rowData;
            });
        }, headers);

        const northZoneRows = rows.filter(row => {
            const firstValue = Object.values(row)[0] || '';
            return firstValue.includes('北區');
        });

        console.log(`✅ 抓到 ${northZoneRows.length} 筆北區資料。`);

        const mappedRows = northZoneRows.map(row => {
            const values = Object.values(row);
            return {
                region: values[0] || '',
                case_name: values[1] || '',
                case_no: values[2] || '',
                report_time: values[3] || '',
                reporter: values[4] || '',
                issue: values[5] || '',
                monitor_staff: values[6] || '',
                monitor_judgement: values[7] || '',
                monitor_note: values[8] || '',
                repair_staff: values[9] || '',
                repair_note: values[10] || '',
                repair_status: values[11] || '',
                work_date: values[12] || ''
            };
        });

        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'north-zone-rows.json'), JSON.stringify(mappedRows, null, 2));

        const csvWriter = createObjectCsvWriter({
            path: path.join(ARTIFACTS_DIR, 'north-zone-rows.csv'),
            header: [
                { id: 'region', title: 'region' },
                { id: 'case_name', title: 'case_name' },
                { id: 'case_no', title: 'case_no' },
                { id: 'report_time', title: 'report_time' },
                { id: 'reporter', title: 'reporter' },
                { id: 'issue', title: 'issue' },
                { id: 'monitor_staff', title: 'monitor_staff' },
                { id: 'monitor_judgement', title: 'monitor_judgement' },
                { id: 'monitor_note', title: 'monitor_note' },
                { id: 'repair_staff', title: 'repair_staff' },
                { id: 'repair_note', title: 'repair_note' },
                { id: 'repair_status', title: 'repair_status' },
                { id: 'work_date', title: 'work_date' },
            ]
        });
        await csvWriter.writeRecords(mappedRows);

        const summaryMd = `# North Zone Table Summary

## Target Table
**Title:** ${TARGET_TABLE_TITLE}
**Extraction Time:** ${new Date().toLocaleString()}

## Headers Detected
${headers.map((h: string) => `- ${h}`).join('\n')}

## North Zone Data Summary
**Total Rows:** ${mappedRows.length}

## Files Generated
- [Rows JSON](north-zone-rows.json)
- [Rows CSV](north-zone-rows.csv)
- [Headers JSON](north-zone-headers.json)

## Screenshots
![01-target-table](screenshots/01-target-table.png)
![02-target-table-highlight](screenshots/02-target-table-highlight.png)
`;
        fs.writeFileSync(path.join(ARTIFACTS_DIR, 'north-zone-table-summary.md'), summaryMd);

        console.log(`🏁 探測完成。輸出檔案位置: ${ARTIFACTS_DIR}`);
    } catch (err) {
        console.error('❌ 執行中出錯:', err);
        fs.appendFileSync(path.join(ARTIFACTS_DIR, 'error_log.txt'), `${new Date().toISOString()} - ${err}\n`);
    } finally {
        if (browser) await browser.close();
    }
}

runProbe().catch(err => {
    console.error('❌ 啟動出錯:', err);
    process.exit(1);
});
