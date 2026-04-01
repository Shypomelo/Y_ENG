const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

const USER_DATA_DIR = path.join(process.cwd(), '.playwright-profile');

async function check() {
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: true,
        viewport: { width: 1440, height: 900 }
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    try {
        console.log('Navigating to main.html...');
        await page.goto('https://solargarden-web-prod.web.app/main.html', { waitUntil: 'networkidle' });
        
        await page.waitForTimeout(5000);
        
        const url = page.url();
        const content = await page.content();
        const screenshotPath = path.join(process.cwd(), 'probe-output', 'debug', 'check-session.png');
        await page.screenshot({ path: screenshotPath, fullPage: true });
        
        console.log(`Current URL: ${url}`);
        console.log(`Screenshot saved to: ${screenshotPath}`);
        
        const isLoggedIn = await page.evaluate(() => {
            return !!document.querySelector('#main-iframe') || document.querySelectorAll('.sub-nav-item').length > 0;
        });
        console.log(`Is Logged In (per logic): ${isLoggedIn}`);
        
        fs.writeFileSync(path.join(process.cwd(), 'probe-output', 'debug', 'check-session.html'), content);
    } catch (e) {
        console.error('Check failed:', e.message);
    } finally {
        await context.close();
    }
}

check();
