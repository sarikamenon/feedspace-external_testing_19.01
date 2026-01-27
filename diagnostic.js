const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const url = 'https://thwindowsdoors.com/';
    console.log(`Analyzing: ${url}`);

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });

    console.log('\n--- Page Title ---');
    console.log(await page.title());

    console.log('\n--- Iframes Found ---');
    const frames = page.frames();
    console.log(`Total Frames: ${frames.length}`);
    for (const frame of frames) {
        console.log(`Frame URL: ${frame.url()}`);
    }

    console.log('\n--- Feedspace Classes Found (Across All Frames) ---');
    const results = [];
    for (const frame of frames) {
        try {
            const frameClasses = await frame.evaluate(() => {
                const allElements = Array.from(document.querySelectorAll('*'));
                const feedspaceElements = allElements.filter(el =>
                    el.className && typeof el.className === 'string' && el.className.includes('feedspace')
                );
                return feedspaceElements.map(el => ({ tag: el.tagName, class: el.className }));
            });
            if (frameClasses.length > 0) {
                results.push({ frameUrl: frame.url(), elements: frameClasses });
            }
        } catch (e) {
            console.log(`Could not access frame: ${frame.url()}`);
        }
    }
    console.log(JSON.stringify(results, null, 2));

    await browser.close();
})();
