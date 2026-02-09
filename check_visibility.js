const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
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
            const visibilityResult = await targetFrame.evaluate(() => {
                const reviews = document.querySelectorAll('.fe-avatar-box, .fe-avatar, .feedspace-review-item');
                let visibleReadMoreCount = 0;
                let details = [];

                reviews.forEach((review, index) => {
                    const readMore = review.querySelector('.feedspace-read-more-text');
                    if (readMore) {
                        const style = window.getComputedStyle(readMore);
                        const isVisible = style.display !== 'none' && style.visibility !== 'hidden' && readMore.offsetWidth > 0;
                        if (isVisible) visibleReadMoreCount++;
                        details.push({
                            index,
                            hasElement: true,
                            isVisible,
                            text: readMore.innerText.trim()
                        });
                    }
                });

                return {
                    visibleReadMoreCount,
                    totalElementsFound: details.length,
                    details
                };
            });
            console.log('--- VISIBILITY CHECK ---');
            console.log(JSON.stringify(visibilityResult, null, 2));
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
    await browser.close();
})();
