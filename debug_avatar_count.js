const { chromium, devices } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();

    // Test Desktop
    console.log('--- TESTING DESKTOP ---');
    const desktopContext = await browser.newContext();
    const desktopPage = await desktopContext.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        await desktopPage.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await desktopPage.waitForTimeout(5000);

        const container = desktopPage.locator('.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center').first();
        const cards = desktopPage.locator('.fe-avatar-box:not(.fe-avatar-more):not([data-fs-marquee-clone="true"]):not(.cloned)');

        console.log(`Desktop Container Visible: ${await container.isVisible()}`);
        console.log(`Desktop Card Count: ${await cards.count()}`);

        if (await container.count() > 0) {
            const html = await container.evaluate(el => el.outerHTML.substring(0, 500));
            console.log('Container HTML (first 500 chars):', html);
        }
    } catch (e) {
        console.error('Desktop error:', e);
    }

    // Test Mobile
    console.log('\n--- TESTING MOBILE ---');
    const iPhone = devices['iPhone 12'];
    const mobileContext = await browser.newContext({ ...iPhone });
    const mobilePage = await mobileContext.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        await mobilePage.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await mobilePage.waitForTimeout(5000);

        const container = mobilePage.locator('.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center').first();
        const cards = mobilePage.locator('.fe-avatar-box:not(.fe-avatar-more):not([data-fs-marquee-clone="true"]):not(.cloned)');

        console.log(`Mobile Container Visible: ${await container.isVisible()}`);
        console.log(`Mobile Card Count: ${await cards.count()}`);
    } catch (e) {
        console.error('Mobile error:', e);
    }

    await browser.close();
})();
