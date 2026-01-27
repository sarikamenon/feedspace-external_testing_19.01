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
        console.log('Validating Carousel specialized behaviors...');

        // Alignment check
        await this.validateAlignment();

        // Navigation validation
        if (await this.nextButton.isVisible()) {
            this.logAudit('Navigation: Next button is visible.');
            await this.nextButton.click();
            await this.page.waitForTimeout(1000);
            this.logAudit('Navigation: Successfully clicked Next button.');
        } else {
            this.logAudit('Navigation: Navigation buttons not found.', 'info');
        }

        // Swipe simulation
        await this.simulateSwipe();
    }

    async simulateSwipe() {
        const container = this.context.locator(this.containerSelector).first();
        const box = await container.boundingBox();
        if (!box) return;

        console.log('Simulating swipe gesture...');
        await this.page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
        await this.page.mouse.down();
        await this.page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 10 });
        await this.page.mouse.up();
        await this.page.waitForTimeout(1000);
        this.logAudit('Behavior: Swipe gesture simulated.');
    }
}

module.exports = { CarouselWidget };
