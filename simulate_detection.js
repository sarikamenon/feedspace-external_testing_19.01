const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        await page.goto(url, { waitUntil: 'networkidle' });
        await page.waitForTimeout(5000);

        const detectors = {
            floatingcards: '.feedspace-floating-widget.show-left-bottom.close-active, .feedspace-floating-widget',
            carousel: '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget',
            stripslider: '.feedspace-marque-main-wrap, .feedspace-show-overlay',
            avatargroup: '.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center[data-feed-id], .fe-avatar-group-container',
            avatarslider: '.feedspace-single-review-widget, .feedspace-show-left-right-shadow',
            verticalscroll: '.feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow',
            horizontalscroll: '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow, .feedspace-element-container.feedspace-element-horizontal-scroll-widget',
            masonry: '.feedspace-element-container:not(.feedspace-carousel-widget):not(.feedspace-element-horizontal-scroll-widget)'
        };

        const frames = page.frames();
        console.log(`Scanning ${frames.length} frames...`);

        for (const frame of frames) {
            console.log(`\nFrame: ${frame.url().substring(0, 100)}`);
            for (const [type, selector] of Object.entries(detectors)) {
                const count = await frame.locator(selector).count();
                if (count > 0) {
                    const isVisible = await frame.locator(selector).first().isVisible();
                    console.log(`  MATCH: ${type} (${count} found, first visible: ${isVisible})`);
                }
            }
        }

    } catch (e) {
        console.error(e);
    }
    await browser.close();
})();
