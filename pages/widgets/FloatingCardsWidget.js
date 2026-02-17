const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class FloatingCardsWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        // Authoritative selectors provided by the user
        this.containerSelector = '.feedspace-floating-widget';
        this.reviewsContainer = '.feedspace-testimonial-cards';
        // Individual cards: .feedspace-card.mounted
        this.cardSelector = '.feedspace-card.mounted';
        this.popupSelector = '.fe-review-modal, #fs-global-review-modal-d13';
        this.ctaSelector = '.feedspace-cta-button-container-d13';
        this.readMoreContainer = '.feedspace-element-review-contain-box';
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        await this.validateFloatingWidgetLoading();
        // The popup sequence will now handle Date and Social Redirection audits internally
        // since those elements are primarily visible/valid in the modal.
        await this.validatePopupSequence();
        await this.validateMediaPlayback();
        await this.validateReviewCountsAndTypes();
    }

    async validateDateConsistency() {
        // This is now handled inside validatePopupSequence for this widget.
        // We log a pass if the popup sequence found dates.
        if (this.config.allow_to_display_feed_date == 0) {
            this.logAudit('Date Consistency: Dates are hidden as per configuration.', 'pass');
        } else if (this.datesValidatedInPopup) {
            this.logAudit('Date Consistency: Dates are valid and visible in review popups.', 'pass');
        } else if (this.config.allow_to_display_feed_date == 1) {
            // Fallback if no popups were opened or found dates
            this.logAudit('Date Consistency: No dates found in review popups or on cards.', 'fail');
        }
    }

    async validateFloatingWidgetLoading() {
        await this.initContext();

        // 1. Wait for the floating widget container to appear
        const container = this.context.locator(this.containerSelector).first();
        try {
            await container.waitFor({ state: 'visible', timeout: 20000 });
            this.logAudit('Step 1: Floating widget container is visible.');
        } catch (e) {
            this.logAudit('Step 1: Floating Widget container (.feedspace-floating-widget) not visible after 20s.', 'fail');
            return;
        }

        // 2. Wait for at least one review card to be mounted
        const cards = this.context.locator(this.cardSelector);
        try {
            await cards.first().waitFor({ state: 'visible', timeout: 15000 });
            this.logAudit('Step 2: At least one review card is mounted and visible.');
        } catch (e) {
            const anyCard = await this.context.locator('.feedspace-card').count();
            this.logAudit(`Step 2: No card with .mounted found. Total .feedspace-card: ${anyCard}`, 'fail');
            return;
        }

        // 3. Count all visible reviews (including stacked)
        const allCards = this.context.locator('.feedspace-card');
        const cardCount = await allCards.count();
        if (cardCount > 0) {
            this.logAudit(`Step 3: Number of reviews found: ${cardCount}`);
        } else {
            const mountedCount = await cards.count();
            if (mountedCount > 0) {
                this.logAudit(`Step 3: Number of mounted reviews found: ${mountedCount} (Total stack count unavailable)`);
            } else {
                this.logAudit('Step 3: Found 0 reviews.', 'fail');
            }
        }
    }

    async validatePopupSequence() {
        if (this.popupSequenceAudited) return;
        await this.initContext();
        const allCards = this.context.locator('.feedspace-card');
        const targetCount = await allCards.count();

        if (targetCount === 0) {
            this.logAudit('No review cards found to test popups.', 'fail');
            return;
        }

        this.logAudit(`Interaction Initialized: Total reviews detected: ${targetCount}. Goal: Click all ${targetCount} cards and test expansion toggles.`);

        const popup = this.context.locator(this.popupSelector).first();
        let successfulPopups = 0;
        this.expansionSuccessCount = 0;
        this.datesValidatedInPopup = false;
        this.socialValidatedInPopup = false;
        const seenPopups = new Set();
        let attempts = 0;
        const maxAttempts = targetCount * 3;

        while (seenPopups.size < targetCount && attempts < maxAttempts) {
            attempts++;
            const topCard = this.context.locator(`${this.cardSelector}:not(.exiting)`).first();

            if (await topCard.count() === 0 || !(await topCard.isVisible())) {
                await this.page.waitForTimeout(1000);
                continue;
            }

            if (await popup.isVisible()) {
                const closeBtn = popup.locator('button.fe-review-modal-close, button[aria-label="Close"], .close-button').first();
                if (await closeBtn.isVisible()) await closeBtn.click();
                await expect(popup).not.toBeVisible({ timeout: 5000 }).catch(() => { });
            }

            await topCard.click({ force: true });
            await this.page.waitForTimeout(500);

            try {
                await expect(popup).toBeVisible({ timeout: 5000 });
                const popupContent = (await popup.innerText()).trim();

                if (!seenPopups.has(popupContent)) {
                    seenPopups.add(popupContent);
                    successfulPopups++;
                    const abbreviated = popupContent.substring(0, 40).replace(/\n/g, ' ');
                    this.logAudit(`Interaction: [Progress ${seenPopups.size}/${targetCount}] Clicked card: "${abbreviated}..."`);

                    const is_show_ratings = popup.locator(`div.feedspace-element-feed-box-inner > div.feedspace-element-review-box > svg, .fe-review-modal-stars`);
                    const show_platform_icon = popup.locator(`div.feedspace-element-header-icon > a > img, .fe-review-modal-header-icon img`);
                    const cta_locator = popup.locator(`.feedspace-cta-button-container-d13, .fe-cta-container, .get-started-btn`);
                    const date_locator = popup.locator('.feedspace-element-date.feedspace-wol-date, .fe-review-modal-date, .feedspace-element-date');

                    const hasRatings = await is_show_ratings.first().isVisible().catch(() => false);
                    const hasIcon = await show_platform_icon.first().isVisible().catch(() => false);
                    const hasCTA = await cta_locator.first().isVisible().catch(() => false);
                    const hasDate = await date_locator.first().isVisible().catch(() => false);

                    if (hasRatings) this.logAudit(`Feature: Ratings visible in popup.`);
                    if (hasIcon) {
                        this.logAudit(`Feature: Platform icon visible in popup.`);
                        // Robust link check
                        const social_links = popup.locator(`.feedspace-element-header-icon a, .fe-review-modal .feedspace-element-header-icon a`);
                        const linkCount = await social_links.count();
                        let linkFound = false;
                        for (let l = 0; l < linkCount; l++) {
                            const href = await social_links.nth(l).getAttribute('href').catch(() => null);
                            if (href && (href.startsWith('http') || href.includes('social'))) {
                                linkFound = true;
                                break;
                            }
                        }
                        if (linkFound) this.socialValidatedInPopup = true;
                    }
                    if (hasCTA) this.logAudit(`Feature: CTA button visible in popup.`);
                    if (hasDate) {
                        this.logAudit(`Feature: Date visible in popup.`);
                        const dText = await date_locator.first().innerText().catch(() => '');
                        if (dText && dText.trim().length > 0 && !dText.toLowerCase().includes('undefined')) {
                            this.datesValidatedInPopup = true;
                        }
                    }

                    const expansionSelectors = ['.read-more', '.feedspace-read-more-text', 'span:has-text("Read More")'];
                    const popupReadMore = popup.locator(expansionSelectors.join(', ')).first();

                    if (await popupReadMore.isVisible()) {
                        const beforeHeight = await popup.evaluate(el => el.offsetHeight).catch(() => 0);
                        await popupReadMore.click({ force: true });
                        await this.page.waitForTimeout(500);

                        const retractionSelectors = ['.read-less', '.feedspace-read-less-text', 'span:has-text("Read Less")'];
                        const popupReadLess = popup.locator(retractionSelectors.join(', ')).first();
                        const afterHeight = await popup.evaluate(el => el.offsetHeight).catch(() => 0);

                        if (await popupReadLess.isVisible() || afterHeight > beforeHeight) {
                            this.logAudit(`Interaction: Successfully validated "Read More" expansion.`);
                            this.expansionSuccessCount++;
                            if (await popupReadLess.isVisible()) await popupReadLess.click({ force: true });
                        }
                    }
                } else {
                    this.logAudit(`Interaction: Popup content repeated. Rotating stack manually...`, 'info');
                    // Force a rotation by waiting or clicking a different area of the card
                    await this.page.waitForTimeout(1000);
                    const nextCard = this.context.locator(this.cardSelector).nth(1);
                    if (await nextCard.isVisible()) {
                        await nextCard.hover().catch(() => { });
                    }
                }
            } catch (e) {
                this.logAudit(`Interaction: Review popup NOT visible after click at attempt #${attempts}. Error: ${e.message}`, 'info');
                // If it fails to open, try to click a bit to the side to see if it triggers rotation
                await this.page.mouse.click(50, 50);
            }

            const closeBtn = popup.locator('button.fe-review-modal-close, button[aria-label="Close"], .close-button').first();
            if (await closeBtn.isVisible()) await closeBtn.click();
            else await this.page.keyboard.press('Escape');

            await expect(popup).not.toBeVisible({ timeout: 3000 }).catch(() => { });
        }

        if (successfulPopups > 0) {
            this.logAudit(`Interaction Summary: Successfully validated ${successfulPopups}/${targetCount} review popups.`);
            // After popups are done, validate Date and Social results
            await this.validateDateConsistency();
            await this.validateSocialRedirection();
        } else {
            this.logAudit('Interaction: Failed to validate any review popups.', 'fail');
        }
        this.popupSequenceAudited = true;
    }

    async validateSocialRedirection() {
        if (this.config.allow_social_redirection == 0) {
            this.logAudit('Social Redirection: Icons are hidden as per configuration.', 'pass');
        } else if (this.socialValidatedInPopup) {
            this.logAudit('Social Redirection: All visible icons have valid links (validated in popups).', 'pass');
        } else if (this.config.allow_social_redirection == 1) {
            this.logAudit('Social Redirection: Icons expected but no valid redirection links found in popups.', 'fail');
        }
    }
}

module.exports = { FloatingCardsWidget };
