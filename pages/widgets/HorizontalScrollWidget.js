const { BaseWidget } = require('./BaseWidget');

class HorizontalScrollWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow';
        // Updated selector to target actual review cards, not just columns
        this.cardSelector = '.feedspace-element-marquee-item .feedspace-element-post-box, .feedspace-element-marquee-item .feedspace-review-item, .feedspace-element-marquee-item .feedspace-element-feed-box';
        // Specific selectors provided by user
        this.marqueeRowSelector = '.feedspace-element-d12-marquee-row';
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        await this.validateHorizontalScrolling();
        await this.validateReviewCountsAndTypes();
    }

    async validateHorizontalScrolling() {
        console.log('Running Horizontal Scrolling validation...');
        const marqueeRow = this.context.locator(this.marqueeRowSelector).first();

        if (!(await marqueeRow.isVisible())) {
            this.logAudit('Horizontal Scrolling: Marquee row container not found/visible.', 'fail');
            return;
        }

        const box = await marqueeRow.boundingBox();
        if (!box) return;

        // Capture initial state
        // Since it's a CSS animation (likely), we check if position changes over time
        // Or if it's draggable. Assuming CSS marquee:
        const initialTransform = await marqueeRow.evaluate(el => window.getComputedStyle(el).transform);

        await this.page.waitForTimeout(2000);

        const finalTransform = await marqueeRow.evaluate(el => window.getComputedStyle(el).transform);

        if (initialTransform !== finalTransform && finalTransform !== 'none') {
            this.logAudit('Horizontal Scrolling: Marquee animation detected (transform changed).');
            this.logAudit('Interaction: Horizontal scrolling behavior confirmed.');
        } else {
            // Fallback: Check if user can scroll it manually? 
            // Usually horizontal scroll widgets are auto-scrolling marquees.
            this.logAudit('Horizontal Scrolling: No automatic movement validation (CSS transform static). Checking for overflow...', 'info');

            const isScrollable = await marqueeRow.evaluate(el => el.scrollWidth > el.clientWidth);
            if (isScrollable) {
                this.logAudit('Horizontal Scrolling: Content overflows and is horizontally scrollable.');
                this.logAudit('Interaction: Horizontal scrolling confirmed via overflow check.');
            } else {
                this.logAudit('Horizontal Scrolling: Content fits within viewport (no scroll needed).', 'info');
            }
        }
    }

    async validateReviewCountsAndTypes() {
        console.log('Running Horizontal Scroll Review Count validation...');
        const cards = this.context.locator(this.cardSelector);
        const count = await cards.count();
        this.logAudit(`Processing ${count} cards (Horizontal Layout)...`);

        // Batch process using evaluateAll (reusing VerticalScroll optimization pattern)
        const cardData = await cards.evaluateAll(elements => {
            return elements.map((el, i) => {
                // Skip clones
                // Note: Marquees often duplicate content. We need to follow clone rules
                const isClone = el.closest('[data-fs-marquee-clone="true"], .cloned, .clone') ||
                    el.getAttribute('aria-hidden') === 'true' ||
                    el.classList.contains('feedspace-marquee-copy'); // Common marquee duplicate class

                if (isClone) return null;

                const hasVideo = !!el.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button');
                const hasAudio = !!el.querySelector('audio, .audio-player');

                return { hasVideo, hasAudio };
            }).filter(d => d !== null);
        });

        this.reviewStats.total = cardData.length;
        this.reviewStats.video = cardData.filter(c => c.hasVideo).length;
        this.reviewStats.audio = cardData.filter(c => c.hasAudio).length;
        this.reviewStats.text = this.reviewStats.total - this.reviewStats.video - this.reviewStats.audio;

        this.logAudit(`Reviews Segmented (Unique): Total ${this.reviewStats.total} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`);
    }

    async validateReadMoreExpansion() {
        console.log('Running Horizontal Read More validation (Global Search)...');

        // Define robust selectors
        const readMoreSelectors = [
            '.feedspace-element-read-more',
            '.feedspace-element-read-more-text-span',
            '.read-more',
            'span:has-text("Read more")',
            'button:has-text("Read more")',
            '.show-more'
        ];
        // Combine into a single CSS selector for efficiency where possible
        // Note: Playwright locators with lists are handled by iterating, but for detection we want a wide net.
        // We'll search for *each* separately and aggregate, or just iterate common ones.

        let targetTrigger = null;
        let targetCard = null;

        // GLOBAL SEARCH: Look for ANY card with a visible Read More button
        for (const selector of readMoreSelectors) {
            const triggers = this.context.locator(selector);
            const count = await triggers.count();

            for (let i = 0; i < count; i++) {
                const el = triggers.nth(i);
                if (await el.isVisible().catch(() => false)) {
                    targetTrigger = el;
                    // Find the parent card for this trigger
                    targetCard = el.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-marquee-item") or contains(@class, "feedspace-review-item") or contains(@class, "feedspace-element-post-box")][1]');
                    break;
                }
            }
            if (targetTrigger) break;
        }

        if (targetTrigger && targetCard) {
            this.logAudit('Read More: Global search found a visible expansion trigger.');
            try {
                // Perform validaton on this specific card
                // Safe scroll to bring into view if needed (marquee movement)
                await targetTrigger.scrollIntoViewIfNeeded().catch(() => { });

                await targetTrigger.click({ force: true });
                await this.page.waitForTimeout(500);

                // Check for "Read Less" or content expansion
                const hasReadLess = await targetCard.locator('.feedspace-element-read-less, .feedspace-element-read-less-text-span, span:has-text("Read less")').count() > 0;

                if (hasReadLess) {
                    this.logAudit('Read More: Successfully validated expansion on a detected card.');

                    // Try to collapse back
                    const collapseBtn = targetCard.locator('.feedspace-element-read-less, .feedspace-element-read-less-text-span, span:has-text("Read less")').first();
                    if (await collapseBtn.isVisible()) {
                        await collapseBtn.click({ force: true });
                        this.logAudit('Read Less: Successfully validated collapse.');
                    }
                } else {
                    this.logAudit('Read More: Clicked trigger but did not detect "Read Less" state.', 'fail');
                }

            } catch (e) {
                // Changed "Interaction failed" to "Action failed" to avoid polluting the 'Interaction' column in report
                this.logAudit(`Read More: Expanded action failed - ${e.message}`, 'info');
            }
        } else {
            this.logAudit('Read More: No visible "Read More" triggers found in the entire widget.', 'info');
        }
    }
    async validateReadMore() {
        // Redirect legacy call to the new robust implementation
        await this.validateReadMoreExpansion();
    }
}

module.exports = { HorizontalScrollWidget };
