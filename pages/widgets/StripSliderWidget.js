const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class StripSliderWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        // Support both containers
        this.containerSelector = '.feedspace-marque-main-wrap, .feedspace-show-overlay, .feedspace-post-slider-container';
    }

    /**
     * Helper to initialize context and set up the correct card selector 
     * based on the dynamic layout, excluding infinite scroll clones.
     */
    async configureSelectors() {
        await this.initContext();

        // Ensure widget is visible before we verify deeper behavior.
        const container = this.context.locator(this.containerSelector).first();
        await expect(container).toBeVisible({ timeout: 15000 });

        // Use a combined selector to catch cards from either layout variant
        // We carefully filter out "clones" created for the infinite scroll effect to avoid double counting.
        // The clone attribute is usually on the parent container of 'feedspace-marquee-box-inner'.
        this.cardSelector = 'div:not([data-fs-marquee-clone="true"]) > .feedspace-marquee-box-inner, .feedspace-post-slide-items';

        console.log(`[DEBUG] Configured card selector: ${this.cardSelector}`);
    }

    // Override validateVisibility to ensure selectors are configured first
    async validateVisibility(minReviews = 1) {
        await this.configureSelectors();
        await super.validateVisibility(minReviews);
    }

    // Override validateLayoutIntegrity to ensure selectors are configured first
    async validateLayoutIntegrity() {
        await this.configureSelectors();
        await super.validateLayoutIntegrity();
    }

    async validateUniqueBehaviors() {
        // configureSelectors is redundant if called by other methods first, but safe to call again
        await this.configureSelectors();
        this.logAudit('Validating Strip Slider specialized behaviors...');

        // 1. Validate Review Counts (Text, Video, Audio)
        const cards = this.context.locator(this.cardSelector);
        const cardCount = await cards.count();
        this.reviewStats.total = cardCount;
        this.reviewStats.text = 0;
        this.reviewStats.video = 0;
        this.reviewStats.audio = 0;
        this.reviewStats.cta = 0; // Track per-card CTAs

        for (let i = 0; i < cardCount; i++) {
            const card = cards.nth(i);

            // Video Detection Strategies:
            // 1. Tag-based: <video>, <iframe> (YouTube/Vimeo)
            // 2. Class-based: Play buttons (Added .feedspace-element-play-button per user feedback)
            // 3. Image-based: 'manual_video_review' in src/alt (specific to Feedspace manual videos)
            // 4. Text-based: Review text is a file path ending in .mp4 (seen in some Marquee renderings)
            const hasVideoTag = await card.locator('video').count() > 0;
            const hasIframe = await card.locator('iframe[src*="youtube"], iframe[src*="vimeo"]').count() > 0;
            const hasPlayButton = await card.locator('.video-play-button, .feedspace-element-play-feed, .play-icon, .feedspace-element-play-btn, .feedspace-element-play-button').count() > 0;
            const hasManualVideoIndicator = await card.locator('img[src*="manual_video_review"], img[alt*="Video Review"]').count() > 0;

            // Check text content for .mp4 or .mov (case insensitive) just in case the video tag isn't rendered
            // Use textContent() instead of innerText() to get text even if element is hidden/off-screen
            const cardText = await card.textContent();
            const hasVideoFileText = /\.(mp4|mov|webm)(\s|$)/i.test(cardText) || cardText.includes('video-feed');

            const hasAudio = await card.locator('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box').count() > 0;

            // Check for per-card CTA
            const hasCTA = await card.locator('.feedspace-cta-button-container-d8').count() > 0;
            if (hasCTA) {
                this.reviewStats.cta++;
            }

            if (hasVideoTag || hasIframe || hasPlayButton || hasManualVideoIndicator || hasVideoFileText) {
                this.reviewStats.video++;
            } else if (hasAudio) {
                this.reviewStats.audio++;
            } else {
                this.reviewStats.text++;
            }
        }

        this.logAudit(`Reviews Segmented: Total ${cardCount} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio}, CTA Buttons: ${this.reviewStats.cta})`);

        // 2. Validate Autoscroll Interaction (Clicking reviews)
        await this.validateAutoscrollInteraction();

        // 3. UI and Accessibility Audits
        await this.validateTextReadability();
        await this.validateMediaIntegrity();
        await this.runAccessibilityAudit();

        // 4. Branding
        await this.validateBranding();
    }

    async validateAutoscrollInteraction() {
        console.log('Validating Autoscroll Interaction...');
        this.logAudit('Interaction: Checking clickability of reviews during autoscroll.');

        const cards = this.context.locator(this.cardSelector);
        const count = await cards.count();

        if (count === 0) {
            this.logAudit('Interaction: No cards found to test interaction.', 'fail');
            return;
        }

        // Test a few cards to ensure they are clickable
        let successCount = 0;
        const checkLimit = Math.min(count, 3); // Check first 3

        for (let i = 0; i < checkLimit; i++) {
            const card = cards.nth(i);
            try {
                // Interact strategy: Hover then Click
                await card.hover({ force: true });
                await this.page.waitForTimeout(500);
                await card.click({ force: true });
                this.logAudit(`Interaction: Successfully clicked card #${i + 1}`);
                successCount++;

                // Close any potential modals
                const modal = this.page.locator('.modal, .feedspace-modal, .lightbox').first();
                if (await modal.isVisible()) {
                    await this.page.keyboard.press('Escape');
                    await this.page.waitForTimeout(500);
                }

            } catch (e) {
                this.logAudit(`Interaction: Failed to click card #${i + 1}. Error: ${e.message}`, 'fail');
            }
        }

        if (successCount === checkLimit) {
            this.logAudit(`Interaction: Successfully interacted with ${successCount}/${checkLimit} cards during scroll.`);
        } else {
            this.logAudit(`Interaction: Partial failure in interaction test.`, 'info');
        }
    }
}

module.exports = { StripSliderWidget };
