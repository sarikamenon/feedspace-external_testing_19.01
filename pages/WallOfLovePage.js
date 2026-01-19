const { expect } = require('@playwright/test');

class WallOfLovePage {
    constructor(page) {
        this.page = page;
        // Basic element locators
        this.header = this.page.locator('h1, h2, h3').first();
        // User requested to verify reviews exist in .feedspace-element-container
        this.containerInfo = this.page.locator('.feedspace-element-container');
        // Based on provided HTML, cards are .feedspace-element-feed-box inside this container
        this.reviewCards = this.containerInfo.locator('.feedspace-element-feed-box');
        this.brandingBadge = this.page.locator('.feedspace-brand-badge-wrap.feedspace-brand-info');
    }

    async navigateTo(url) {
        console.log(`Navigating to ${url}`);
        await this.page.goto(url);
        await this.page.waitForLoadState('domcontentloaded');
    }

    async verifyPageTitle() {
        const titleLocator = this.page.locator('#preview-page-title');
        await expect(titleLocator).toBeVisible();
        const text = await titleLocator.innerText();
        console.log(`Page title text: ${text}`);
        expect(text).not.toBe('');
    }

    async verifyHeading() {
        await expect(this.header).toBeVisible();
    }

    async verifyReviewsPresence(minCount) {
        // Wait for container to be visible implies page content passed skeleton loading
        await this.containerInfo.waitFor({ state: 'visible', timeout: 10000 });

        // Wait for at least one card
        await this.reviewCards.first().waitFor({ state: 'visible', timeout: 10000 });

        const count = await this.reviewCards.count();
        console.log(`\n*** VERIFICATION ***`);
        console.log(`Number of reviews found in .feedspace-element-container: ${count}`);
        console.log(`********************\n`);

        expect(count).toBeGreaterThanOrEqual(minCount);
    }

    async verifyOptionalElements(optionalElementsConfig) {
        for (const [name, config] of Object.entries(optionalElementsConfig)) {
            console.log(`Checking optional element: ${name}`);

            let selector = config.selector;
            if (!selector) {
                if (name === 'platformIcon') selector = '.platform-icon, .social-icon, .feedspace-element-header-icon'; // Added heuristic from HTML
                if (name === 'carousel') selector = '.slick-slider, .swiper-container, .carousel, .feedspace-post-slider-container';
            }

            if (selector) {
                const locator = this.page.locator(selector);
                if (await locator.count() > 0) {
                    // Just log presence, careful with visibility on carousels/hidden items
                    console.log(`  -> Found ${name} (count: ${await locator.count()}).`);
                } else {
                    console.log(`  -> ${name} not found.`);
                }
            } else {
                console.log(`  -> No selector for ${name}, skipping.`);
            }
        }
    }
}

module.exports = { WallOfLovePage };
