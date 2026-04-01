const { chromium } = require('playwright');
const path = require('path');

const USER_DATA_DIR = path.join(process.cwd(), '.playwright-profile');

async function scan() {
    const context = await chromium.launchPersistentContext(USER_DATA_DIR, {
        headless: true,
        viewport: null
    });

    const page = context.pages().length > 0 ? context.pages()[0] : await context.newPage();
    
    try {
        await page.goto('https://solargarden-web-prod.web.app/main.html', { waitUntil: 'load' });
        await page.waitForTimeout(2000); // Wait for potential redirects/loads
        
        const menuItems = await page.evaluate(() => {
            return Array.from(document.querySelectorAll('.sub-nav-item'))
                        .map(el => el.innerText.trim())
                        .filter(Boolean);
        });
        
        console.log('Available Menus:');
        console.log(JSON.stringify(menuItems, null, 2));
    } catch (e) {
        console.error('Scan failed:', e.message);
    } finally {
        await context.close();
    }
}

scan();
