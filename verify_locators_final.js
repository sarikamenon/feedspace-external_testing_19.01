const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/10259168-1c69-4880-b4ee-e87896c78d34?info=1';
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(5000);

        console.log('Checking for aria-label navigation buttons...');
        const buttons = page.locator('button[aria-label]');
        const count = await buttons.count();
        console.log(`Total buttons with aria-label: ${count}`);

        for (let i = 0; i < count; i++) {
            const btn = buttons.nth(i);
            const label = await btn.getAttribute('aria-label');
            const html = await btn.evaluate(el => el.outerHTML);
            console.log(`Button ${i}: label="${label}", HTML: ${html}`);
        }

    } catch (e) {
        console.error('Error during verification:', e);
    } finally {
        await browser.close();
    }
})();
