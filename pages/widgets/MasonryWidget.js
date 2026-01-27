const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class MasonryWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-element-container';
        this.loadMoreButton = this.page.locator('.load-more-btn, button:has-text("Load More")');
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        console.log('Validating Masonry specialized behaviors...');

        // Grid alignment validation
        const container = this.context.locator(this.containerSelector).first();
        const display = await container.evaluate(el => window.getComputedStyle(el).display);
        if (display === 'grid' || display === 'flex' || display === 'block') {
            this.logAudit(`Layout: Detected ${display} based grid structure.`);
        }

        // Load More validation if configured
        if (this.uiRules.hasLoadMore) {
            if (await this.loadMoreButton.isVisible()) {
                this.logAudit('Behavior: Load More button is visible.');
                const initialCount = await this.context.locator(this.cardSelector).count();
                await this.loadMoreButton.click();
                await this.page.waitForTimeout(2000);
                const afterCount = await this.context.locator(this.cardSelector).count();
                if (afterCount > initialCount) {
                    this.logAudit(`Behavior: Load More successfully loaded ${afterCount - initialCount} more reviews.`);
                }
            } else {
                this.logAudit('Behavior: Load More button expected but not found.', 'info');
            }
        }
    }
}

module.exports = { MasonryWidget };
