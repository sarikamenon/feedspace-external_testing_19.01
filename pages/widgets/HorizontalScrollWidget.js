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

        // Multi-signal movement detection
        const getMovementState = async () => {
            return await marqueeRow.evaluate((el) => {
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
        await this.page.waitForTimeout(3000); // 3s wait to catch slow movement
        const final = await getMovementState();

        const hasTransformChange = initial.transform !== final.transform && final.transform !== 'none';
        const hasScrollChange = Math.abs(initial.scrollLeft - final.scrollLeft) > 2;
        const hasChildMovement = Math.abs(initial.childX - final.childX) > 2;
        const hasActiveAnimation = initial.animation !== 'none' || initial.transition !== 'none';

        if (hasTransformChange || hasScrollChange || hasChildMovement || hasActiveAnimation) {
            let signal = [];
            if (hasTransformChange) signal.push('transform');
            if (hasScrollChange) signal.push('scrollLeft');
            if (hasChildMovement) signal.push('child position');
            if (hasActiveAnimation) signal.push('active CSS animation');

            this.logAudit(`Horizontal Scrolling: Automatic movement detected via ${signal.join(', ')}.`);
            this.logAudit('Interaction: Horizontal scrolling behavior confirmed.');
        } else {
            this.logAudit('Horizontal Scrolling: No automatic movement detected after 3s delay. Checking for manual overflow...', 'info');

            const isScrollable = await marqueeRow.evaluate(el => el.scrollWidth > el.clientWidth);
            if (isScrollable) {
                this.logAudit('Horizontal Scrolling: Content overflows and is horizontally scrollable (manual only).');
                this.logAudit('Interaction: Horizontal scrolling confirmed via overflow.');
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
                    const expansionResult = 'Verified (Expansion detected)';
                    let collapseResult = 'Not tested';

                    const collapseBtn = targetCard.locator('.feedspace-element-read-less, .feedspace-element-read-less-text-span, span:has-text("Read less")').first();
                    if (await collapseBtn.isVisible()) {
                        const beforeCollapseHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
                        await collapseBtn.click({ force: true });
                        await this.page.waitForTimeout(800);
                        const afterCollapseHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => beforeCollapseHeight);
                        if (afterCollapseHeight < beforeCollapseHeight - 2 || !(await collapseBtn.isVisible())) {
                            collapseResult = `Verified (-${beforeCollapseHeight - afterCollapseHeight}px)`;
                        } else {
                            collapseResult = 'Collapse failed (height did not decrease)';
                        }
                    }

                    if (collapseResult.startsWith('Verified')) {
                        this.logAudit(`Read More / Less Cycle: Successfully validated full toggle cycle. (${expansionResult} -> ${collapseResult}).`);
                    } else {
                        this.logAudit(`Read More: Expansion validated (${expansionResult}), but Collapse check had issue: ${collapseResult}.`, 'info');
                    }
                } else {
                    this.logAudit('Read More: Clicked trigger but did not detect expansion state.', 'fail');
                }
            } catch (e) {
                this.logAudit(`Read More: Expanded action failed - ${e.message}`, 'info');
            }
        } else {
            this.logAudit('Read More: No visible "Read More" triggers found in the entire widget.', 'info');
        }
    }

    async validateTextReadability() {
        try {
            await this.initContext();
            this.logAudit('Text Readability: Intensive content check for truncation.');

            const textSelectors = [
                '.feedspace-author-name',
                '.feedspace-author-position',
                '.feedspace-element-author-name',
                '.feedspace-element-author-position',
                '.feedspace-element-author-name-text',
                '.feedspace-element-author-position-text',
                '.feedspace-element-feed-text',
                '.feedspace-card-body p',
                '.feedspace-review-body',
                '.feedspace-element-review-body',
                'p.text-gray-800',
                '.feedspace-element-review-contain-box',
                'p' // Catch-all for paragraph text
            ].join(', ');

            const cards = this.context.locator(this.cardSelector);
            const cardCount = await cards.count();
            console.log(`[DEBUG] HorizontalScroll audit: batch-scanning ${cardCount} card candidates.`);

            // "God Mode" Batch Evaluation: Process all cards in a SINGLE browser-side call
            const scanResults = await cards.evaluateAll((elements, selectors) => {
                return elements.map((card, i) => {
                    const style = window.getComputedStyle(card);
                    const isVisible = card.offsetWidth > 0 && card.offsetHeight > 0 && style.display !== 'none' && style.visibility !== 'hidden';
                    if (!isVisible) return null;

                    // Extract author name for this card
                    const nameSelectors = '.feedspace-author-name, .feedspace-element-author-name, .feedspace-element-author-name-text, .feedspace-element-feed-name, .author-name, .feedspace-review-author-name, .feedspace-element-author-title';
                    const nameEl = card.querySelector(nameSelectors);
                    const authorName = nameEl ? nameEl.innerText.trim() : `Card ${i + 1}`;

                    // Find text elements within this card
                    const textElements = card.querySelectorAll(selectors);
                    const cardFailures = [];

                    textElements.forEach(node => {
                        const s = window.getComputedStyle(node);
                        if (s.display === 'none' || s.visibility === 'hidden') return;

                        const isTruncated = s.textOverflow === 'ellipsis' || (s.webkitLineClamp !== 'none' && s.webkitLineClamp !== '0');
                        const isOverflowing = node.scrollHeight > node.clientHeight || node.scrollWidth > node.clientWidth;

                        if (isTruncated || isOverflowing) {
                            cardFailures.push({
                                author: authorName,
                                fullText: node.innerText.trim(),
                                className: node.className || 'text-element'
                            });
                        }
                    });

                    return cardFailures;
                }).filter(f => f !== null).reduce((acc, val) => acc.concat(val), []);
            }, textSelectors).catch(err => {
                console.error(`[DEBUG] Batch evaluation failed: ${err.message}`);
                return [];
            });

            const seenFailures = new Set();
            let overflowCount = 0;

            for (const res of scanResults) {
                if (!res || !res.fullText) continue;

                const textSnippet = res.fullText.substring(0, 30);
                const className = res.className
                    .split(' ')
                    .filter(c => c.length > 0)
                    .slice(0, 2)
                    .join('.') || 'text-element';

                const dedupKey = `${res.author}|${className}|${textSnippet}`;
                if (seenFailures.has(dedupKey)) continue;
                seenFailures.add(dedupKey);

                this.detailedFailures.push({
                    type: 'Text Readability',
                    card: res.author,
                    selector: className,
                    description: `Visible text content is cut off or truncated.`,
                    snippet: res.fullText.substring(0, 100).replace(/\n/g, ' '),
                    severity: 'High'
                });
                overflowCount++;
            }

            if (overflowCount > 0) {
                this.logAudit(`Text Readability: Detected ${overflowCount} unique instances of text cut-off across the review stack.`, 'fail');
            } else {
                this.logAudit('Text Readability: All visible text content is legible and well-contained.');
            }
        } catch (globalErr) {
            console.error(`[FATAL] HorizontalScroll validateTextReadability failed: ${globalErr.message}`);
            this.logAudit(`Text Readability check encountered a critical error: ${globalErr.message}`, 'fail');
        }
    }

    async validateReadMore() {
        // Redirect legacy call to the new robust implementation
        await this.validateReadMoreExpansion();
    }
}

module.exports = { HorizontalScrollWidget };
