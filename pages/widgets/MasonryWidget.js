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

    async validateReadMore() {
        console.log('Running Masonry-specific Read More functionality check...');
        const readMoreSelectors = ['.feedspace-element-read-more', '.read-more', '.feedspace-read-more-text', '.feedspace-read-less-btn'];
        const expandedSelector = '.feedspace-read-less-text, .feedspace-element-read-less, .feedspace-element-read-more:not(.feedspace-element-read-more-open), span:has-text("Read less")';

        let targetTrigger = null;
        let targetCard = null;

        for (const selector of readMoreSelectors) {
            const triggers = this.context.locator(selector);
            const count = await triggers.count();

            for (let i = 0; i < count; i++) {
                const el = triggers.nth(i);
                if (await el.isVisible().catch(() => false)) {
                    targetTrigger = el;
                    targetCard = el.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-review-contain-box") or contains(@class, "feedspace-element-feed-box") or contains(@class, "feedspace-review-item")][1]').first();
                    break;
                }
            }
            if (targetTrigger) break;
        }

        if (targetTrigger && targetCard) {
            let expansionResult = null;
            let collapseResult = null;

            const initialHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);

            try {
                await targetTrigger.scrollIntoViewIfNeeded().catch(() => { });
                await targetTrigger.click({ force: true });
                await this.page.waitForTimeout(1000);

                const currentHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
                const hasReadLess = await targetCard.locator(expandedSelector).first().isVisible().catch(() => false);

                if (hasReadLess || currentHeight > initialHeight + 5) {
                    expansionResult = `Verified (+${currentHeight - initialHeight}px)`;

                    // --- Validate Read Less (Collapse) ---
                    const collapseBtn = targetCard.locator(expandedSelector).first();
                    if (await collapseBtn.isVisible()) {
                        await collapseBtn.click({ force: true });
                        await this.page.waitForTimeout(800);
                        const heightCollapsed = await targetCard.evaluate(el => el.offsetHeight).catch(() => currentHeight);
                        if (heightCollapsed < currentHeight - 2 || !(await collapseBtn.isVisible().catch(() => false))) {
                            collapseResult = `Verified (-${currentHeight - heightCollapsed}px)`;
                        } else {
                            collapseResult = 'Collapse failed (height did not decrease)';
                        }
                    } else {
                        collapseResult = 'Trigger missing';
                    }
                }

                if (expansionResult && collapseResult) {
                    this.logAudit(`Read More / Less: Full cycle validated in Masonry. (${expansionResult} -> ${collapseResult}).`);
                } else if (expansionResult) {
                    this.logAudit(`Read More: Expansion validated (${expansionResult}), but Collapse check failed: ${collapseResult || 'N/A'}.`, 'info');
                } else {
                    this.logAudit('Read More: Expansion triggers found but failed to verify state change.', 'info');
                }
            } catch (e) {
                this.logAudit(`Read More: Interaction failed - ${e.message.split('\n')[0]}`, 'info');
            }
        } else {
            this.logAudit('Read More: No expansion triggers found in Masonry layout.', 'info');
        }
    }
}

module.exports = { MasonryWidget };
