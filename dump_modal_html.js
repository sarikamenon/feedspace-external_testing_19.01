const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        console.log('Navigating to widget...');
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);

        // Find an avatar that has the class we saw earlier in my GREP or PREVIOUS INSPECTION
        // I want to pick one that is likely to have long text
        console.log('Opening modal...');
        const firstAvatar = page.locator('.fe-avatar-box, .fe-avatar').first();
        await firstAvatar.click({ force: true });
        await page.waitForTimeout(3000);

        const modalHtml = await page.evaluate(() => {
            const modal = document.querySelector('.feedspace-review-modal, .fe-modal-content-wrap, .fe-review-box-inner, .feedspace-element-modal-container');
            if (!modal) return 'Modal not found';
            return {
                html: modal.outerHTML,
                allClasses: Array.from(modal.querySelectorAll('*')).map(el => el.className).filter(c => c && c.includes('read'))
            };
        });

        console.log('--- MODAL DATA ---');
        console.log(JSON.stringify(modalHtml, null, 2));

    } catch (e) {
        console.error('Error:', e.message);
    }
    await browser.close();
})();
