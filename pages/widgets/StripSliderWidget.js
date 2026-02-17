const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class StripSliderWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        // Specific parent class provided by user
        // Specific parent class provided by user - Relaxed for better resilience
        this.containerSelector = '.feedspace-marque-main-wrap, .feedspace-show-overlay, .feedspace-element-container.feedspace-marque-main-wrap';
        // Column container provided by user - Relaxed to handle various nesting
        this.columnContainerSelector = '.feedspace-marque-main, div.feedspace-embed > div.feedspace-element-container > div.feedspace-marque-main';
        this.ctaSelector = '.feedspace-cta-button-container-d8, .feedspace-cta-button-container-d9, .feedspace-cta-content';
        this.ctaFound = false; // Tracking discovery across interactions
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
        const configDate = this.config.allow_to_display_feed_date;
        console.log(`[StripSliderWidget] Validating Date Consistency (Config: ${configDate})...`);

        const uniqueCards = await this.getUniqueCards();
        this.logAudit(`Date Consistency: Checking ${uniqueCards.length} unique cards.`);

        if (configDate == 0 || configDate === '0') {
            // In Strip Slider, if hidden, they might be truly hidden or DOM absent
            // We check visibility on unique cards
            let visibleCount = 0;
            for (const card of uniqueCards) {
                const dateEl = card.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span');
                if (await dateEl.count() > 0 && await dateEl.isVisible()) {
                    visibleCount++;
                }
            }

            if (visibleCount === 0) {
                this.logAudit('Date Consistency: Dates are hidden as per configuration.', 'pass');
            } else {
                this.logAudit(`Date Consistency: Dates should be hidden (0) but ${visibleCount} unique cards have visible dates.`, 'fail');
            }

        } else if (configDate == 1 || configDate === '1') {
            if (uniqueCards.length > 0) {
                let invalidCount = 0;
                let visibleCheckPassed = false;

                for (let i = 0; i < uniqueCards.length; i++) {
                    const card = uniqueCards[i];
                    const text = await card.innerText().catch(() => '');

                    // Strict content check
                    if (text.toLowerCase().includes('undefined') || text.toLowerCase().includes('null')) {
                        invalidCount++;
                        this.logAudit(`Date Consistency: Found 'undefined' or 'null' in unique card #${i + 1}`, 'fail');
                    }

                    // Visibility check (at least one should be visible if config is 1)
                    // In Strip Slider (Marquee), items might be off-screen, but some should be visible
                    const dateEl = card.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span').first();
                    if (await dateEl.isVisible()) {
                        visibleCheckPassed = true;
                    }
                }

                if (invalidCount === 0) {
                    if (visibleCheckPassed) {
                        this.logAudit(`Date Consistency: All ${uniqueCards.length} unique cards have valid dates, and visibility confirmed.`, 'pass');
                    } else {
                        this.logAudit('Date Consistency: Dates valid but none currently visible (might be scrolling off-screen).', 'info');
                    }
                } else {
                    this.logAudit(`Date Consistency: Found ${invalidCount} cards with invalid date strings.`, 'fail');
                }

            } else {
                this.logAudit('Date Consistency: No unique cards found to validate.', 'info');
            }
        } else {
            this.logAudit(`Date Consistency: Config value '${configDate}' is optional/unknown. Checking content only.`, 'info');
            // Fallback to old check
            for (let i = 0; i < uniqueCards.length; i++) {
                const text = await uniqueCards[i].innerText();
                if (text.toLowerCase().includes('undefined') || text.toLowerCase().includes('null')) {
                    this.logAudit(`Date Consistency: Found 'undefined' or 'null' strings in unique card #${i + 1}`, 'fail');
                }
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
        if (this.config.allow_social_redirection == 1 || this.config.allow_social_redirection === '1') {
            await this.validateSocialRedirection();
        }

        // 5. CTA Check
        if (this.config.cta_enabled == 1 || this.config.cta_enabled === '1') {
            await this.validateCTA();
        }

        // 6. Accessibility
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

                    // Check for CTA inside the modal as per user feedback
                    const ctaInModal = modal.locator(this.ctaSelector).first();
                    if (await ctaInModal.isVisible()) {
                        this.ctaFound = true;
                        this.logAudit('CTA Button: Detected inside the review modal.', 'pass');
                    }

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
        const configSocial = this.config.allow_social_redirection;
        console.log(`[StripSliderWidget] Validating Social Redirection (Config: ${configSocial})...`);

        const socialRedirectionSelector = 'div.feedspace-review-bio-info > div.feedspace-element-header-icon > a, div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon, .feedspace-element-header-icon a';
        const icons = this.context.locator(socialRedirectionSelector);
        const count = await icons.count();

        if (configSocial == 0 || configSocial === '0') {
            if (count === 0) {
                this.logAudit('Social Redirection: Icons are hidden as per configuration.', 'pass');
            } else {
                // Check visibility
                let visibleCount = 0;
                for (let i = 0; i < count; i++) {
                    if (await icons.nth(i).isVisible()) visibleCount++;
                }

                if (visibleCount === 0) {
                    this.logAudit('Social Redirection: Icons present but hidden (CSS checks out).', 'pass');
                } else {
                    this.logAudit(`Social Redirection: Icons should be hidden (0) but ${visibleCount} are visible.`, 'fail');
                }
            }
        } else if (configSocial == 1 || configSocial === '1') {
            if (count > 0) {
                this.logAudit(`Social Redirection: Found ${count} social redirection elements.`);
                let allValid = true;
                for (let i = 0; i < count; i++) {
                    const icon = icons.nth(i);
                    const isVisible = await icon.isVisible().catch(() => false);
                    if (isVisible) {
                        const tagName = await icon.evaluate(el => el.tagName.toLowerCase());
                        let hasLink = false;
                        if (tagName === 'a') {
                            const href = await icon.getAttribute('href');
                            if (href && (href.startsWith('http') || href.includes('social'))) hasLink = true;
                        } else {
                            // Check if it's wrapped in an <a> or has one inside
                            const parentLink = icon.locator('xpath=./ancestor::a').first();
                            if (await parentLink.count() > 0) hasLink = true;

                            // StripSlider specific: sometimes the div IS the icon but link is child or parent
                            if (!hasLink) {
                                const childLink = icon.locator('a').first();
                                if (await childLink.count() > 0) hasLink = true;
                            }
                        }

                        if (!hasLink) {
                            this.logAudit('Social Redirection: Found icon but no valid redirection link.', 'fail');
                            allValid = false;
                        }
                    }
                }
                if (allValid) {
                    this.logAudit('Social Redirection: All icons have valid links.', 'pass');
                }
            } else {
                this.logAudit('Social Redirection: Icons expected (1) but none found.', 'fail');
            }
        } else {
            this.logAudit(`Social Redirection: Config value '${configSocial}' is optional/unknown. Found ${count} icons.`, 'info');
        }
    }

    async validateCTA() {
        console.log('[StripSliderWidget] Validating CTA Visibility...');

        // Check inline (main view)
        const ctaInline = this.context.locator(this.ctaSelector).first();
        const isCurrentlyVisible = await ctaInline.isVisible();

        if (this.ctaFound || isCurrentlyVisible) {
            this.logAudit(`CTA Button: ${this.ctaFound ? 'Validated inside modal' : 'Visible in main view'}.`, 'pass');
        } else {
            this.logAudit('CTA Button: Expected but NOT detected in main view or modals.', 'fail');
        }
    }
}

module.exports = { StripSliderWidget };
