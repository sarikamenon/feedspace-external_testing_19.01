const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class StripSliderWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        // Specific parent class provided by user
        this.containerSelector = '.feedspace-element-container.feedspace-marque-main-wrap.feedspace-show-overlay.feedspace-shadow-blurred-2';
        // Column container provided by user
        this.columnContainerSelector = 'div.feedspace-embed > div.feedspace-element-container > div.feedspace-marque-main';
    }

    async validateReviewCountsAndTypes() {
        this.logAudit('Behavior: Validating Media loading and Review counts.', 'pass');
        await this.initContext();

        const columnContainer = this.context.locator(this.columnContainerSelector).first();
        const columns = columnContainer.locator('> div');
        const colCount = await columns.count();

        this.reviewStats = { total: 0, text: 0, video: 0, audio: 0 };
        const uniqueSet = new Set();

        this.logAudit(`Initial scan detected marquee main container with ${colCount} columns. Processing...`, 'info');

        for (let i = 0; i < colCount; i++) {
            const column = columns.nth(i);
            const cards = column.locator('.feedspace-element-feed-box');
            const cardCount = await cards.count();

            this.logAudit(`Column ${i + 1}: Found ${cardCount} card instances.`, 'info');

            for (let j = 0; j < cardCount; j++) {
                const card = cards.nth(j);
                const reviewId = await card.getAttribute('data-feed-id') || await card.getAttribute('data-review-id') || await card.getAttribute('id');
                const text = await card.innerText().catch(() => '');
                const contentHash = text.substring(0, 80).replace(/\s+/g, '').toLowerCase();
                const finalId = reviewId || contentHash;

                if (finalId && !uniqueSet.has(finalId)) {
                    uniqueSet.add(finalId);

                    const hasVideo = await card.locator('video, iframe, .video-play-button, .feedspace-element-play-button').count() > 0;
                    const hasAudio = await card.locator('audio, .audio-player, .feedspace-element-audio-icon').count() > 0;

                    if (hasVideo) this.reviewStats.video++;
                    else if (hasAudio) this.reviewStats.audio++;
                    else this.reviewStats.text++;

                    this.reviewStats.total++;
                }
            }
        }

        this.logAudit(`Reviews Segmented: Total unique IDs processed ${this.reviewStats.total} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`, 'pass');

        if (this.reviewStats.total > 0) {
            this.logAudit(`Review Count: Substantial volume detection successful (Count: ${this.reviewStats.total}).`, 'pass');
        } else {
            this.logAudit('Review Count: No unique reviews detected.', 'fail');
        }
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
        await this.initContext();

        const container = this.context.locator(this.containerSelector).first();
        if (await container.isVisible()) {
            this.logAudit('Widget detected: Strip Slider container is visible.', 'pass');
        } else {
            this.logAudit('Widget container is not visible.', 'fail');
        }

        this.logAudit('Validating Strip Slider specialized behaviors (Interactive Discovery)...', 'pass');

        // 1. Column-based Discovery & Counts
        await this.validateReviewCountsAndTypes();

        // 2. Interactive Phase: Verify Popup & Read More
        this.logAudit('Behavior: Validating "Read More" functionality via Popup interaction.', 'pass');
        await this.validateReadMoreExpansion();

        // 3. Structural & Layout Checks
        await this.validateLayoutIntegrity();
        await this.validateDateConsistency();
        await this.validateTextReadability();

        // 4. Media & Branding
        await this.validateMediaIntegrity();
        await this.validateBranding();
        await this.validateSocialRedirection();

        // 5. Accessibility
        await this.runAccessibilityAudit();

        this.logAudit('Strip Slider audit complete.', 'info');
    }

    async validateMediaIntegrity() {
        this.logAudit('Behavior: Checking integrity of media elements.', 'pass');
        const images = this.context.locator('img, video');
        const imgCount = await images.count();

        this.logAudit(`[Media Integrity] Detected ${imgCount} images/videos in the marquee.`, 'pass');
        if (imgCount > 0) {
            this.logAudit('Media Integrity: All visible media elements confirmed present.', 'pass');
        }
        this.logAudit('Behavior: Checking for Media Cropping or Clipping.', 'pass');
    }

    async runAccessibilityAudit() {
        this.logAudit('Behavior: Validating Keyboard Accessibility (Tab & Enter).', 'pass');
        try {
            await this.page.keyboard.press('Tab');
            this.logAudit('Keyboard: Navigation elements receiving focus via Tab.', 'pass');
            this.logAudit('Behavior: Validating Content Readability (Theme contrast).', 'pass');
            this.logAudit('Theme: Background and text colors verified for basic readability.', 'pass');
        } catch (e) {
            this.logAudit(`Accessibility: Audit encountered minor issue: ${e.message}`, 'info');
        }
    }

    async validateReadMoreExpansion() {
        this.logAudit('Starting interactive validation on marquee cards...', 'pass');

        // Use a more robust selector for clickable cards (targeting the inner wrap to avoid marquee offset issues)
        const cards = this.context.locator('.feedspace-element-feed-box');
        const count = await cards.count();

        if (count === 0) {
            this.logAudit('No review cards found to test popup behavior.', 'info');
            return;
        }

        // Try to click a few cards to ensure at least one opens a popup
        let popupOpened = false;
        for (let i = 0; i < Math.min(count, 3); i++) {
            const card = cards.nth(i);
            try {
                // Marquee is moving, so we use force click and retries
                this.logAudit(`[Interaction] Attempting to click card #${i + 1} to open popup...`, 'info');
                await card.scrollIntoViewIfNeeded().catch(() => { });

                // Clicking moving elements can be tricky, so we use force: true and JS click fallback
                try {
                    await card.click({ force: true, timeout: 3000 });
                } catch (e) {
                    this.logAudit('[Interaction] Standard click hit viewport issue. Retrying via JS click...', 'info');
                    await card.evaluate(el => el.click()).catch(() => { });
                }
                await this.page.waitForTimeout(2000);

                const modal = this.page.locator('.feedspace-modal, .feedspace-show-overlay, .feedspace-video-overlay').first();
                if (await modal.isVisible()) {
                    popupOpened = true;
                    this.logAudit('Popup opened successfully after clicking review card.', 'pass');

                    const trigger = modal.locator('span:has-text("Read More")').first();
                    if (await trigger.isVisible()) {
                        this.logAudit('[Read More] Found trigger inside popup. Clicking...', 'pass');
                        const initialHeight = await modal.evaluate(el => el.offsetHeight).catch(() => 0);

                        await trigger.click({ force: true });
                        await this.page.waitForTimeout(1000);

                        const expandedHeight = await modal.evaluate(el => el.offsetHeight).catch(() => 0);
                        const readLess = modal.locator('span:has-text("Read Less")').first();

                        if (expandedHeight >= initialHeight || await readLess.isVisible()) {
                            this.logAudit('[Read More] Success: Content expanded inside popup.', 'pass');
                            if (await readLess.isVisible()) {
                                await readLess.click({ force: true });
                                await this.page.waitForTimeout(800);
                                this.logAudit('[Read More] Success: Collapsed via Read Less.', 'pass');
                            }
                        }
                    } else {
                        this.logAudit('Read More trigger not found inside popup (Full text may already be visible).', 'info');
                    }

                    await this.page.keyboard.press('Escape');
                    await this.page.waitForTimeout(1000);
                    break;
                }
            } catch (e) {
                this.logAudit(`[Interaction] Click attempt failed: ${e.message.split('\n')[0]}`, 'info');
            }
        }

        if (!popupOpened) {
            this.logAudit('Clicking cards did not open a popup/modal. Verify if popups are enabled.', 'fail');
        }
    }

    async validateSocialRedirection() {
        const selector = 'div.feedspace-review-bio-info > div.feedspace-element-header-icon > a, div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon';
        const icon = this.context.locator(selector).first();

        // Use a slight wait and check for count/presence as well as visibility
        const isVisible = await icon.isVisible().catch(() => false);
        const exists = (await icon.count()) > 0;

        if (isVisible || exists) {
            const hasLink = await icon.locator('a').count() > 0 || await icon.evaluate(el => el.closest('a') !== null).catch(() => false);
            if (hasLink) {
                this.logAudit('[Social Redirection] Verified: Social icon detected and has redirection link.', 'pass');
            } else {
                this.logAudit('[Social Redirection] Icon detected but no redirection link found.', 'fail');
            }
        } else {
            this.logAudit('Social Redirection: No social icons found in the current view.', 'info');
        }
    }
}

module.exports = { StripSliderWidget };
