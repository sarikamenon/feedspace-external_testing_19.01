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

        // Load More validation if configured or detected
        // Note: The user requested to click UNTIL it vanishes, so we loop.
        if (await this.loadMoreButton.isVisible()) {
            this.logAudit('Behavior: Load More button detected. Clicking until all reviews are loaded...');
            let clickCount = 0;
            const maxClicks = 20; // Safety break

            while ((await this.loadMoreButton.isVisible()) && clickCount < maxClicks) {
                const preCount = await this.context.locator(this.cardSelector).count();
                await this.loadMoreButton.click();
                await this.page.waitForTimeout(2000); // Wait for fetch and render
                const postCount = await this.context.locator(this.cardSelector).count();

                if (postCount > preCount) {
                    console.log(`Load More #${clickCount + 1}: Loaded ${postCount - preCount} new items.`);
                }
                clickCount++;
            }

            if (clickCount >= maxClicks) {
                this.logAudit(`Behavior: Stopped clicking Load More after ${maxClicks} attempts (Safety Limit).`, 'info');
            } else {
                this.logAudit(`Behavior: All reviews loaded. Load More button is no longer visible.`);
            }
        }
    }
}

module.exports = { MasonryWidget };
