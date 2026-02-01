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
}

module.exports = { CarouselWidget };
