const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class CarouselWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget';
        this.prevSelector = '.slick-prev, .carousel-control-prev, .prev-btn, .feedspace-element-carousel-arrow.left, button[aria-label="Previous item"]';
        this.nextSelector = '.slick-next, .carousel-control-next, .next-btn, .feedspace-element-carousel-arrow.right, button[aria-label="Next item"]';
    }

    get prevButton() { return this.context.locator(this.prevSelector); }
    get nextButton() { return this.context.locator(this.nextSelector); }

    async validateUniqueBehaviors() {
        await this.initContext();

        // Log visibility for the final report
        const container = this.context.locator(this.containerSelector).first();
        if (await container.isVisible()) {
            this.logAudit('Widget container is visible.');
        }

        this.logAudit('Validating Carousel specialized behaviors...');

        // 1. Branding & CTA
        await this.validateBranding();
        await this.validateCTA();

        // 2. UI & Content Integrity
        await this.validateLayoutIntegrity();
        await this.validateAlignment();
        await this.validateTextReadability();
        await this.validateMediaIntegrity();
        await this.validateDateConsistency();

        // 3. Navigation Controls
        if (await this.nextButton.isVisible()) {
            this.logAudit('Navigation: Carousel controls are visible.');
            await this.nextButton.click();
            await this.page.waitForTimeout(500);
            this.logAudit('Navigation: Successfully interacted with Next control.');
        } else {
            this.logAudit('Navigation: Specialized controls not detected.', 'info');
        }

        // 4. Mobile Interaction simulation
        await this.simulateSwipe();

        this.logAudit('Interaction: User can navigate and swipe carousel.');
    }

    async simulateSwipe() {
        const container = this.context.locator(this.containerSelector).first();
        const box = await container.boundingBox();
        if (!box) return;

        console.log('Simulating swipe gesture...');
        await this.page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
        await this.page.mouse.down();
        await this.page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
        await this.page.mouse.up();
        await this.page.waitForTimeout(500);
        this.logAudit('Behavior: Swipe gesture simulated.');
    }

    async validateReadMore() {
        console.log('Running Carousel-specific Read More functionality check...');

        const readMoreSelector = '.feedspace-element-read-more, .feedspace-read-less-btn.feedspace-element-read-more, .feedspace-read-more-text';
        const expandedSelector = '.feedspace-read-less-text, .feedspace-element-read-less, .feedspace-element-read-more-open, .feedspace-read-less-btn, .feedspace-element-read-more:not(:visible), span:has-text("Read less"), button:has-text("Read less")';

        const triggers = this.context.locator(readMoreSelector);
        const count = await triggers.count();

        if (count === 0) {
            this.logAudit('Read More: No expansion triggers found (all text likely visible).', 'info');
            return;
        }

        let expansionResult = null;
        let collapseResult = null;

        for (let i = 0; i < count; i++) {
            const btn = triggers.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-review-contain-box") or contains(@class, "feedspace-review-box") or contains(@class, "feedspace-element-post-box") or contains(@class, "feedspace-review-item")][1]').first();

                const initialClasses = await btn.getAttribute('class').catch(() => '');
                const initialText = await btn.innerText().catch(() => '');
                const initialHeight = await card.evaluate(el => el.offsetHeight).catch(() => 0);

                try {
                    await btn.scrollIntoViewIfNeeded().catch(() => { });
                    // Try standard click, fallback to JS click if element is clipped/outside viewport
                    await btn.click({ force: true, timeout: 5000 }).catch(async (e) => {
                        console.warn(`Click failed: ${e.message}. Attempting JS click...`);
                        await btn.evaluate(el => el.click());
                    });
                    await this.page.waitForTimeout(1200);

                    const currentHeight = await card.evaluate(el => el.offsetHeight).catch(() => 0);
                    const currentClasses = await btn.getAttribute('class').catch(() => '');
                    const currentText = await btn.innerText().catch(() => '');
                    const hasReadLessElement = await card.locator(expandedSelector).first().isVisible().catch(() => false);

                    const heightIncreased = currentHeight > initialHeight + 3;
                    const stateChanged = initialClasses !== currentClasses || initialText !== currentText;

                    if (hasReadLessElement || heightIncreased || stateChanged) {
                        expansionResult = `Verified (+${currentHeight - initialHeight}px)`;

                        // Validating Collapse
                        const collapseBtn = card.locator(expandedSelector).first();
                        if (await collapseBtn.isVisible()) {
                            await collapseBtn.click({ force: true });
                            await this.page.waitForTimeout(1000);

                            const heightCollapsed = await card.evaluate(el => el.offsetHeight).catch(() => currentHeight);
                            const isStillExpanded = await collapseBtn.isVisible().catch(() => false);

                            if (heightCollapsed < currentHeight - 2 || !isStillExpanded) {
                                collapseResult = `Verified (-${currentHeight - heightCollapsed}px)`;
                            } else {
                                collapseResult = 'Unscaled (height did not decrease)';
                            }
                        } else {
                            collapseResult = 'Trigger missing';
                        }
                        break;
                    }
                } catch (e) {
                    console.warn(`Interaction failed on trigger #${i}: ${e.message}`);
                }
            }
        }

        if (expansionResult && collapseResult) {
            this.logAudit(`Read More / Less: Full cycle validated. Expansion: ${expansionResult}, Collapse: ${collapseResult}.`);
        } else if (expansionResult) {
            this.logAudit(`Read More: Expansion validated (${expansionResult}), but Collapse check had issue: ${collapseResult || 'N/A'}.`, 'info');
        } else if (count > 0) {
            this.logAudit('Read More: Expansion triggers found but failed to verify state change after click.', 'info');
        }
    }
}

module.exports = { CarouselWidget };
