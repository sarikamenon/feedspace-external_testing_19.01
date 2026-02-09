const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);

        const htmlData = await page.evaluate(() => {
            const getInfo = (el) => ({
                tag: el.tagName,
                classes: el.className,
                id: el.id,
                feedId: el.getAttribute('data-feed-id'),
                text: el.innerText ? el.innerText.substring(0, 20) : ''
            });

            const mainContainers = Array.from(document.querySelectorAll('.feedspace-embed-main, .feedspace-element-container, .fe-feedspace-avatar-group-widget-wrap, .fe-widget-center, .feedspace-single-review-widget, .feedspace-show-left-right-shadow'));

            return mainContainers.map(c => {
                return {
                    self: getInfo(c),
                    children: Array.from(c.querySelectorAll('*')).slice(0, 10).map(getInfo)
                };
            });
        });

        console.log('--- DETECTED CONTAINERS ---');
        console.log(JSON.stringify(htmlData, null, 2));

    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
