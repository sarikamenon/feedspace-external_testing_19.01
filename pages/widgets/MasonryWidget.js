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
        // Load More validation
        // Use context instead of page to handle iframes correctly
        const loadMore = this.context.locator('.feedspace-load-more-btn, .load-more-btn, button:has-text("Load More")').first();

        if (await loadMore.isVisible()) {
            this.logAudit('Behavior: Load More button detected. Clicking until all reviews are loaded...');
            let clickCount = 0;
            const maxClicks = 20; // Safety break

            while ((await loadMore.isVisible()) && clickCount < maxClicks) {
                const preCount = await this.context.locator(this.cardSelector).count();
                await loadMore.click();
                await this.page.waitForTimeout(3000); // Increased wait for network/render
                const postCount = await this.context.locator(this.cardSelector).count();

                if (postCount > preCount) {
                    console.log(`Load More #${clickCount + 1}: Loaded ${postCount - preCount} new items.`);
                } else {
                    console.log(`Load More #${clickCount + 1}: No new items appeared.`);
                }
                clickCount++;
            }

            // Verify it actually vanished
            if (await loadMore.isVisible()) {
                this.logAudit(`Behavior: Load More button still visible after ${clickCount} clicks.`, 'warn');
            } else {
                this.logAudit(`Behavior: Successfully loaded all content. Load More button vanished.`);
            }

            // CRITICAL: Update report stats now that all reviews are loaded
            // CRITICAL: Update report stats now that all reviews are loaded
            // Optimized: Use evaluateAll for instant counting instead of iterative await calls
            const stats = await this.context.locator(this.cardSelector).evaluateAll(cards => {
                let text = 0, video = 0, audio = 0;
                cards.forEach(card => {
                    const hasVideo = card.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed:not(.feedspace-element-audio-feed-box)') !== null;
                    const hasAudio = card.querySelector('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box') !== null;

                    if (hasVideo) video++;
                    else if (hasAudio) audio++;
                    else text++;
                });
                return { total: cards.length, text, video, audio };
            });

            this.reviewStats = Object.assign(this.reviewStats || {}, stats);
            console.log('Final Stats Calculated:', this.reviewStats); // Debug log
            this.logAudit(`Reviews Updated: Final count is ${stats.total} (Text: ${stats.text}, Video: ${stats.video}, Audio: ${stats.audio})`);

        } else {
            this.logAudit('Behavior: No Load More button found (or all content already loaded).', 'info');
        }
    }
}

module.exports = { MasonryWidget };
