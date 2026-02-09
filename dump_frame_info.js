const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        console.log('Navigating...');
        await page.goto(url, { waitUntil: 'load', timeout: 60000 });
        await page.waitForTimeout(5000);

        const frames = page.frames();
        let targetFrame = null;
        for (const frame of frames) {
            if (frame.url().includes('5bba8321-a33f-44b4-b47b-79e715e90f2e')) {
                targetFrame = frame;
                break;
            }
        }

        if (targetFrame) {
            console.log('Target frame found.');

            // 1. Click an avatar to trigger popover
            await targetFrame.locator('.fe-avatar-box').first().click({ force: true });
            await page.waitForTimeout(3000);

            const result = await targetFrame.evaluate(() => {
                const allElements = document.querySelectorAll('*');
                const classes = new Set();
                allElements.forEach(el => {
                    if (el.className && typeof el.className === 'string') {
                        el.className.split(/\s+/).forEach(c => classes.add(c));
                    }
                });

                return {
                    totalElements: allElements.length,
                    classesWithRead: Array.from(classes).filter(c => c.toLowerCase().includes('read')),
                    classesWithAvatar: Array.from(classes).filter(c => c.toLowerCase().includes('avatar')),
                    classesWithModal: Array.from(classes).filter(c => c.toLowerCase().includes('modal') || c.toLowerCase().includes('pop')),
                    bodyHtmlSnippet: document.body.innerHTML.substring(0, 2000),
                    activeElementHtml: document.activeElement ? document.activeElement.outerHTML : 'none'
                };
            });
            console.log('--- FRAME DUMP ---');
            console.log(JSON.stringify(result, null, 2));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
    await browser.close();
})();
