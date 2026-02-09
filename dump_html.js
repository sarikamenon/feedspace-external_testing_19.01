const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        await page.goto('https://aromaarabia.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForTimeout(10000);

        const frame = page.frame({ url: /feedspace\.io/ });
        if (frame) {
            const html = await frame.content();
            console.log('--- IFRAME HTML START ---');
            console.log(html);
            console.log('--- IFRAME HTML END ---');
        } else {
            console.log('Iframe not found');
        }

    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
