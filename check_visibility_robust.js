const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        console.log('Navigating with retries...');

        // Retry logic for navigation
        let success = false;
        for (let i = 0; i < 3; i++) {
            try {
                await page.goto(url, { waitUntil: 'load', timeout: 60000 });
                success = true;
                break;
            } catch (e) {
                console.log(`Attempt ${i + 1} failed: ${e.message}`);
                await new Promise(r => setTimeout(r, 2000));
            }
        }

        if (!success) throw new Error('Failed to load page after 3 attempts');

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
            const visibilityResult = await targetFrame.evaluate(() => {
                const reviews = document.querySelectorAll('.fe-avatar-box, .fe-avatar, .feedspace-review-item');
                let foundTotal = 0;
                let visibleCount = 0;

                reviews.forEach((review) => {
                    const readMore = review.querySelector('.feedspace-read-more-text');
                    if (readMore) {
                        foundTotal++;
                        const style = window.getComputedStyle(readMore);
                        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && readMore.offsetWidth > 0;
                        if (isVisible) visibleCount++;
                    }
                });

                return {
                    totalReviews: reviews.length,
                    elementsFound: foundTotal,
                    elementsVisible: visibleCount
                };
            });
            console.log('--- FINAL VISIBILITY CHECK ---');
            console.log(JSON.stringify(visibilityResult, null, 2));
        }

    } catch (e) {
        console.error('Final Error:', e.message);
    }
    await browser.close();
})();
