const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    try {
        console.log('Navigating to https://keywords.am/...');
        await page.goto('https://keywords.am/', { waitUntil: 'networkidle', timeout: 60000 });

        // Scroll to load lazy widgets
        console.log('Scrolling to triggers lazy loading...');
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 300;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        await page.waitForTimeout(5000);

        const frames = page.frames();
        console.log(`Found ${frames.length} frames.`);

        for (let i = 0; i < frames.length; i++) {
            const frame = frames[i];
            const url = frame.url();
            console.log(`\n--- Frame ${i}: ${url} ---`);

            const checks = {
                avatarGroup: '.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center',
                horizontalScroll: '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow, .feedspace-element-container.feedspace-element-horizontal-scroll-widget',
                anyFeedspace: '[class*="feedspace"]'
            };

            for (const [name, selector] of Object.entries(checks)) {
                try {
                    const count = await frame.locator(selector).count();
                    const isVisible = count > 0 ? await frame.locator(selector).first().isVisible() : false;
                    console.log(`  [${name}] Count: ${count}, Visible: ${isVisible}`);
                } catch (e) {
                    console.log(`  [${name}] Error: ${e.message}`);
                }
            }
        }
    } catch (err) {
        console.error('Debug script failed:', err);
    } finally {
        await browser.close();
    }
})();
