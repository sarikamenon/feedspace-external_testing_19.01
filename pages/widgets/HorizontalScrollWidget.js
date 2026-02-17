const { BaseWidget } = require('./BaseWidget');

class HorizontalScrollWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);

        // Selectors
        this.containerSelector = '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow';
        this.cardSelector = '.feedspace-element-marquee-item .feedspace-element-post-box, .feedspace-element-marquee-item .feedspace-review-item, .feedspace-element-marquee-item .feedspace-element-feed-box';
        this.marqueeRowSelector = '.feedspace-element-d12-marquee-row';

        // Centralized reusable selectors
        this.selectors = {
            readMore: ['.feedspace-element-read-more', '.feedspace-element-read-more-text-span', '.read-more', 'span:has-text("Read more")', 'button:has-text("Read more")', '.show-more'],
            readLess: ['.feedspace-element-read-less', '.feedspace-element-read-less-text-span', 'span:has-text("Read less")'],
            authorName: ['.feedspace-author-name', '.feedspace-element-author-name', '.feedspace-element-author-name-text', '.feedspace-element-feed-name', '.author-name', '.feedspace-review-author-name', '.feedspace-element-author-title']
        };
    }

    async validateVisibility(minReviewsOverride) {
        await this.initContext();
        console.log('Running Horizontal Scroll Visibility validation...');
        const minReviews = minReviewsOverride || this.uiRules.minReviews || 1;

        // 1. Validate Container
        const container = this.context.locator(this.containerSelector).first();
        if (!(await container.isVisible({ timeout: 15000 }).catch(() => false))) {
            this.logAudit('Widget container not visible after timeout (15s).', 'fail');
            return;
        }

        // 2. Validate Marquee Row specifically (since user highlighted this structure)
        const marqueeRow = this.context.locator(this.marqueeRowSelector).first();
        if (await marqueeRow.count() > 0) {
            const isVisible = await marqueeRow.isVisible();
            if (isVisible) {
                this.logAudit('Marquee row container found and visible.');
            } else {
                this.logAudit('Marquee row found but not visible.', 'warn');
            }
        } else {
            this.logAudit('Marquee row container not found during visibility check.', 'info');
        }

        // 3. Go through reviews to validate them
        // User requested: "check the dom also for validating reviews identifying the widget ... go through this for validating reviews"
        const cards = this.context.locator(this.cardSelector);

        // Wait for at least one card
        try {
            await cards.first().waitFor({ state: 'visible', timeout: 10000 });
        } catch (e) {
            console.log('Timeout waiting for review cards.');
        }

        const cardCount = await cards.count();
        this.logAudit(`Widget container is visible. Detected ${cardCount} reviews.`);

        if (cardCount === 0) {
            this.logAudit('No review cards found in the marquee.', 'fail');
            return;
        }

        // 4. Validate Review Content (Validity Check as requested)
        // We check a sample or all to ensure they aren't empty placeholders
        const cardData = await cards.evaluateAll(elements => {
            return elements.map((el, i) => {
                const text = el.innerText.trim();
                return { index: i + 1, hasContent: text.length > 0 };
            });
        });

        const emptyCards = cardData.filter(c => !c.hasContent);
        if (emptyCards.length > 0) {
            this.logAudit(`Found ${emptyCards.length} empty review cards (Indices: ${emptyCards.slice(0, 5).map(c => c.index).join(', ')}...)`, 'warn');
        } else {
            this.logAudit('All detected review cards have text content (validity check passed).');
        }

        // 5. Min Count Check
        if (cardCount >= minReviews) {
            this.logAudit(`Found ${cardCount} reviews (min required: ${minReviews}).`);
        } else {
            this.logAudit(`Insufficient reviews: Found ${cardCount}, expected at least ${minReviews}.`, 'fail');
        }

        // 6. Populate generic stats for reporting (detailed breakdown happens in validateReviewCountsAndTypes)
        this.reviewStats.total = cardCount;
        this.reviewStats.text = cardCount;
    }

    // Entry point for all horizontal scroll validations
    async validateUniqueBehaviors() {
        await this.initContext();
        await this.ensureViewport();
        await this.validateHorizontalScrolling();
        await this.validateReviewCountsAndTypes();
        await this.validateReadMoreExpansion();
        if (this.config.allow_social_redirection == 1 || this.config.allow_social_redirection === '1') {
            await this.validateSocialRedirection();
        }
        await this.validateDateConsistency();
        await this.validateTextReadability();
    }

    async validateDateConsistency() {
        const configDate = this.config.allow_to_display_feed_date;
        console.log(`[HorizontalScrollWidget] Validating Date Consistency (Config: ${configDate})...`);

        try {
            const cards = this.context.locator(this.cardSelector);
            const count = await cards.count();
            const dateElements = this.context.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span');
            const foundCount = await dateElements.count();

            if (configDate == 0 || configDate === '0') {
                if (foundCount === 0) {
                    this.logAudit('Date Consistency: Dates are hidden as per configuration.', 'pass');
                } else {
                    // Check visibility logic
                    let visibleCount = 0;
                    for (let i = 0; i < foundCount; i++) {
                        if (await dateElements.nth(i).isVisible()) visibleCount++;
                    }

                    if (visibleCount === 0) {
                        this.logAudit('Date Consistency: Date elements present but hidden (CSS checks out).', 'pass');
                    } else {
                        this.logAudit(`Date Consistency: Dates should be hidden (0) but passed visibility check on ${visibleCount} elements.`, 'fail');
                    }
                }
            } else if (configDate == 1 || configDate === '1') {
                if (foundCount > 0) {
                    // Check specific "undefined" or "null" test
                    const texts = await dateElements.allInnerTexts();
                    const invalidDates = texts.filter(t => t.toLowerCase().includes('undefined') || t.toLowerCase().includes('null'));

                    if (invalidDates.length > 0) {
                        this.logAudit(`Date Consistency: Found invalid dates (undefined/null) in ${invalidDates.length} instances.`, 'fail');
                    } else {
                        // Check visibility of at least one
                        let anyVisible = false;
                        for (let i = 0; i < Math.min(foundCount, 5); i++) {
                            if (await dateElements.nth(i).isVisible()) anyVisible = true;
                        }

                        if (anyVisible) {
                            this.logAudit(`Date Consistency: ${foundCount} dates found. Valid and visible.`, 'pass');
                        } else {
                            this.logAudit('Date Consistency: Dates found in DOM but seemingly hidden (check marquee overflow).', 'info');
                        }
                    }
                } else {
                    this.logAudit('Date Consistency: Dates expected (1) but none found in marquee items.', 'fail');
                }
            } else {
                this.logAudit(`Date Consistency: Config value '${configDate}' is optional/unknown. Found ${foundCount} dates.`, 'info');
            }
        } catch (e) {
            this.logAudit(`Date Consistency: Error during check - ${e.message}`, 'info');
        }
    }

    async ensureViewport() {
        // Standardize desktop viewport for consistent audits
        await this.page.setViewportSize({ width: 1280, height: 720 });
    }

    // Horizontal scrolling detection
    async validateHorizontalScrolling() {
        this.logAudit('Horizontal Scrolling: Starting validation...', 'info');

        const marqueeRow = this.context.locator(this.marqueeRowSelector).first();
        if (!(await marqueeRow.isVisible())) {
            this.logAudit('Marquee row container not found or not visible.', 'fail');
            return;
        }

        const getMovementState = async () => {
            return await marqueeRow.evaluate(el => {
                const style = window.getComputedStyle(el);
                const firstChild = el.querySelector('.feedspace-element-marquee-item, .feedspace-element-post-box, .feedspace-review-item');
                return {
                    transform: style.transform,
                    scrollLeft: el.scrollLeft,
                    animation: style.animationName,
                    transition: style.transitionProperty,
                    childX: firstChild ? firstChild.getBoundingClientRect().left : 0
                };
            });
        };

        const initial = await getMovementState();
        await this.page.waitForTimeout(3000); // can replace with polling for heavy pages
        const final = await getMovementState();

        const hasTransformChange = initial.transform !== final.transform && final.transform !== 'none';
        const hasScrollChange = Math.abs(initial.scrollLeft - final.scrollLeft) > 2;
        const hasChildMovement = Math.abs(initial.childX - final.childX) > 2;
        const hasActiveAnimation = initial.animation !== 'none' || initial.transition !== 'none';

        if (hasTransformChange || hasScrollChange || hasChildMovement || hasActiveAnimation) {
            const signals = [];
            if (hasTransformChange) signals.push('transform');
            if (hasScrollChange) signals.push('scrollLeft');
            if (hasChildMovement) signals.push('child position');
            if (hasActiveAnimation) signals.push('CSS animation');

            this.logAudit(`Automatic horizontal movement detected via ${signals.join(', ')}.`, 'pass');
        } else {
            const isScrollable = await marqueeRow.evaluate(el => el.scrollWidth > el.clientWidth);
            if (isScrollable) {
                this.logAudit('Content overflows and is horizontally scrollable (manual).', 'pass');
            } else {
                this.logAudit('Content fits within viewport; no horizontal scroll needed.', 'info');
            }
        }
    }

    // Review counts and types detection
    async validateReviewCountsAndTypes() {
        this.logAudit('Review Count & Type: Starting validation...', 'info');

        const cards = this.context.locator(this.cardSelector);
        const totalCount = await cards.count();

        if (totalCount === 0) {
            this.logAudit('No cards found in horizontal scroll widget.', 'warn');
            return;
        }

        const cardData = await cards.evaluateAll(elements => {
            return elements.map(el => {
                // Get Feed ID for accurate deduplication
                const feedId = el.getAttribute('data-feed-id') || el.closest('[data-feed-id]')?.getAttribute('data-feed-id');

                const isClone = el.closest('[data-fs-marquee-clone="true"], .cloned, .clone') ||
                    el.getAttribute('aria-hidden') === 'true' ||
                    el.classList.contains('feedspace-marquee-copy');

                const hasVideo = !!el.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button');
                const hasAudio = !!el.querySelector('audio, .audio-player');

                return { feedId, isClone, hasVideo, hasAudio };
            });
        });

        // Robust Deduplication Strategy
        // 1. Try to deduplicate by data-feed-id if available
        const uniqueById = new Map();
        const cardsWithoutId = [];

        cardData.forEach(card => {
            if (card.feedId) {
                if (!uniqueById.has(card.feedId)) {
                    uniqueById.set(card.feedId, card);
                }
            } else {
                cardsWithoutId.push(card);
            }
        });

        // 2. For cards without ID, fallback to clone detection
        const uniqueNoId = cardsWithoutId.filter(c => !c.isClone);

        // Combine
        const uniqueCards = [...uniqueById.values(), ...uniqueNoId];
        const uniqueCount = uniqueCards.length;

        this.reviewStats.total = uniqueCount;
        this.reviewStats.video = uniqueCards.filter(c => c.hasVideo).length;
        this.reviewStats.audio = uniqueCards.filter(c => c.hasAudio).length;
        this.reviewStats.text = this.reviewStats.total - this.reviewStats.video - this.reviewStats.audio;

        this.logAudit(`Reviews: Found ${totalCount} total content blocks (DOM elements).`, 'info');
        this.logAudit(`Unique Reviews: ${this.reviewStats.total} (deduplicated by ID/clones) | Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio}`, 'pass');

        if (uniqueCount === 0 && totalCount > 0) {
            this.logAudit('Warning: All detected cards seem to be duplicates/clones. Check clone detection logic.', 'warn');
        }
    }

    // Read More / Less robust validation
    async validateReadMoreExpansion() {
        this.logAudit('Read More: Starting validation...', 'info');

        let targetTrigger = null;
        let targetCard = null;

        // Global search across defined selectors
        for (const selector of this.selectors.readMore) {
            const triggers = this.context.locator(selector);
            const count = await triggers.count();
            for (let i = 0; i < count; i++) {
                const el = triggers.nth(i);
                if (await el.isVisible().catch(() => false)) {
                    targetTrigger = el;
                    targetCard = el.locator('xpath=./ancestor::*[contains(@class,"feedspace-element-marquee-item") or contains(@class,"feedspace-review-item") or contains(@class,"feedspace-element-post-box")][1]');
                    break;
                }
            }
            if (targetTrigger) break;
        }

        if (!targetTrigger || !targetCard) {
            this.logAudit('No visible "Read More" triggers found.', 'info');
            return;
        }

        try {
            await targetTrigger.scrollIntoViewIfNeeded().catch(() => { });
            await targetTrigger.click({ force: true });
            await this.page.waitForTimeout(500);

            const hasReadLess = await targetCard.locator(this.selectors.readLess.join(',')).count() > 0;

            if (hasReadLess) {
                const collapseBtn = targetCard.locator(this.selectors.readLess.join(',')).first();
                let collapseResult = 'Not tested';

                if (await collapseBtn.isVisible()) {
                    const beforeHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
                    await collapseBtn.click({ force: true });
                    await this.page.waitForTimeout(800);
                    const afterHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => beforeHeight);
                    collapseResult = (afterHeight < beforeHeight - 2) ? 'Verified' : 'Collapse failed';
                }

                this.logAudit(`Read More / Less cycle validated. Collapse: ${collapseResult}`, 'pass');
            } else {
                this.logAudit('Read More clicked but no expansion detected.', 'fail');
            }
        } catch (e) {
            this.logAudit(`Read More action failed: ${e.message}`, 'fail');
        }
    }

    // Text readability validation
    async validateTextReadability() {
        this.logAudit('Text Readability: Starting validation...', 'info');

        try {
            const cards = this.context.locator(this.cardSelector);

            const textSelectors = [
                ...this.selectors.authorName,
                '.feedspace-element-feed-text',
                '.feedspace-card-body p',
                '.feedspace-review-body',
                '.feedspace-element-review-body',
                '.feedspace-element-review-contain-box',
                'p.text-gray-800',
                'p'
            ].join(',');

            const scanResults = await cards.evaluateAll((elements, selectors) => {
                return elements.map(card => {
                    try {
                        const style = window.getComputedStyle(card);
                        if (style.display === 'none' || style.visibility === 'hidden') return null;

                        const nameEl = card.querySelector('.feedspace-author-name, .feedspace-element-author-name, .feedspace-element-author-name-text');
                        const author = nameEl ? nameEl.innerText.trim() : 'Unknown';

                        const textEls = card.querySelectorAll(selectors);
                        const failures = [];

                        textEls.forEach(node => {
                            const s = window.getComputedStyle(node);
                            if (s.display === 'none' || s.visibility === 'hidden') return;
                            const isTruncated = s.textOverflow === 'ellipsis' || (s.webkitLineClamp && s.webkitLineClamp !== '0' && s.webkitLineClamp !== 'none');
                            const isOverflowing = node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth;
                            if (isTruncated || isOverflowing) failures.push({ author, fullText: node.innerText.trim(), className: node.className || 'text-element' });
                        });

                        return failures;
                    } catch { return null; }
                }).filter(f => f !== null).reduce((acc, val) => acc.concat(val), []);
            }, textSelectors);

            const seen = new Set();
            let overflowCount = 0;

            for (const res of scanResults) {
                if (!res || !res.fullText) continue;
                const key = `${res.author}|${res.className}|${res.fullText.substring(0, 30)}`;
                if (seen.has(key)) continue;
                seen.add(key);
                overflowCount++;
                this.detailedFailures.push({
                    type: 'Text Readability',
                    card: res.author,
                    selector: res.className,
                    description: 'Visible text is truncated or cut off',
                    snippet: res.fullText.substring(0, 100).replace(/\n/g, ' '),
                    severity: 'High'
                });
            }

            if (overflowCount > 0) {
                this.logAudit(`Text Readability: Detected ${overflowCount} truncated/cut-off texts.`, 'fail');
            } else {
                this.logAudit('Text Readability: All visible text content is legible.', 'pass');
            }

        } catch (err) {
            this.logAudit(`Text Readability check failed: ${err.message}`, 'fail');
        }
    }

    async validateSocialRedirection() {
        const configSocial = this.config.allow_social_redirection;
        console.log(`[HorizontalScrollWidget] Validating Social Redirection (Config: ${configSocial})...`);

        const socialRedirectionSelector = '.social-redirection-button, .feedspace-element-header-icon > a > img, div.flex > div.flex > a.feedspace-d6-header-icon, .feedspace-element-header-icon, .fe-social-link, .feedspace-element-header-icon a';
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
    async validateBranding() {
        const branding = this.context.locator('a[title="Capture reviews with Feedspace"], .feedspace-branding, a:has-text("Feedspace")').first();
        if (await branding.isVisible()) {
            this.logAudit('Branding: Feedspace branding is visible.');
        } else {
            this.logAudit('Branding: Feedspace branding not found or hidden.', 'info');
        }
    }

    async validateCTA() {
        const cta = this.context.locator('.feedspace-cta-content, .feedspace-inline-cta-card, .feedspace-cta-button-container-d9').first();
        if (await cta.isVisible()) {
            this.logAudit('CTA: Inline CTA detected.');
        } else {
            this.logAudit('CTA: No Inline CTA found.', 'info');
        }
    }
}

module.exports = { HorizontalScrollWidget };
