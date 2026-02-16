const { chromium } = require('playwright');
const fs = require('fs');
const { CarouselWidget } = require('./pages/widgets/CarouselWidget');

(async () => {
    const browser = await chromium.launch({ headless: false });
    const page = await browser.newPage();
    try {
        console.log('Navigating to https://aromaarabia.com/');
        await page.goto('https://aromaarabia.com/', { waitUntil: 'domcontentloaded', timeout: 60000 });

        // Wait for potential widget load
        await page.waitForTimeout(5000);

        // Simulate WidgetFactory detection
        const containerSelector = '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget';
        const containers = page.locator(containerSelector);
        const count = await containers.count();
        console.log(`Found ${count} containers matching: ${containerSelector}`);

        if (count === 0) {
            console.log('No carousel containers found via selector.');
            // Dump generic feedspace elements to see what IS there
            const allFeedspace = await page.locator('.feedspace-element-container').all();
            console.log(`Found ${allFeedspace.length} generic .feedspace-element-container elements.`);
            for (const el of allFeedspace) {
                console.log('Class:', await el.getAttribute('class'));
            }
        } else {
            for (let i = 0; i < count; i++) {
                const container = containers.nth(i);
                console.log(`\n--- Container ${i + 1} ---`);
                console.log('Container Class:', await container.getAttribute('class'));
                console.log('Container Visible:', await container.isVisible());

                // Check card selectors from CarouselWidget
                const cards = page.locator('div.feedspace-element-carousel-track > div.feedspace-element-feed-box > div.feedspace-element-feed-box-inner, .feedspace-element-feed-box, .feedspace-review-item, .swiper-slide');
                const cardCount = await cards.count();
                console.log(`\n--- Card Audit Total: ${cardCount} ---`);

                const cardData = await cards.evaluateAll(elements => elements.map((el, i) => ({
                    index: i,
                    class: el.className,
                    feedId: el.getAttribute('data-feed-id'),
                    text: el.innerText.substring(0, 50).replace(/\n/g, ' ') // Changed substring length to 50
                })));

                // Removed cardData.forEach loop as per instruction, replaced by fs.writeFileSync
                fs.writeFileSync('debug_card_info.json', JSON.stringify(cardData, null, 2));
                console.log('Wrote card data to debug_card_info.json');

                if (cardCount > 0) {
                    console.log("\nFull HTML of First Card:");
                    const firstHtml = await cards.first().evaluate(el => el.outerHTML);
                    console.log(firstHtml);

                    const firstCard = cards.first(); // Re-declare firstCard for the following checks
                    // Check for Ratings (stars)
                    const ratingSelector = '.feedspace-element-rating-box, .feedspace-element-rating, .rating, .br-wrapper';
                    const rating = firstCard.locator(ratingSelector);
                    console.log(`Rating found: ${await rating.count() > 0}`);
                    if (await rating.count() > 0) console.log('Rating HTML:', await rating.first().innerHTML());

                    // Check for Read More
                    const readMoreSelector = '.feedspace-element-read-more, .feedspace-read-less-btn.feedspace-element-read-more, .feedspace-read-more-text';
                    const readMore = firstCard.locator(readMoreSelector);
                    console.log(`Read More found: ${await readMore.count() > 0}`);

                    // Check for Date
                    const dateSelector = '.feedspace-element-date, .date';
                    // (Assuming standard classes)
                    const dateEl = firstCard.locator('.feedspace-element-date, .feedspace-date');
                    console.log(`Date found: ${await dateEl.count() > 0}`);
                } else {
                    console.log('DEBUG: Dumping inner HTML of container to analyze structure...');
                    const html = await container.innerHTML();
                    console.log(html.substring(0, 2000));
                }
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        await browser.close();
    }
})();
