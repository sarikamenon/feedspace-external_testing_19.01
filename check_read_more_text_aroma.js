const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'http://aromaarabia.com/';
        console.log(`Navigating to ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);

        const result = await page.evaluate(() => {
            const container = document.querySelector('.feedspace-carousel-widget');
            if (!container) return { found: false, note: 'Carousel container not found' };

            const readMoreTexts = container.querySelectorAll('.feedspace-read-more-text');
            return {
                found: true,
                count: readMoreTexts.length,
                snippets: Array.from(readMoreTexts).slice(0, 3).map(el => el.outerHTML.substring(0, 100))
            };
        });

        console.log('--- AROMA ARABIA CHECK ---');
        console.log(JSON.stringify(result, null, 2));

    } catch (e) {
        console.error('Error:', e.message);
    }
    await browser.close();
})();
