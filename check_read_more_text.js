const { chromium } = require('@playwright/test');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    try {
        const url = 'https://www.feedspace.io/widget/5bba8321-a33f-44b4-b47b-79e715e90f2e?info=1';
        console.log('Navigating to widget...');
        await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
        await page.waitForTimeout(5000);

        const checkResult = await page.evaluate(() => {
            const reviews = document.querySelectorAll('.fe-avatar-box, .fe-avatar');
            let foundInCards = 0;

            reviews.forEach(review => {
                if (review.querySelector('.feedspace-read-more-text')) {
                    foundInCards++;
                }
            });

            return {
                totalReviewsInContainer: reviews.length,
                foundInContainerCards: foundInCards
            };
        });

        console.log('--- CONTAINER CHECK ---');
        console.log(JSON.stringify(checkResult, null, 2));

        // Click first avatar and check modal
        console.log('Checking modal content...');
        const firstAvatar = page.locator('.fe-avatar-box, .fe-avatar').first();
        if (await firstAvatar.isVisible()) {
            await firstAvatar.click({ force: true });
            await page.waitForTimeout(2000);

            const modalResult = await page.evaluate(() => {
                const modal = document.querySelector('.feedspace-review-modal, .fe-review-box-inner, .fe-modal-content-wrap');
                if (!modal) return 'Modal not found';

                const readMoreText = modal.querySelector('.feedspace-read-more-text');
                return {
                    modalFound: true,
                    readMoreTextPresent: !!readMoreText,
                    htmlSnippet: readMoreText ? readMoreText.outerHTML : 'none'
                };
            });
            console.log('--- MODAL CHECK ---');
            console.log(JSON.stringify(modalResult, null, 2));
        } else {
            console.log('No avatars found to click.');
        }

    } catch (e) {
        console.error('Error during verification:', e.message);
    }
    await browser.close();
})();
