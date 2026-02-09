const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        console.log('Navigating to aromaarabia.com...');
        await page.goto('https://aromaarabia.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        console.log('Searching for Feedspace widgets...');
        // Use frameLocator to find buttons inside any Feedspace iframe
        const frame = page.frameLocator('iframe[src*="feedspace.io"]').first();

        const nextLocator = 'button[aria-label="Next item"]';
        const prevLocator = 'button[aria-label="Previous item"]';

        const nextBtn = frame.locator(nextLocator);
        const prevBtn = frame.locator(prevLocator);

        // Wait a bit for widget to load content
        await page.waitForTimeout(5000);

        const nextCount = await nextBtn.count();
        const prevCount = await prevBtn.count();

        console.log(`Next buttons found: ${nextCount}`);
        console.log(`Prev buttons found: ${prevCount}`);

        if (nextCount > 0) {
            const isVisible = await nextBtn.first().isVisible();
            const html = await nextBtn.first().evaluate(el => el.outerHTML);
            console.log(`First Next button visible: ${isVisible}`);
            console.log(`First Next button HTML: ${html}`);
        }

    } catch (e) {
        console.error('Error during verification:', e);
    } finally {
        await browser.close();
    }
})();
