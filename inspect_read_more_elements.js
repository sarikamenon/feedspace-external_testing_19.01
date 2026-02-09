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
            const result = await targetFrame.evaluate(() => {
                const reviews = document.querySelectorAll('.fe-avatar-box, .fe-avatar, .feedspace-review-item');
                let foundTotal = 0;
                let foundNames = [];

                reviews.forEach(review => {
                    if (review.querySelector('.feedspace-read-more-text')) {
                        foundTotal++;
                        const nameEl = review.querySelector('.fe-name, .feedspace-element-name');
                        if (nameEl) foundNames.push(nameEl.innerText.trim());
                    }
                });

                return {
                    totalReviewsFound: reviews.length,
                    foundWithReadMoreText: foundTotal,
                    namesWithReadMore: foundNames,
                    // Check globally in frame too
                    globalReadMoreTextCount: document.querySelectorAll('.feedspace-read-more-text').length
                };
            });
            console.log('--- FRAME INSPECTION ---');
            console.log(JSON.stringify(result, null, 2));
        } else {
            console.log('Target iframe not detected.');
        }

    } catch (e) {
        console.error('Error:', e.message);
    }
    await browser.close();
})();
