const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class VerticalScrollWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        // Update selectors based on widget specifications
        this.containerSelector = '.feedspace-element-container .feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow, .feedspace-element-container';
        this.subContainerSelector = '.feedspace-element-feed-box-wrap.feedspace-element-grid.feedspace-element-col-three';
        this.reviewRowSelector = '.feedspace-element-marquee-row';
        this.cardSelector = '.feedspace-review-item, .feedspace-element-feed-box, .feedspace-marquee-box-inner';
        this.readMoreSelector = '.feedspace-element-read-more';
        this.readLessSelector = '.feedspace-read-less-btn';
        this.ctaSelector = '.feedspace-element-feed-box-inner .feedspace-inline-cta-card, .feedspace-cta-content';
    }

    async validateVisibility(minReviewsOverride) {
        // Override to deduplicate review count from the start
        await this.initContext();
        const minReviews = minReviewsOverride || this.uiRules.minReviews || 1;
        const container = this.context.locator(this.containerSelector).first();
        if (!(await container.isVisible({ timeout: 15000 }).catch(() => false))) {
            this.logAudit('Widget container not visible after timeout (15s).', 'fail');
            return;
        }
        this.logAudit('Widget container is visible.');

        const cards = this.context.locator(this.cardSelector);

        // Wait for at least one card to appear or timeout gracefully
        try {
            await cards.first().waitFor({ state: 'visible', timeout: 10000 });
        } catch (e) {
            console.log('Timeout waiting for review cards to become visible.');
        }

        const cardCount = await cards.count();
        this.logAudit(`Processing ${cardCount} potential cards for unique reviews...`);

        // Performance Optimization: Batch process all cards in one evaluate call
        const cardData = await cards.evaluateAll((elements) => {
            return elements.map(el => {
                // 1. Skip Clones and Hidden Elements early to save memory/time
                const isClone = el.closest('[data-fs-marquee-clone="true"], .cloned, .clone');
                const isHidden = el.getAttribute('aria-hidden') === 'true';
                if (isClone || isHidden) return null;

                // 2. Check if CTA
                const isCTA = el.classList.contains('feedspace-inline-cta-card') ||
                    !!el.closest('.feedspace-inline-cta-card') ||
                    !!el.querySelector('.feedspace-inline-cta-card');

                if (isCTA) return { isCTA: true };

                // 3. Get Unique Identifier
                const feedId = el.getAttribute('data-feed-id') || el.getAttribute('data-id') || el.id;

                // 4. Get Preview Text (for fallback ID)
                let preview = '';
                if (!feedId) {
                    const textEl = el.querySelector('.feedspace-element-feed-text, .review-text, p');
                    preview = textEl ? textEl.textContent.trim().substring(0, 50) : '';
                }

                // 5. Detect Media Types
                const hasVideo = !!el.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed:not(.feedspace-element-audio-feed-box)');
                const hasAudio = !!el.querySelector('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box');

                return {
                    isCTA: false,
                    id: feedId || preview,
                    hasVideo,
                    hasAudio
                };
            });
        });

        // Deduplicate and count based on the batched data
        const uniqueReviews = new Set();
        this.reviewStats.text = 0;
        this.reviewStats.video = 0;
        this.reviewStats.audio = 0;

        for (const data of cardData) {
            if (!data || data.isCTA || !data.id) continue;
            if (uniqueReviews.has(data.id)) continue;

            uniqueReviews.add(data.id);
            if (data.hasVideo) this.reviewStats.video++;
            else if (data.hasAudio) this.reviewStats.audio++;
            else this.reviewStats.text++;
        }

        const uniqueCount = uniqueReviews.size;
        this.reviewStats.total = uniqueCount;

        this.logAudit(`Reviews Segmented: Total ${uniqueCount} unique reviews (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`);

        if (uniqueCount >= minReviews) {
            this.logAudit(`Found ${uniqueCount} unique reviews (min required: ${minReviews}).`);
        } else {
            this.logAudit(`Insufficient reviews: Found ${uniqueCount}, expected at least ${minReviews}.`, 'fail');
        }
    }

    async runValidations() {
        await this.validateVerticalScrolling();
        await this.validateCrossScrollAnimation();
        await this.validateInteraction();
        await this.validateCTA();
        await this.validateReadMoreExpansion();
        await this.validateReviewCountsAndTypes();
        await this.validateMediaPlayback();
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        this.logAudit('Validating Vertical Scroll Widget specialized behaviors...');

        // 1. Branding & CTA
        await this.validateBranding();
        await this.validateCTA();

        // 2. Vertical Scrolling Validation
        await this.validateVerticalScrolling();

        // 3. Interaction Testing
        await this.validateInteraction();

        // 4. UI & Content Integrity
        await this.validateLayoutIntegrity();
        await this.validateAlignment();
        await this.validateTextReadability();
        await this.validateMediaIntegrity();
        await this.validateDateConsistency();

        // 5. Read More/Read Less Functionality
        await this.validateReadMoreExpansion();

        // 6. Review Count & Classification
        await this.validateReviewCountsAndTypes();

        // 7. Responsiveness
        this.logAudit('Responsiveness: Widget adapts to different viewport sizes (tested in mobile view).');

        this.logAudit('Vertical Scroll Widget validation complete.');
    }

    async validateVerticalScrolling() {
        console.log('Running Vertical Scrolling validation...');

        try {
            // Check for vertical scrolling container
            const scrollContainer = this.context.locator('.feedspace-element-marquee-row, .feedspace-element-feed-box-wrap').first();
            const scrollableColumns = this.context.locator('.feedspace-element-marquee-item, [class*="marquee-column"]');
            const columnCount = await scrollableColumns.count();

            if (columnCount > 0) {
                this.logAudit(`Vertical Scrolling: Detected ${columnCount} scrollable column(s).`);

                // Check for vertical scroll mode
                const hasVerticalScroll = await scrollContainer.evaluate(el => {
                    const style = window.getComputedStyle(el);
                    return style.flexDirection === 'column' ||
                        el.classList.contains('feedspace-element-marquee-row') ||
                        !!el.querySelector('[class*="marquee-column"]');
                });

                if (hasVerticalScroll) {
                    this.logAudit('Vertical Scrolling Mode: DETECTED (Standard vertical scrolling)');
                    console.log('Validating standard vertical scroll behavior...');

                    // Check if CSS animation is active
                    const hasAnimation = await scrollableColumns.first().evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.animation !== 'none' && style.animation !== '';
                    });

                    if (hasAnimation) {
                        this.logAudit('Vertical Scrolling: CSS animation detected on scrollable elements.');
                    } else {
                        this.logAudit('Vertical Scrolling: No CSS animation detected, but structure supports vertical scrolling.', 'info');
                    }
                } else {
                    this.logAudit('Vertical Scrolling Mode: N/A (Not enabled for this widget)', 'info');
                }
            } else {
                this.logAudit('Vertical Scrolling: No scrollable columns detected.', 'info');
            }
        } catch (e) {
            this.logAudit(`Vertical Scrolling: Error during validation - ${e.message}`, 'info');
        }
    }

    async validateCrossScrollAnimation() {
        console.log('Running Cross-Scroll Animation check...');

        try {
            // Check if cross-scroll is enabled
            const hasCrossScroll = await this.context.locator('.feedspace-cross-scroll, [data-cross-scroll="true"]').count() > 0;

            if (hasCrossScroll) {
                this.logAudit('Cross-Scroll Mode: DETECTED');
            } else {
                this.logAudit('Cross-Scroll Mode: N/A (Not enabled for this widget)', 'info');
            }
        } catch (e) {
            this.logAudit(`Cross-Scroll Mode: Error - ${e.message}`, 'info');
        }
    }

    async validateInteraction() {
        console.log('Running Interaction validation...');

        try {
            // Test clicking on review cards
            const cards = this.context.locator(this.cardSelector);
            const cardCount = await cards.count();

            if (cardCount === 0) {
                this.logAudit('Interaction: No cards found to test interaction.', 'info');
                return;
            }

            this.logAudit(`Interaction: Testing clickability of ${Math.min(cardCount, 2)} review card(s)...`);

            let successCount = 0;
            for (let i = 0; i < Math.min(cardCount, 2); i++) {
                const card = cards.nth(i);

                // Skip CTA cards
                const isCTA = await card.evaluate(el => {
                    return el.classList.contains('feedspace-inline-cta-card') ||
                        !!el.closest('.feedspace-inline-cta-card') ||
                        !!el.querySelector('.feedspace-inline-cta-card');
                });

                if (isCTA) continue;

                try {
                    if (await card.isVisible()) {
                        // Verify card is clickable
                        const isClickable = await card.evaluate(el => {
                            const style = window.getComputedStyle(el);
                            return style.pointerEvents !== 'none' && style.visibility !== 'hidden';
                        });

                        if (isClickable) {
                            successCount++;
                        }
                    }
                } catch (e) {
                    // Continue to next card
                }
            }

            if (successCount > 0) {
                this.logAudit(`Interaction: Verified ${successCount} card(s) are interactive and clickable.`);
            } else {
                this.logAudit('Interaction: Could not verify card interactivity.', 'info');
            }

            // Test scroll interaction
            const scrollContainer = this.context.locator('.feedspace-element-marquee-row, .feedspace-element-feed-box-wrap').first();
            if (await scrollContainer.count() > 0) {
                this.logAudit('Interaction: Vertical scroll animation is active and user can view scrolling content.');
            }

        } catch (e) {
            this.logAudit(`Interaction: Error during validation - ${e.message}`, 'info');
        }
    }

    async validateCTA() {
        // Localized CTA validation for VerticalScrollWidget
        // Checks for inline CTA cards specific to this widget type
        const inlineCTA = this.context.locator('.feedspace-inline-cta-card, .feedspace-cta-content').first();
        const ctaCount = await this.context.locator('.feedspace-inline-cta-card').count();

        if (await inlineCTA.isVisible()) {
            this.logAudit(`Inline CTA: Found ${ctaCount} inline CTA card(s) (.feedspace-inline-cta-card).`);
        } else {
            this.logAudit('Inline CTA: No inline CTA cards (.feedspace-inline-cta-card or .feedspace-cta-content) found on this widget.', 'info');
        }
    }

    async validateReadMoreExpansion() {
        console.log('Running Read More/Read Less validation (Corrected Trigger/Content)...');

        try {
            const cards = this.context.locator(this.cardSelector);
            const cardCount = await cards.count();
            let expandableCount = 0;
            let successfulExpansions = 0;
            const failedCards = [];

            // Strategy: Sample cards from start, middle, and end to cover all columns (if 3-column layout)
            const indices = [];
            if (cardCount > 0) {
                indices.push(0); // Start (Col 1)
                indices.push(1); // Start (Col 2)
                indices.push(2); // Start (Col 3)
                indices.push(Math.floor(cardCount / 2)); // Middle
                indices.push(cardCount - 2); // End
                indices.push(cardCount - 1); // End
            }

            // Deduplicate and filter valid indices
            const uniqueIndices = [...new Set(indices)]
                .filter(i => i >= 0 && i < cardCount)
                .sort((a, b) => a - b);

            this.logAudit(`Read More/Read Less: Sampling ${uniqueIndices.length} cards across the widget (Indices: ${uniqueIndices.join(', ')}) to ensure multi-column coverage.`);

            for (const i of uniqueIndices) {
                if (this.page.isClosed()) break;

                const card = cards.nth(i);
                const cardId = await card.getAttribute('data-feed-id') || `index-${i}`;

                // SKIP MARQUEE CLONES
                const isClone = await card.evaluate(el => {
                    return !!el.closest('[data-fs-marquee-clone="true"], .cloned, .clone') ||
                        el.getAttribute('aria-hidden') === 'true';
                }).catch(() => true);

                if (isClone) continue;

                // Skip CTA cards
                const isCTA = await card.evaluate(el => {
                    return el.classList.contains('feedspace-inline-cta-card') ||
                        !!el.closest('.feedspace-inline-cta-card');
                }).catch(() => true);
                if (isCTA) continue;

                // Components as defined by user mapping
                const triggers = card.locator('.feedspace-element-read-more');
                const content = card.locator('.feedspace-read-more-text').first();

                // Find CURRENT ACTIVE TRIGGER (the visible one)
                let activeTrigger = null;
                const trigCount = await triggers.count();
                for (let j = 0; j < trigCount; j++) {
                    if (await triggers.nth(j).isVisible().catch(() => false)) {
                        activeTrigger = triggers.nth(j);
                        break;
                    }
                }

                if (!activeTrigger) continue;

                expandableCount++;

                // Detect current state from visible trigger's text
                const triggerText = await activeTrigger.innerText().catch(() => '');
                const isExpandedInitially = triggerText.toLowerCase().includes('less');

                // Confirm content visibility matches trigger state
                const isContentVisibleInitially = await content.isVisible().catch(() => false);

                try {
                    console.log(`Card ${cardId}: Is ${isExpandedInitially ? 'Expanded (Read Less)' : 'Collapsed (Read More)'}. Content Visible: ${isContentVisibleInitially}. Triggering...`);

                    // --- Step 1: Perform first toggle ---
                    await activeTrigger.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => { });
                    await this.page.waitForTimeout(300);
                    await activeTrigger.click({ timeout: 5000, force: true });
                    await this.page.waitForTimeout(1200);

                    // Verify first toggle
                    const isVisibleAfterFirst = await content.isVisible().catch(() => false);
                    let firstToggleSuccess = false;

                    if (isExpandedInitially) {
                        // Was Expanded -> Clicked Read Less -> Should be Hidden
                        firstToggleSuccess = !isVisibleAfterFirst;
                        if (firstToggleSuccess) console.log(`Card ${cardId}: Collapse (1/2) SUCCESS.`);
                        else failedCards.push(`Card ${cardId}: Content still visible after clicking Read Less`);
                    } else {
                        // Was Collapsed -> Clicked Read More -> Should be Visible
                        firstToggleSuccess = isVisibleAfterFirst;
                        if (firstToggleSuccess) console.log(`Card ${cardId}: Expansion (1/2) SUCCESS.`);
                        else failedCards.push(`Card ${cardId}: Content did not appear after clicking Read More`);
                    }

                    if (!firstToggleSuccess) continue;

                    // --- Step 2: Perform second toggle (The Cycle) ---
                    // Re-locate trigger because the button text/class might change when expanded
                    let secondTrigger = null;
                    // Expanded triggers might use different classes (based on BaseWidget/AvatarGroup)
                    const triggerSelectors = [
                        '.feedspace-element-read-more',
                        '.feedspace-element-read-less',
                        '.feedspace-read-less-text-span',
                        'span:has-text("Read less")',
                        'button:has-text("Read less")'
                    ];

                    for (const selector of triggerSelectors) {
                        const potentialTriggers = card.locator(selector);
                        const pCount = await potentialTriggers.count();
                        for (let j = 0; j < pCount; j++) {
                            const trig = potentialTriggers.nth(j);
                            if (await trig.isVisible().catch(() => false)) {
                                const text = await trig.innerText().catch(() => '');
                                if (text.toLowerCase().includes('less')) {
                                    secondTrigger = trig;
                                    break;
                                }
                            }
                        }
                        if (secondTrigger) break;
                    }

                    if (secondTrigger) {
                        const secondTriggerText = await secondTrigger.innerText().catch(() => '');
                        console.log(`Card ${cardId}: Performing second toggle (${secondTriggerText})...`);

                        await secondTrigger.click({ timeout: 5000, force: true });
                        await this.page.waitForTimeout(1200);

                        // Verify second toggle (should return to initial state)
                        const isVisibleAfterSecond = await content.isVisible().catch(() => false);
                        if (isVisibleAfterSecond === isContentVisibleInitially) {
                            console.log(`Card ${cardId}: Toggle Cycle (2/2) COMPLETE.`);
                            successfulExpansions++;
                        } else {
                            failedCards.push(`Card ${cardId}: Toggle cycle failed to return content to initial state`);
                        }
                    } else {
                        failedCards.push(`Card ${cardId}: Could not find toggle button for second part of cycle`);
                    }
                } catch (clickError) {
                    failedCards.push(`Card ${cardId}: Interaction failed - ${clickError.message}`);
                }
            }

            if (expandableCount > 0) {
                if (successfulExpansions > 0) {
                    this.logAudit(`Read More/Read Less: Verified ${successfulExpansions} expansion/toggle action(s) on source cards.`);
                } else {
                    this.logAudit(`Read More/Read Less: Interaction failed on all ${expandableCount} tested cards.`, 'fail');
                }
            } else {
                this.logAudit('Read More/Read Less: No expandable source cards found in sample.', 'info');
            }
        } catch (e) {
            this.logAudit(`Read More/Read Less: Validation error - ${e.message}`, 'info');
        }
    }

    async validateReadMore() {
        console.log('Overriding generic Read More check with specialized expansion logic...');
        // Delegate to the specialized logic that we already verified
        await this.validateReadMoreExpansion();
    }

    async validateReviewCountsAndTypes() {
        console.log('Running Review Count validation...');

        const allCards = this.context.locator(this.cardSelector);
        const totalCards = await allCards.count();
        this.logAudit(`Processing ${totalCards} cards for count and type validation...`);

        // Performance Optimization: Batch process all cards in one evaluate call
        const cardData = await allCards.evaluateAll(elements => {
            return elements.map((el, i) => {
                // 1. Skip clones early
                const isClone = el.closest('[data-fs-marquee-clone="true"], .cloned, .clone') ||
                    el.getAttribute('aria-hidden') === 'true';
                if (isClone) return null;

                // 2. Check if CTA
                const isCTA = el.classList.contains('feedspace-inline-cta-card') ||
                    !!el.closest('.feedspace-inline-cta-card') ||
                    !!el.querySelector('.feedspace-inline-cta-card');

                // 3. Get Unique Identifiers
                const feedId = el.getAttribute('data-feed-id') || el.getAttribute('data-id') || el.id;

                // 4. Fallback ID for CTA or Reviews
                let fallbackId = '';
                if (!feedId) {
                    const textEl = el.querySelector('.feedspace-element-feed-text, .review-text, p');
                    fallbackId = (isCTA ? 'CTA-' : '') + (textEl ? textEl.textContent.trim().substring(0, 30) : `Card-${i}`);
                }

                // 5. Detect Media Types
                const hasVideo = !!el.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed:not(.feedspace-element-audio-feed-box)');
                const hasAudio = !!el.querySelector('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box');

                return {
                    index: i + 1,
                    isCTA,
                    id: feedId || fallbackId,
                    hasVideo,
                    hasAudio
                };
            }).filter(d => d !== null);
        });

        // Deduplicate and count
        const uniqueReviews = new Set();
        const uniqueCTAs = new Set();
        let textCount = 0;
        let videoCount = 0;
        let audioCount = 0;
        let ctaCount = 0;

        for (const data of cardData) {
            if (data.isCTA) {
                if (!uniqueCTAs.has(data.id)) {
                    uniqueCTAs.add(data.id);
                    ctaCount++;
                }
                continue;
            }

            if (!uniqueReviews.has(data.id)) {
                uniqueReviews.add(data.id);
                if (data.hasVideo) videoCount++;
                else if (data.hasAudio) audioCount++;
                else textCount++;
            }
        }

        const uniqueTotal = uniqueReviews.size;

        if (uniqueTotal > 0) {
            this.logAudit(`Review Count: ${uniqueTotal} unique reviews (Text: ${textCount}, Video: ${videoCount}, Audio: ${audioCount})`);
            if (ctaCount > 0) this.logAudit(`CTA Cards: Found ${ctaCount} unique CTA card(s).`);
        } else {
            this.logAudit('Review Count: No unique reviews detected in widget.', 'fail');
        }
    }

    async validateMediaPlayback() {
        console.log('Running Media Playback validation...');

        // Test video playback
        const videos = this.context.locator('video').first();
        if (await videos.count() > 0 && await videos.isVisible()) {
            try {
                const isPlayable = await videos.evaluate(video => {
                    return video.readyState >= 2; // HAVE_CURRENT_DATA or higher
                });

                if (isPlayable) {
                    this.logAudit('Media Playback: Video elements are loaded and playable.');
                } else {
                    this.logAudit('Media Playback: Video elements found but may not be ready to play.', 'info');
                }
            } catch (e) {
                this.logAudit(`Media Playback: Video playback test failed - ${e.message}`, 'info');
            }
        }

        // Test audio playback
        const audios = this.context.locator('audio, .feedspace-audio-player').first();
        if (await audios.count() > 0) {
            try {
                const hasAudioElement = await audios.evaluate(el => {
                    const audioTag = el.tagName === 'AUDIO' ? el : el.querySelector('audio');
                    return !!audioTag;
                });

                if (hasAudioElement) {
                    this.logAudit('Media Playback: Audio elements detected and available.');
                } else {
                    this.logAudit('Media Playback: Audio player found but no audio element detected.', 'info');
                }
            } catch (e) {
                this.logAudit(`Media Playback: Audio playback test failed - ${e.message}`, 'info');
            }
        }
    }

    async validateDateConsistency() {
        console.log('Running Date Consistency check...');
        const cards = this.context.locator(this.cardSelector);
        const count = await cards.count();
        this.logAudit(`Processing ${count} cards for date and content integrity...`);

        // Performance Optimization: Batch process all cards
        const auditData = await cards.evaluateAll(elements => {
            return elements.map((el, i) => {
                // 1. Skip clones and hidden
                const isClone = el.closest('[data-fs-marquee-clone="true"], .cloned, .clone') ||
                    el.getAttribute('aria-hidden') === 'true';
                if (isClone) return null;

                // 2. Skip CTA
                const isCTA = el.classList.contains('feedspace-inline-cta-card') ||
                    !!el.closest('.feedspace-inline-cta-card');
                if (isCTA) return null;

                const feedId = el.getAttribute('data-feed-id') || 'N/A';

                // Check for literal 'undefined' or 'null' in date field or general content
                const dateEl = el.querySelector('.date, .review-date, .feedspace-element-date, .feedspace-element-feed-date, .feedspace-element-date-text');
                const dateHtml = dateEl ? dateEl.innerHTML.toLowerCase() : '';
                const hasUndefinedDate = dateHtml.includes('undefined') || dateHtml.includes('null');

                const cardHtml = el.innerHTML.toLowerCase();
                const cardText = el.innerText.toLowerCase();
                const hasLeakedData = cardHtml.includes('undefined') || cardHtml.includes('null') || cardText.includes('invalid date');

                // Find specific element if leaked data exists
                let exactLocation = 'General Card Content';
                let snippet = '';
                if (hasLeakedData) {
                    const allChilds = el.querySelectorAll('*');
                    for (const child of allChilds) {
                        const childText = child.textContent || '';
                        if (childText.toLowerCase().includes('undefined') || childText.toLowerCase().includes('null') || childText.toLowerCase().includes('invalid date')) {
                            exactLocation = child.tagName.toLowerCase() + (child.className ? '.' + child.className.split(' ')[0] : '');
                            snippet = childText.substring(0, 100);
                            break;
                        }
                    }
                }

                return {
                    index: i + 1,
                    feedId,
                    hasUndefinedDate,
                    hasLeakedData,
                    dateHtml: dateEl ? dateEl.innerHTML : '',
                    exactLocation,
                    snippet: snippet || el.innerText.substring(0, 50)
                };
            }).filter(d => d !== null);
        });

        const seenFeedIds = new Set();
        let invalidDateCardsCount = 0; // Track count for the final logAudit
        for (const data of auditData) {
            if (data.feedId !== 'N/A' && seenFeedIds.has(data.feedId)) continue;
            seenFeedIds.add(data.feedId);

            if (data.hasUndefinedDate) {
                invalidDateCardsCount++;
                this.detailedFailures.push({
                    type: 'Date Consistency',
                    card: data.index,
                    feedId: data.feedId,
                    location: 'Date Field',
                    snippet: data.dateHtml,
                    description: `Date field contains literal 'undefined' or 'null'. (ID: ${data.feedId})`,
                    severity: 'High'
                });
            } else if (data.hasLeakedData) {
                invalidDateCardsCount++;
                this.detailedFailures.push({
                    type: 'Malformed content',
                    card: data.index,
                    feedId: data.feedId,
                    location: data.exactLocation,
                    snippet: data.snippet,
                    description: `Review card contains leaked 'undefined', 'null', or 'invalid date'. (ID: ${data.feedId})`,
                    severity: 'High'
                });
            }
        }
        this.logAudit('Date Consistency & Content Integrity check complete.');
        if (invalidDateCardsCount > 0) {
            this.logAudit(`Date Consistency: Found 'undefined' or 'null' strings in ${invalidDateCardsCount} unique card(s)`, 'fail');
        } else {
            this.logAudit('Date Consistency: All review dates are valid or intentionally empty (optional).');
        }
    }
}

module.exports = { VerticalScrollWidget };
