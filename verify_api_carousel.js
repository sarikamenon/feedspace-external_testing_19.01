const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const apiKey = 'cfefd10f-5f02-44ca-9a35-56ebf6a39ac7';
        const url = `https://www.feedspace.io/widget/${apiKey}?info=1`;

        console.log(`Navigating to Widget: ${url}...`);
        // Use networkidle to be sure
        await page.goto(url, { waitUntil: 'networkidle', timeout: 90000 });

        console.log('\n--- DETECTION CHECK ---');
        // Wait specifically for the container with a long timeout
        const carouselSelector = '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget';
        const container = page.locator(carouselSelector).first();

        try {
            await container.waitFor({ state: 'attached', timeout: 30000 });
            console.log('SUCCESS: Carousel container attached to DOM.');
        } catch (e) {
            console.log('FAIL: Carousel container NOT found in DOM after 30s.');
            const html = await page.content();
            console.log('--- PAGE HTML SNIPPET ---');
            console.log(html.substring(0, 1000));
            return;
        }

        const isVisible = await container.isVisible();
        console.log(`Container Visible: ${isVisible}`);

        const classes = await container.evaluate(el => el.className);
        console.log(`Container Classes: ${classes}`);

        console.log('\n--- SCOPING CHECK ---');
        const nextLocator = 'button[aria-label="Next item"]';
        const prevLocator = 'button[aria-label="Previous item"]';

        const nextBtn = container.locator(nextLocator);
        const prevBtn = container.locator(prevLocator);

        const nextCount = await nextBtn.count();
        const prevCount = await prevBtn.count();

        console.log(`Scoped Next Buttons (inside carousel): ${nextCount}`);
        console.log(`Scoped Prev Buttons (inside carousel): ${prevCount}`);

        if (nextCount > 0 && prevCount > 0) {
            console.log('SUCCESS: Navigation locators are correctly scoped within the carousel container.');
            const nextHtml = await nextBtn.first().evaluate(el => el.outerHTML);
            console.log('Next Button HTML:', nextHtml);
        } else {
            console.log('FAIL: Navigation locators NOT found inside the detected carousel container.');
            // Check global just in case
            const globalNext = await page.locator(nextLocator).count();
            console.log(`Global Next Buttons: ${globalNext}`);
        }

    } catch (e) {
        console.error('Execution Error:', e);
    } finally {
        await browser.close();
    }
})();
