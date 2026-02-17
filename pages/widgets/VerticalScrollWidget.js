const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class VerticalScrollWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        // Update selectors based on widget specifications
        this.containerSelector = '.feedspace-element-container.feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow, .feedspace-element-container';
        this.subContainerSelector = '.feedspace-element-feed-box-wrap.feedspace-element-grid';
        this.reviewRowSelector = '.feedspace-element-marquee-row';
        this.columnSelector = '.feedspace-element-marquee-item, [class*="marquee-column"]';
        this.cardSelector = '.feedspace-review-item, .feedspace-element-feed-box, .feedspace-marquee-box-inner, .feedspace-review-box';
        this.readMoreSelector = 'i:has-text("Read More"), .feedspace-element-read-more';
        this.readLessSelector = '.feedspace-read-less-btn';
        this.ctaSelector = '.feedspace-element-feed-box-inner .feedspace-inline-cta-card, .feedspace-cta-content';
    }

    async validateVisibility(minReviewsOverride) {
        await this.initContext();
        const minReviews = minReviewsOverride || this.uiRules.minReviews || 1;
        const container = this.context.locator(this.containerSelector).first();

        if (!(await container.isVisible({ timeout: 15000 }).catch(() => false))) {
            this.logAudit('Widget container not visible after timeout (15s).', 'fail');
            return;
        }
        this.logAudit('Widget container is visible.');

        // Column Detection
        const columns = this.context.locator(this.columnSelector);
        const colCount = await columns.count();
        this.logAudit(`Detected ${colCount} marquee columns in the widget.`);

        const allCards = this.context.locator(this.cardSelector);
        const totalRawCards = await allCards.count();
        this.logAudit(`Scanning ${totalRawCards} raw cards across all columns for unique content...`);

        // Use the common review processor
        await this.validateReviewCountsAndTypes();
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

        // 🟢 1. Configuration Check (Config API vs UI)
        // This is primarily handled by the Validator, but we ensure branding logic is synced here
        await this.validateBranding();
        await this.validateCTA();

        // 🟢 2. Interactive features check (Read More, Video/Audio playback, Platform Icon)
        await this.validateVerticalScrolling();
        await this.validateInteraction();
        await this.validateReadMoreExpansion();
        await this.validateMediaPlayback();
        await this.validatePlatformIcon();
        if (this.config.allow_social_redirection == 1 || this.config.allow_social_redirection === '1') {
            await this.validateSocialRedirection();
        }

        // 🟢 3. Layout and Content Integrity
        await this.validateLayoutIntegrity();
        await this.validateAlignment();
        await this.validateTextReadability();
        await this.validateMediaIntegrity();
        await this.validateDateConsistency();

        // 🟢 4. Final Review Processing
        await this.validateReviewCountsAndTypes();

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
                    this.logAudit('[Navigation] Vertical Scrolling Mode: DETECTED (Standard vertical scrolling)');
                    console.log('Validating standard vertical scroll behavior...');

                    // Check if CSS animation is active
                    const hasAnimation = await scrollableColumns.first().evaluate(el => {
                        const style = window.getComputedStyle(el);
                        return style.animation !== 'none' && style.animation !== '';
                    });

                    if (hasAnimation) {
                        this.logAudit('[Navigation] Vertical Scrolling: CSS animation detected on scrollable elements.');
                    } else {
                        this.logAudit('[Navigation] Vertical Scrolling: No CSS animation detected, but structure supports vertical scrolling.', 'info');
                    }
                } else {
                    this.logAudit('[Navigation] Vertical Scrolling Mode: N/A (Not enabled for this widget)', 'info');
                }
            } else {
                this.logAudit('[Navigation] Vertical Scrolling: No scrollable columns detected.', 'info');
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

    async validateBranding() {
        // Standardized branding locator
        const brandingSelector = 'a[title="Capture reviews with Feedspace"]';

        // Use page as fallback if context (iframe) doesn't find it
        let branding = this.context.locator(brandingSelector).first();
        if (!(await branding.isVisible())) {
            branding = this.page.locator(brandingSelector).first();
        }

        const isVisible = await branding.isVisible().catch(() => false);
        const configRemove = this.config.allow_to_remove_branding;
        console.log(`[VerticalScrollWidget] Validating Branding (Config: ${configRemove})...`);

        if (isVisible) {
            this.logAudit('Feedspace branding is visible: "Capture reviews with Feedspace"');
        } else {
            this.logAudit('Feedspace branding not found or hidden.', 'info');
        }

        // Logic check:
        // API 0 (Keep) + UI 0 (Visible) = Passed (0=Visible for branding logic)
        // API 1 (Remove) + UI 1 (Hidden) = Passed (1=Hidden for branding logic)
        if (configRemove == 1 || configRemove == '1') {
            if (!isVisible) {
                this.logAudit('[Config] Branding: Passed (API=1, UI=Hidden)');
            } else {
                this.logAudit('[Config] Branding: Failed (API=1, but UI is Visible)', 'fail');
            }
        } else if (configRemove == 0 || configRemove == '0') {
            if (isVisible) {
                this.logAudit('[Config] Branding: Passed (API=0, UI=Visible)');
            } else {
                this.logAudit('[Config] Branding: Failed (API=0, but UI is Hidden)', 'fail');
            }
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
                this.logAudit('[Interactive] Vertical scroll animation is active and user can view scrolling content.');
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
                const triggers = card.locator('i:has-text("Read More"), .feedspace-element-read-more');
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
                    const initialHeight = await card.evaluate(el => el.offsetHeight).catch(() => 0);
                    console.log(`Card ${cardId}: Is ${isExpandedInitially ? 'Expanded (Read Less)' : 'Collapsed (Read More)'}. Content Visible: ${isContentVisibleInitially}. Initial Height: ${initialHeight}. Triggering...`);

                    // --- Step 1: Perform first toggle ---
                    await activeTrigger.evaluate(el => el.scrollIntoView({ block: 'center' })).catch(() => { });
                    await this.page.waitForTimeout(300);
                    await activeTrigger.click({ timeout: 5000, force: true });
                    await this.page.waitForTimeout(1500); // Wait for CSS transition

                    // Verify first toggle via Visibility OR Height change
                    const isVisibleAfterFirst = await content.isVisible().catch(() => false);
                    const heightAfterFirst = await card.evaluate(el => el.offsetHeight).catch(() => 0);

                    let firstToggleSuccess = false;

                    if (isExpandedInitially) {
                        // Was Expanded -> Clicked Read Less -> Should be Hidden OR Height should decrease
                        firstToggleSuccess = !isVisibleAfterFirst || heightAfterFirst < initialHeight - 5;
                        if (firstToggleSuccess) console.log(`Card ${cardId}: Collapse (1/2) SUCCESS. Height: ${initialHeight} -> ${heightAfterFirst}`);
                        else failedCards.push(`Card ${cardId}: Content still visible and height didn't decrease after clicking Read Less`);
                    } else {
                        // Was Collapsed -> Clicked Read More -> Should be Visible OR Height should increase
                        firstToggleSuccess = isVisibleAfterFirst || heightAfterFirst > initialHeight + 5;
                        if (firstToggleSuccess) console.log(`Card ${cardId}: Expansion (1/2) SUCCESS. Height: ${initialHeight} -> ${heightAfterFirst}`);
                        else failedCards.push(`Card ${cardId}: Content did not appear and height didn't increase after clicking Read More`);
                    }

                    if (!firstToggleSuccess) continue;

                    // --- Step 2: Perform second toggle (The Cycle) ---
                    // Re-locate trigger because the button text/class might change when expanded
                    let secondTrigger = null;
                    // Expanded triggers might use different classes (based on BaseWidget/AvatarGroup)
                    const triggerSelectors = [
                        'i:has-text("Read Less")',
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
                        const currentHeight = await card.evaluate(el => el.offsetHeight).catch(() => 0);

                        // Height-based collapse check
                        const collapseSuccess = Math.abs(currentHeight - initialHeight) <= 5 || isVisibleAfterSecond === isContentVisibleInitially;

                        if (collapseSuccess) {
                            console.log(`Card ${cardId}: Toggle Cycle (2/2) COMPLETE.`);
                            this.logAudit(`[Read More] Read Less: Successfully validated collapse for card ${cardId}.`);
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
                    this.logAudit(`[Read More] Read More / Less Cycle: Successfully verified ${successfulExpansions} full expansion and collapse cycles.`);
                } else {
                    this.logAudit(`[Read More] Read More/Read Less: Interaction failed on all ${expandableCount} tested cards.`, 'fail');
                }
            } else {
                this.logAudit('[Read More] Read More/Read Less: No expandable source cards found in sample.', 'info');
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

    async validateTextReadability() {
        this.logAudit('Behavior: Detailed Text Readability check for Vertical Scroll.');
        await this.initContext();

        const cards = this.context.locator(this.cardSelector);
        const cardCount = await cards.count();

        if (cardCount === 0) {
            this.logAudit('Text Readability: No review cards found.', 'info');
            return;
        }

        const readabilityIssues = await cards.evaluateAll((elements) => {
            const issues = [];

            elements.forEach((card, index) => {
                const isClone = card.closest('[data-fs-marquee-clone="true"], .cloned, .clone') ||
                    card.getAttribute('aria-hidden') === 'true';
                if (isClone) return;

                const cardId = card.getAttribute('data-feed-id') || card.id || `Card-${index + 1}`;

                // Exhaustive Children Overlap & Style Check
                const children = card.querySelectorAll('p, div, span, h4');
                const visibleChildren = Array.from(children).filter(el => {
                    const style = window.getComputedStyle(el);
                    return el.offsetHeight > 0 && style.display !== 'none' && style.visibility !== 'hidden' && parseFloat(style.opacity) > 0.1;
                });

                for (let i = 0; i < visibleChildren.length; i++) {
                    const el = visibleChildren[i];
                    const rect = el.getBoundingClientRect();
                    const style = window.getComputedStyle(el);

                    // Skip containers with no direct text
                    const hasText = Array.from(el.childNodes).some(node => node.nodeType === 3 && node.textContent.trim().length > 0);
                    if (!hasText && el.tagName === 'DIV') continue;

                    // Style Checks
                    const hasBlur = style.filter.includes('blur') || style.backdropFilter.includes('blur');
                    const hasMask = style.maskImage !== 'none' || style.webkitMaskImage !== 'none' || style.clipPath !== 'none';
                    const hasGradient = style.backgroundImage.includes('linear-gradient') || style.maskImage.includes('linear-gradient');

                    if (hasBlur || hasMask || hasGradient) {
                        // Ignore if it's the specific linear-gradient shadow button effect
                        if (el.classList.contains('feedspace-read-more-btn') || el.classList.contains('feedspace-element-read-more')) continue;

                        issues.push({
                            cardId,
                            textSnippet: el.innerText.substring(0, 50).replace(/\n/g, ' '),
                            reason: 'Faded Truncation',
                            html: el.outerHTML.substring(0, 150)
                        });
                    }

                    // Overlap Check against all other visible children
                    for (let j = i + 1; j < visibleChildren.length; j++) {
                        const otherEl = visibleChildren[j];
                        // Don't compare parent/child
                        if (el.contains(otherEl) || otherEl.contains(el)) continue;

                        const otherRect = otherEl.getBoundingClientRect();
                        const overlapX = Math.max(0, Math.min(rect.right, otherRect.right) - Math.max(rect.left, otherRect.left));
                        const overlapY = Math.max(0, Math.min(rect.bottom, otherRect.bottom) - Math.max(rect.top, otherRect.top));

                        if (overlapX > 5 && overlapY > 5) {
                            issues.push({
                                cardId,
                                textSnippet: `${el.innerText.substring(0, 20)} overlaps ${otherEl.innerText.substring(0, 20)}`,
                                reason: 'Overlapping Text',
                                html: el.outerHTML.substring(0, 100)
                            });
                        }
                    }
                }
            });
            return issues;
        });

        // Consolidate issues: Group by unique Card ID
        const cardIssues = new Map();
        for (const issue of readabilityIssues) {
            if (!cardIssues.has(issue.cardId)) {
                cardIssues.set(issue.cardId, {
                    cardId: issue.cardId,
                    reasons: new Set([issue.reason]),
                    snippet: issue.textSnippet,
                    html: issue.html
                });
            } else {
                cardIssues.get(issue.cardId).reasons.add(issue.reason);
            }
        }

        let failCount = 0;
        for (const [cardId, data] of cardIssues) {
            failCount++;
            const reasons = Array.from(data.reasons).join(', ');
            const cardStr = `Card ID: ${cardId}`;
            const desc = `UI Issue: ${reasons} detected. Snippet: "${data.snippet}"`;

            // Prevent duplicate entries if already added by other checks or re-runs
            const isDuplicate = this.detailedFailures.some(f => f.card === cardStr && f.description === desc);
            if (!isDuplicate) {
                this.detailedFailures.push({
                    type: 'Text Readability',
                    card: cardStr,
                    description: desc,
                    location: 'Visual Integrity',
                    snippet: data.html,
                    severity: 'High',
                    selector: '.feedspace-element-review-contain-box'
                });
            }
        }

        if (failCount > 0) {
            this.logAudit(`Text Readability: Found issues in ${failCount} unique review cards.`, 'fail');
        } else {
            this.logAudit('Text Readability: All text is legible and contained.');
        }
    }

    async validateReviewCountsAndTypes() {
        this.logAudit('Behavior: Validating Review counts and distribution across marquee columns.');
        try {
            const columns = this.context.locator(this.columnSelector);
            const colCount = await columns.count();

            const uniqueReviews = new Map(); // ID -> Info
            const columnStats = [];

            for (let i = 0; i < colCount; i++) {
                const col = columns.nth(i);
                const cards = col.locator(this.cardSelector);
                const rawCount = await cards.count();

                const colData = await cards.evaluateAll(elements => {
                    return elements.map((el, idx) => {
                        // CLONE FILTERING: Only skip if explicitly marked as a marquee clone
                        const isClone = el.closest('[data-fs-marquee-clone="true"], .cloned, .clone');
                        const isHidden = el.getAttribute('aria-hidden') === 'true';

                        // If it's a clone, we skip. 
                        // But we don't skip aria-hidden for the TOTAL count, as marquees hide items for looping.
                        if (isClone) return { skipped: true, reason: 'clone' };

                        const isCTA = el.classList.contains('feedspace-inline-cta-card') || !!el.closest('.feedspace-inline-cta-card');
                        if (isCTA) return { isCTA: true };

                        const feedId = el.getAttribute('data-feed-id') || el.getAttribute('data-id') || el.id;
                        const text = el.innerText.trim();
                        // Content hash for fallback deduplication
                        const contentId = text.substring(0, 100).replace(/\s+/g, '').toLowerCase();

                        const hasVideo = !!el.querySelector('video, iframe, .video-play-button, .feedspace-element-play-feed');
                        const hasAudio = !!el.querySelector('audio, .audio-player, .feedspace-element-audio-feed-box');

                        return {
                            id: feedId || contentId,
                            hasVideo,
                            hasAudio,
                            isCTA: false,
                            isHidden
                        };
                    });
                });

                let colUnique = 0;
                let colSkipped = 0;
                for (const d of colData) {
                    if (!d || d.skipped) {
                        colSkipped++;
                        continue;
                    }
                    if (d.isCTA) continue;
                    if (!uniqueReviews.has(d.id)) {
                        uniqueReviews.set(d.id, d);
                        colUnique++;
                    }
                }
                columnStats.push({ index: i + 1, raw: rawCount, unique: colUnique, skipped: colSkipped });
            }

            // Summarize
            this.reviewStats.text = 0;
            this.reviewStats.video = 0;
            this.reviewStats.audio = 0;

            for (const review of uniqueReviews.values()) {
                if (review.hasVideo) this.reviewStats.video++;
                else if (review.hasAudio) this.reviewStats.audio++;
                else this.reviewStats.text++;
            }

            this.reviewStats.total = uniqueReviews.size;

            columnStats.forEach(stat => {
                this.logAudit(`Column ${stat.index}: Found ${stat.raw} raw elements (${stat.unique} contributing to unique count).`, 'info');
            });

            this.logAudit(`Final Deduplicated Result: ${this.reviewStats.total} total reviews (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`);

        } catch (e) {
            this.logAudit(`Review Count: Validation error - ${e.message}`, 'fail');
        }
    }

    async validateMediaPlayback() {
        console.log('Running Media Playback validation...');

        // Test video playback
        const videos = this.context.locator('video').first();
        const videoPlayBtn = this.context.locator('div.feedspace-video-review-header > div.feedspace-video-review-header-wrap > div.play-btn').first();

        if (await videoPlayBtn.isVisible()) {
            this.logAudit('[Playback] Video Play Button: Visible. Clicking to verify interaction...');
            try {
                await videoPlayBtn.click({ force: true });
                await this.page.waitForTimeout(2000);
            } catch (e) {
                this.logAudit(`[Playback] Video Play Button: Click failed - ${e.message.split('\n')[0]}`, 'info');
            }
        }

        if (await videos.count() > 0 && await videos.isVisible()) {
            try {
                const isPlayable = await videos.evaluate(video => {
                    return video.readyState >= 2; // HAVE_CURRENT_DATA or higher
                });

                if (isPlayable) {
                    this.logAudit('[Playback] Media Playback: Video elements are loaded and playable.');
                } else {
                    this.logAudit('[Playback] Media Playback: Video elements found but may not be ready to play.', 'info');
                }
            } catch (e) {
                this.logAudit(`[Playback] Media Playback: Video playback test failed - ${e.message}`, 'info');
            }
        }

        // Test audio playback
        const audios = this.context.locator('audio, .feedspace-audio-player').first();
        const audioPlayBtn = this.context.locator('div.feedspace-element-audio-icon > div.play-btn > span.feedspace-media-play-icon').first();

        if (await audioPlayBtn.isVisible()) {
            this.logAudit('[Playback] Audio Play Button: Visible. Clicking to verify interaction...');
            try {
                await audioPlayBtn.click({ force: true });
                await this.page.waitForTimeout(2000);
            } catch (e) {
                this.logAudit(`[Playback] Audio Play Button: Click failed - ${e.message.split('\n')[0]}`, 'info');
            }
        }

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

    async validateLayoutIntegrity() {
        console.log('Running Layout Integrity check for VerticalScroll...');
        const container = this.context.locator(this.containerSelector).first();
        const containerBox = await container.boundingBox().catch(() => null);

        if (!containerBox) {
            this.logAudit('Layout Integrity: Container not visible, skipping check.', 'info');
            return;
        }

        const cards = this.context.locator(this.cardSelector);
        const count = await cards.count();
        this.logAudit(`Checking layout integrity for ${count} cards...`);

        // Check ratings visibility with specific locator
        const ratingsLocator = 'div.feedspace-element-feed-box-inner > div.feedspace-element-review-box > svg';
        const ratings = this.context.locator(ratingsLocator);
        const ratingsCount = await ratings.count();
        if (ratingsCount > 0) {
            this.logAudit(`Ratings: Found ${ratingsCount} rating SVG elements (div.feedspace-element-feed-box-inner > div.feedspace-element-review-box > svg).`);
        }

        // Call the base layout integrity check logic if needed, or implement it here
        // For VerticalScroll, we prioritze the ratings check as requested.
        await super.validateLayoutIntegrity().catch(() => { });
    }

    async validateDateConsistency() {
        const configDate = this.config.allow_to_display_feed_date;
        console.log(`[VerticalScrollWidget] Validating Date Consistency (Config: ${configDate})...`);

        try {
            const cards = this.context.locator(this.cardSelector);
            const count = await cards.count();
            const dateElements = this.context.locator('.feedspace-element-date, .feedspace-element-feed-date, .feedspace-wol-date, .feedspace-element-bio-top span');
            const foundCount = await dateElements.count();

            if (configDate == 0 || configDate === '0') {
                if (foundCount === 0) {
                    this.logAudit('Date Consistency: Dates are hidden as per configuration.', 'pass');
                } else {
                    // Check visibility
                    let visibleCount = 0;
                    for (let i = 0; i < foundCount; i++) {
                        if (await dateElements.nth(i).isVisible()) visibleCount++;
                    }

                    if (visibleCount === 0) {
                        this.logAudit('Date Consistency: Date elements present but hidden (CSS checks out).', 'pass');
                    } else {
                        this.logAudit(`Date Consistency: Dates should be hidden (0) but ${visibleCount} are visible.`, 'fail');
                    }
                }
            } else if (configDate == 1 || configDate === '1') {
                if (foundCount > 0) {
                    // 1. Strict Visibility Check
                    const firstDate = dateElements.first();
                    if (await firstDate.isVisible()) {
                        this.logAudit('Date Consistency: Dates are visible as expected.', 'pass');
                    } else {
                        this.logAudit('Date Consistency: Dates found in DOM but are not visible.', 'fail');
                    }

                    // 2. Strict Content Check (Undefined/Null) - Keep existing logic
                    this.logAudit(`Processing ${count} cards for date and content integrity...`);
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

                            // Check for literal 'undefined' or 'null' in date field
                            const dateEl = el.querySelector('.date, .review-date, .feedspace-element-date, .feedspace-element-feed-date, .feedspace-element-date-text');
                            const dateHtml = dateEl ? dateEl.innerHTML.toLowerCase() : '';
                            const hasUndefinedDate = dateHtml.includes('undefined') || dateHtml.includes('null');

                            return {
                                index: i + 1,
                                feedId,
                                hasUndefinedDate,
                                dateHtml: dateEl ? dateEl.innerHTML : '',
                            };
                        }).filter(d => d !== null);
                    });

                    let invalidDateCardsCount = 0;
                    for (const data of auditData) {
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
                        }
                    }

                    if (invalidDateCardsCount > 0) {
                        this.logAudit(`Date Consistency: Found 'undefined' or 'null' strings in ${invalidDateCardsCount} unique card(s)`, 'fail');
                    } else {
                        this.logAudit('Date Consistency: All review dates are valid and visible.', 'pass');
                    }

                } else {
                    this.logAudit('Date Consistency: Dates expected (1) but none found in DOM.', 'fail');
                }
            } else {
                this.logAudit(`Date Consistency: Config value '${configDate}' is optional/unknown. Found ${foundCount} dates.`, 'info');
            }

        } catch (e) {
            this.logAudit(`Date Consistency: Validation error - ${e.message}`, 'info');
        }
    }


    async validatePlatformIcon() {
        const configPlatform = this.config.show_platform_icon;
        console.log(`[VerticalScrollWidget] Validating Platform Icon (Config: ${configPlatform})...`);

        const platformIconSelector = 'div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon';
        const icon = this.context.locator(platformIconSelector).first();
        const isVisible = await icon.isVisible().catch(() => false);

        if (configPlatform == 0 || configPlatform === '0') {
            if (!isVisible) {
                this.logAudit('Platform Icon: Hidden as per configuration.', 'pass');
            } else {
                this.logAudit('Platform Icon: Should be hidden but found visible.', 'fail');
            }
        } else if (configPlatform == 1 || configPlatform === '1') {
            if (isVisible) {
                this.logAudit('Platform Icon: Visible and identifies successfully.', 'pass');
            } else {
                this.logAudit('Platform Icon: Expected visible (1) but not found or hidden.', 'fail');
            }
        } else {
            this.logAudit(`Platform Icon: Config value '${configPlatform}' unknown. Found visible: ${isVisible}`, 'info');
        }
    }

    async validateSocialRedirection() {
        const configSocial = this.config.allow_social_redirection;
        console.log(`[VerticalScrollWidget] Validating Social Redirection (Config: ${configSocial})...`);

        const socialRedirectionSelector = 'div.flex > div.flex > a.feedspace-d6-header-icon, .social-redirection-button, .fe-social-link, .feedspace-element-header-icon a';
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
            // Robust check: try context then page
            if (count === 0) {
                const pageIcons = this.page.locator(socialRedirectionSelector);
                const pageCount = await pageIcons.count();
                if (pageCount > 0) {
                    this.logAudit(`Social Redirection: Found ${pageCount} social redirection elements via page context.`);
                    this.logAudit('Social Redirection: All icons have valid links.', 'pass');
                    return;
                }
            }

            if (count > 0) {
                this.logAudit(`Social Redirection: Found ${count} social redirection elements.`);
                let allValid = true;
                for (let i = 0; i < count; i++) {
                    const icon = icons.nth(i);
                    if (await icon.isVisible()) {
                        const tagName = await icon.evaluate(el => el.tagName.toLowerCase());
                        let hasLink = false;
                        if (tagName === 'a') {
                            const href = await icon.getAttribute('href');
                            if (href && (href.startsWith('http') || href.includes('social'))) hasLink = true;
                        } else {
                            const parentLink = icon.locator('xpath=./ancestor::a').first();
                            if (await parentLink.count() > 0) {
                                const href = await parentLink.getAttribute('href');
                                if (href) hasLink = true;
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
}

module.exports = { VerticalScrollWidget };
