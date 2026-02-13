const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class StripSliderWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        // Support both containers
        this.containerSelector = '.feedspace-marque-main-wrap, .feedspace-show-overlay, .feedspace-post-slider-container, .feedspace-marque-main';
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

        // Use all cards; we deduplicate by Review ID in the logic for accuracy.
        this.cardSelector = '.feedspace-element-feed-box.feedspace-marquee-box';

        console.log(`[DEBUG] Configured card selector: ${this.cardSelector}`);
    }

    // Override validateVisibility to ensure selectors are configured first
    async validateVisibility(minReviews = 1) {
        await this.configureSelectors();
        await super.validateVisibility(minReviews);
    }

    // Generic helper to get unique cards by Review ID
    async getUniqueCards() {
        const allCards = this.context.locator(this.cardSelector);
        const count = await allCards.count();
        const uniqueCards = [];
        const seenIds = new Set();
        for (let i = 0; i < count; i++) {
            const card = allCards.nth(i);
            const reviewId = await card.getAttribute('data-review-id').catch(() => `anon-${i}`);
            if (reviewId && !seenIds.has(reviewId)) {
                seenIds.add(reviewId);
                uniqueCards.push(card);
            }
        }
        return uniqueCards;
    }

    // Override validateLayoutIntegrity to check only unique cards
    async validateLayoutIntegrity() {
        await this.configureSelectors();
        const uniqueCards = await this.getUniqueCards();
        this.logAudit(`Layout: Verified ${uniqueCards.length} unique cards are present.`);
    }

    // Override validateDateConsistency to check only unique cards
    async validateDateConsistency() {
        await this.configureSelectors();
        this.logAudit('Validating Strip Slider date consistency (unique cards only)...');
        const uniqueCards = await this.getUniqueCards();
        for (let i = 0; i < uniqueCards.length; i++) {
            const text = await uniqueCards[i].innerText();
            const html = await uniqueCards[i].innerHTML();
            if (text.toLowerCase().includes('undefined') || text.toLowerCase().includes('null') ||
                html.toLowerCase().includes('undefined') || html.toLowerCase().includes('null')) {
                this.logAudit(`Date Consistency: Found 'undefined' or 'null' strings in unique card #${i + 1}`, 'fail', uniqueCards[i]);
            }
        }
    }

    // Override validateTextReadability to use unique cards
    async validateTextReadability() {
        await this.configureSelectors();
        const uniqueCards = await this.getUniqueCards();
        this.logAudit(`Text Readability: Checking ${uniqueCards.length} unique reviews.`);
        for (const card of uniqueCards) {
            const text = await card.innerText();
            if (text.trim().length < 5) {
                this.logAudit('Readability: Review text is too short or missing.', 'info', card);
            }
        }
    }

    // Override validateBranding to use deduplicated context
    async validateBranding() {
        await this.configureSelectors();
        const brand = this.context.locator('.feedspace-branding, [class*="branding"], :has-text("Feedspace")').first();
        if (await brand.isVisible()) {
            this.logAudit('Branding: Feedspace branding is visible.');
        } else {
            this.logAudit('Branding: No explicit branding found.', 'info');
        }
    }

    async validateUniqueBehaviors() {
        await this.configureSelectors();
        this.logAudit('Validating Strip Slider specialized behaviors (Interactive Discovery)...');

        const uniqueCards = await this.getUniqueCards();
        this.reviewStats = { total: uniqueCards.length, text: 0, video: 0, audio: 0, cta: 0 };

        for (let i = 0; i < uniqueCards.length; i++) {
            const card = uniqueCards[i];
            this.logAudit(`Discovery: Clicking unique card #${i + 1} to reveal media/controls...`);

            try {
                await card.scrollIntoViewIfNeeded().catch(() => { });
                await card.click({ force: true });
                await this.page.waitForTimeout(1500); // Wait for modal/reveal

                // Check both the active card and any potentially opened modal
                const modal = this.page.locator('.feedspace-modal, .feedspace-video-overlay, .feedspace-show-overlay, .feedspace-media-modal').first();
                const isModalVisible = await modal.isVisible();
                const searchContext = isModalVisible ? modal : card;

                // Identify Type
                const hasVideo = await searchContext.locator('.feedspace-element-play-button, .video-play-button, video, iframe[src*="youtube"]').count() > 0;
                // Broadened audio detection including text-based fallback
                const hasAudio = await searchContext.locator('.feedspace-element-audio-icon, .audio-player, audio, [class*="audio-icon"], :has-text("Audio review")').count() > 0;
                const hasCTA = await searchContext.locator('.feedspace-cta-button-container-d8, .feedspace-cta-content').count() > 0;

                if (hasCTA) this.reviewStats.cta++;
                if (hasVideo) {
                    this.reviewStats.video++;
                    this.logAudit(`Discovery: Card #${i + 1} identified as VIDEO.`);
                    await this.validatePlaybackInteraction(searchContext);
                } else if (hasAudio) {
                    this.reviewStats.audio++;
                    this.logAudit(`Discovery: Card #${i + 1} identified as AUDIO.`);
                    await this.validatePlaybackInteraction(searchContext);
                } else {
                    this.reviewStats.text++;
                }

                // Check for Read More inside the revealed context
                await this.validateReadMore(searchContext);

                // Close modal if it was opened
                if (isModalVisible) {
                    const closeBtn = this.page.locator('.feedspace-close-button, .feedspace-modal-close, [class*="close-btn"]').first();
                    if (await closeBtn.isVisible()) {
                        await closeBtn.click();
                    } else {
                        await this.page.keyboard.press('Escape');
                    }
                    await this.page.waitForTimeout(1000);
                }
            } catch (e) {
                this.logAudit(`Discovery: Interaction with card #${i + 1} failed - ${e.message.split('\n')[0]}`, 'info');
                this.reviewStats.text++; // Fallback
            }
        }

        this.logAudit(`Reviews Segmented: Total ${this.reviewStats.total} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio}, CTA Buttons: ${this.reviewStats.cta})`);

        // 4. Validate Autoscroll Interaction (Keep for audit completeness)
        await this.validateAutoscrollInteraction();
    }

    async validateReadMore(customContext = null) {
        const auditContext = customContext || this.context;
        console.log('Running Strip Slider Read More / Less verification...');

        // User specified locator: span:has-text("Read More")
        const readMoreBtn = auditContext.locator('span:has-text("Read More"), .feedspace-read-more-btn').first();

        if (!(await readMoreBtn.isVisible().catch(() => false))) {
            return; // Silent return if not found to avoid polluting logs during discovery
        }

        // Parent selector for data collection - limited scope
        const targetCard = readMoreBtn.locator('xpath=./ancestor::div[contains(@class, "feedspace-")][1]').first();

        try {
            const initialHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
            await readMoreBtn.scrollIntoViewIfNeeded().catch(() => { });
            await readMoreBtn.click({ force: true });
            await this.page.waitForTimeout(1500);

            const expandedHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);

            // User specified Read Less: div.feedspace-element-feed-box-inner > div.feedspace-element-review-contain-box > span.feedspace-read-less-btn
            const readLessBtn = this.context.locator('div.feedspace-element-feed-box-inner > div.feedspace-element-review-contain-box > span.feedspace-read-less-btn').first();
            const hasReadLess = await readLessBtn.isVisible();

            if (expandedHeight > initialHeight + 5 || hasReadLess) {
                this.logAudit(`[Read More] Read More: Expansion verified. New status: Expanded.`);
                if (hasReadLess) {
                    await readLessBtn.click({ force: true });
                    await this.page.waitForTimeout(1200);
                    this.logAudit('[Read More] Read More / Less: Full cycle validated successfully.');
                }
            } else {
                this.logAudit('[Read More] Read More: Clicked but no layout change detected.', 'info');
            }
        } catch (e) {
            this.logAudit(`[Read More] Read More / Less: Interaction failed - ${e.message.split('\n')[0]}`, 'info');
        }
    }

    async validatePlaybackInteraction(customContext = null) {
        const auditContext = customContext || this.context;
        console.log('Validating Media Playback Interaction...');
        // User provided: .feedspace-element-play-button
        const playBtn = auditContext.locator('.feedspace-element-play-button, .feedspace-element-audio-icon, [class*="play-button"], [class*="audio-icon"]').first();

        if (await playBtn.isVisible()) {
            this.logAudit('[Playback] Playback: Activation button found. Attempting interaction...', 'info');
            try {
                // If the button is already an audio/video element, or contains one, it might already be active
                await playBtn.click({ force: true });
                await this.page.waitForTimeout(2500); // Wait for stream/overlay

                // Check for overlay or player activation within the context or globally
                const playerOverlay = this.page.locator('.feedspace-video-overlay, .feedspace-modal, iframe, video, audio, .audio-player, [class*="player"]').first();
                const isPlayerActive = await playerOverlay.isVisible();

                if (isPlayerActive) {
                    this.logAudit('[Playback] Playback: Media player activated successfully.');
                } else {
                    // Fallback: Check if the button itself changed state or if there's any media element
                    const mediaCount = await auditContext.locator('video, audio, iframe').count();
                    if (mediaCount > 0) {
                        this.logAudit('[Playback] Playback: Media element detected in context.');
                    } else {
                        this.logAudit('[Playback] Playback: Activation initiated, but no player overlay detected.', 'info');
                    }
                }
            } catch (e) {
                this.logAudit(`[Playback] Playback: Interaction failed - ${e.message.split('\n')[0]}`, 'info');
            }
        }
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
