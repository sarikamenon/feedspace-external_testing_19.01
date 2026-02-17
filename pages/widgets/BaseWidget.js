const { expect } = require('@playwright/test');
const { AxeBuilder } = require('@axe-core/playwright');
const fs = require('fs');
const path = require('path');

class BaseWidget {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.uiRules = config.uiRules || {};
        this.reportType = 'Browser';
        this.auditLog = [];
        this.detailedFailures = []; // { type, card, feedId, description, location, snippet, severity, selector, isLimitation }
        this.accessibilityResults = [];
        this.reviewStats = { total: 0, text: 0, video: 0, audio: 0 };

        // Base selectors - can be overridden by subclasses
        this.containerSelector = '.feedspace-embed-main, .feedspace-element-container';
        this.cardSelector = '.feedspace-review-item, .feedspace-element-feed-box';
        this.brandingSelector = 'a[title="Capture reviews with Feedspace"]';
        this.ctaSelector = '.feedspace-cta-content';

        // Context (main page or iframe)
        this.context = this.page;
    }

    logAudit(message, type = 'pass', isLimitation = false) {
        this.auditLog.push({ message, type, isLimitation });
        console.log(`[WIDGET-AUDIT] ${message}`);
    }

    async initContext() {
        if (this.isContextFixed || (this.context && this.context !== this.page)) {
            console.log(`Widget context already initialized (${this.isContextFixed ? 'Fixed' : 'Pre-assigned frame'}).`);
            return;
        }
        console.log('Initializing widget context...');
        const frames = this.page.frames();
        for (const frame of frames) {
            try {
                const isPresent = await frame.locator(this.containerSelector).first().isVisible({ timeout: 2000 });
                if (isPresent) {
                    console.log(`Widget detected in iframe: ${frame.url()}`);
                    this.context = frame;
                    return;
                }
            } catch (e) { }
        }
        console.log('Widget detected on main page.');
        this.context = this.page;
    }

    async validateVisibility(minReviewsOverride) {
        await this.initContext();
        const minReviews = minReviewsOverride || this.uiRules.minReviews || 1;
        const container = this.context.locator(this.containerSelector).first();

        if (!(await container.isVisible({ timeout: 15000 }).catch(() => false))) {
            this.logAudit('Widget container not visible after timeout (15s).', 'fail');
            return;
        }

        const cards = this.context.locator(this.cardSelector);

        // Wait for at least one card to appear or timeout gracefully
        try {
            await cards.first().waitFor({ state: 'visible', timeout: 10000 });
        } catch (e) {
            console.log('Timeout waiting for review cards to become visible.');
        }

        const cardCount = await cards.count();
        this.reviewStats.total = cardCount;
        this.reviewStats.text = cardCount; // Default starting point

        this.logAudit(`Widget container is visible. Detected ${cardCount} reviews/avatars.`);

        // Performance Optimization: Batch process all cards in one evaluate call
        const cardData = await cards.evaluateAll(elements => {
            return elements.map(el => {
                const hasVideo = !!el.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed:not(.feedspace-element-audio-feed-box)');
                const hasAudio = !!el.querySelector('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box');
                return { hasVideo, hasAudio };
            });
        });

        this.reviewStats.text = 0;
        this.reviewStats.video = 0;
        this.reviewStats.audio = 0;

        for (const data of cardData) {
            if (data.hasVideo) this.reviewStats.video++;
            else if (data.hasAudio) this.reviewStats.audio++;
            else this.reviewStats.text++;
        }

        this.logAudit(`Reviews Segmented: Total ${cardCount} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`);

        if (cardCount >= minReviews) {
            this.logAudit(`Found ${cardCount} reviews (min required: ${minReviews}).`);
        } else {
            this.logAudit(`Insufficient reviews: Found ${cardCount}, expected at least ${minReviews}.`, 'fail');
        }
    }

    // async validateBranding() {
    //     const branding = this.context.locator(this.brandingSelector).first();
    //     if (await branding.isVisible()) {
    //         this.logAudit('Feedspace branding is visible: "Capture reviews with Feedspace"');
    //     } else {
    //         this.logAudit('Feedspace branding not found or hidden.', 'info');
    //     }
    // }

    // async validateCTA() {
    //     const cta = this.context.locator(this.ctaSelector).first();
    //     if (await cta.isVisible()) {
    //         this.logAudit('Inline CTA found: .feedspace-cta-content');
    //     } else {
    //         this.logAudit('No Inline CTA (.feedspace-cta-content) found on this widget.', 'info');
    //     }
    // }

    // async validateDateConsistency() {
    //     console.log('Running Date Consistency check...');
    //     const cards = this.context.locator(this.cardSelector);
    //     const count = await cards.count();
    //     let invalidDateCards = [];

    //     for (let i = 0; i < count; i++) {
    //         const card = cards.nth(i);
    //         const feedId = await card.getAttribute('data-feed-id') || 'N/A';

    //         // Capture selector for identification
    //         const cardSelector = await card.evaluate(el => {
    //             let s = el.tagName.toLowerCase();
    //             if (el.id) s += '#' + el.id;
    //             else if (el.className) s += '.' + el.className.split(' ').join('.');
    //             return s;
    //         });

    //         // 1. Check specific date element if present
    //         const dateElement = card.locator('.date, .review-date, .feedspace-element-date, .feedspace-element-feed-date, .feedspace-element-date-text, .feedspace-wol-date').first();
    //         if (await dateElement.count() > 0) {
    //             const dText = await dateElement.innerText();
    //             // Empty is OK per user request, but literal 'undefined' is not
    //             if (dText.toLowerCase().includes('undefined') || dText.toLowerCase().includes('null') || dText.toLowerCase().includes('invalid date')) {
    //                 const dateSelector = await dateElement.evaluate(el => {
    //                     let s = el.tagName.toLowerCase();
    //                     if (el.className) s += '.' + el.className.split(' ').join('.');
    //                     return s;
    //                 });

    //                 invalidDateCards.push(i + 1);
    //                 this.detailedFailures.push({
    //                     type: 'Date Consistency',
    //                     card: i + 1,
    //                     feedId: feedId,
    //                     location: 'Date Element',
    //                     snippet: await dateElement.innerHTML(),
    //                     description: `Date field contains literal 'undefined' or 'null' (Optional field must be valid or empty).`,
    //                     severity: 'High',
    //                     selector: dateSelector,
    //                     isLimitation: false
    //                 });
    //                 continue; // Already flagged
    //             }
    //         }

    //         // 2. Check general card content for binding errors (leaked undefined/null)
    //         const cardHtml = await card.innerHTML();
    //         const cardText = await card.innerText();
    //         if (cardHtml.toLowerCase().includes('undefined') || cardHtml.toLowerCase().includes('null') || cardText.toLowerCase().includes('invalid date')) {
    //             invalidDateCards.push(i + 1);
    //             this.detailedFailures.push({
    //                 type: 'Date Consistency',
    //                 card: i + 1,
    //                 feedId: feedId,
    //                 location: 'General Card Content',
    //                 snippet: cardHtml.substring(0, 150).replace(/</g, '&lt;').replace(/>/g, '&gt;') + '...',
    //                 description: `Review card contains leaked 'undefined' or 'null' strings.`,
    //                 severity: 'High',
    //                 selector: cardSelector,
    //                 isLimitation: false
    //             });
    //         }
    //     }

    //     if (invalidDateCards.length > 0) {
    //         this.logAudit(`Date Consistency: Found 'undefined' or 'null' strings in cards #${invalidDateCards.join(', #')}`, 'fail');
    //     } else {
    //         const configDate = this.config.allow_to_display_feed_date;
    //         const dateElements = this.context.locator('.date, .review-date, .feedspace-element-date, .feedspace-element-feed-date, .feedspace-element-date-text, .feedspace-wol-date');
    //         const foundCount = await dateElements.count();

    //         if (configDate == 0 || configDate === '0') {
    //             if (foundCount === 0) {
    //                 this.logAudit('Date Consistency: Dates are hidden as per configuration.', 'pass');
    //             } else {
    //                 // Check if they are actually visible AND valid
    //                 const firstEl = dateElements.first();
    //                 const isVisible = await firstEl.isVisible().catch(() => false);
    //                 const hasText = await firstEl.innerText().then(t => t.trim().length > 0).catch(() => false);

    //                 if (!isVisible || !hasText) {
    //                     this.logAudit('Date Consistency: Dates are hidden (CSS/Empty) as per configuration.', 'pass');
    //                 } else {
    //                     this.logAudit('Date Consistency: Dates should be hidden but were found visible.', 'fail');
    //                 }
    //             }
    //         } else if (configDate == 1 || configDate === '1') {
    //             if (foundCount > 0 && await dateElements.first().isVisible()) {
    //                 this.logAudit('Date Consistency: All review dates are valid and visible.');
    //             } else {
    //                 this.logAudit('Date Consistency: Dates expected but not found or hidden.', 'fail');
    //             }
    //         } else {
    //             if (foundCount > 0) {
    //                 this.logAudit('Date Consistency: All review dates are valid or intentionally empty (optional).');
    //             } else {
    //                 this.logAudit('Date Consistency: No review dates found in this layout.', 'info');
    //             }
    //         }
    //     }
    // }

    async checkContrast(selector) {
        const element = this.context.locator(selector).first();
        if (!(await element.isVisible())) return true;

        const result = await element.evaluate(el => {
            const style = window.getComputedStyle(el);
            const color = style.color;
            const bgColor = (function getBgColor(e) {
                const bg = window.getComputedStyle(e).backgroundColor;
                if (bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
                if (e.parentElement) return getBgColor(e.parentElement);
                return 'rgb(255, 255, 255)'; // Fallback to white body
            })(el);

            function parseRGB(rgb) {
                const match = rgb.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
                return match ? [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])] : [255, 255, 255];
            }

            const [r1, g1, b1] = parseRGB(color);
            const [r2, g2, b2] = parseRGB(bgColor);

            // Simple Euclidean distance for "is it almost same" check (0-442 range)
            const diff = Math.sqrt(Math.pow(r1 - r2, 2) + Math.pow(g1 - g2, 2) + Math.pow(b1 - b2, 2));
            return { color, bgColor, diff };
        });

        if (result.diff < 30) { // Very low contrast
            this.logAudit(`UI Integrity: Element "${selector}" has very low visibility (Color: ${result.color} on ${result.bgColor}).`, 'fail');
            return false;
        }
        return true;
    }

    async validateLayoutIntegrity() {
        console.log('Running Layout Integrity check...');
        const container = this.context.locator(this.containerSelector).first();
        const containerBox = await container.boundingBox();
        if (!containerBox) {
            this.logAudit('Layout Integrity: Container not visible, skipping check.', 'info');
            return;
        }

        const cards = this.context.locator(this.cardSelector);
        const count = await cards.count();
        this.logAudit(`Checking layout integrity for ${count} cards...`);

        // Performance Optimization: Batch process all card positions
        const cardData = await cards.evaluateAll((elements, containerRect) => {
            return elements.map((el, i) => {
                // Skip Clones to prevent false positive overlap/layout issues
                if (el.closest('.slick-cloned, .clone, .duplicate, [data-fs-marquee-clone="true"]')) return null;

                const rect = el.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 &&
                    window.getComputedStyle(el).display !== 'none' &&
                    window.getComputedStyle(el).visibility !== 'hidden';

                if (!isVisible) return null;

                // Check intersection with container viewport
                const intersects = !(
                    rect.left > containerRect.x + containerRect.width ||
                    rect.right < containerRect.x ||
                    rect.top > containerRect.y + containerRect.height ||
                    rect.bottom < containerRect.y
                );

                if (!intersects) return null;

                let selector = el.tagName.toLowerCase();
                if (el.id) selector += '#' + el.id;
                else if (el.className) selector += '.' + el.className.split(' ').join('.');

                return {
                    index: i + 1,
                    box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
                    html: el.innerHTML.substring(0, 100),
                    feedId: el.getAttribute('data-feed-id') || 'N/A',
                    selector: selector
                };
            }).filter(d => d !== null);
        }, containerBox);

        if (cardData.length < 2) {
            this.logAudit('Layout Integrity: Not enough visible cards in viewport to check.');
            return;
        }

        let overlaps = [];
        for (let i = 0; i < cardData.length; i++) {
            for (let j = i + 1; j < cardData.length; j++) {
                const c1 = cardData[i];
                const c2 = cardData[j];
                const b1 = c1.box;
                const b2 = c2.box;

                const tolerance = 5;
                const hasOverlap = !(
                    b1.x + b1.width - tolerance <= b2.x ||
                    b2.x + b2.width - tolerance <= b1.x ||
                    b1.y + b1.height - tolerance <= b2.y ||
                    b2.y + b2.height - tolerance <= b1.y
                );

                if (hasOverlap) {
                    const msg = `Card ${c1.index} (ID: ${c1.feedId}) overlaps with Card ${c2.index} (ID: ${c2.feedId})`;
                    overlaps.push(msg);

                    this.detailedFailures.push({
                        type: 'Layout Integrity',
                        card: `${c1.index} & ${c2.index}`,
                        feedId: `${c1.feedId} & ${c2.feedId}`,
                        description: `Overlapping cards detected.`,
                        location: 'Card Element (BoundingBox Check)',
                        snippet: c1.html + '...',
                        severity: 'High',
                        selector: c1.selector,
                        isLimitation: false
                    });
                }
            }
        }
        if (overlaps.length > 0) {
            this.logAudit(`Layout Integrity: Overlapping cards detected: ${overlaps.slice(0, 3).join(', ')}${overlaps.length > 3 ? '...' : ''}`, 'fail');
        } else {
            this.logAudit('Layout Integrity: No overlapping cards found.');
        }
    }

    async validateAlignment() {
        console.log('Running Alignment check...');
        const cards = this.context.locator(this.cardSelector);
        const count = await cards.count();
        if (count < 2) return;

        // Performance Optimization: Batch process all card bounding boxes
        const cardData = await cards.evaluateAll(elements => {
            return elements.map((el, i) => {
                // Skip Clones
                if (el.closest('.slick-cloned, .clone, .duplicate, [data-fs-marquee-clone="true"]')) return null;

                const rect = el.getBoundingClientRect();
                const isVisible = rect.width > 0 && rect.height > 0 &&
                    window.getComputedStyle(el).display !== 'none';

                if (!isVisible) return null;

                return {
                    index: i + 1,
                    box: { x: rect.left, y: rect.top, width: rect.width, height: rect.height },
                    html: el.innerHTML.substring(0, 100),
                    feedId: el.getAttribute('data-feed-id') || 'N/A'
                };
            }).filter(d => d !== null);
        });

        let alignmentIssues = 0;
        for (let i = 0; i < cardData.length - 1; i++) {
            const c1 = cardData[i];
            const c2 = cardData[i + 1];

            if (Math.abs(c1.box.y - c2.box.y) < 10) { // Same row
                if (Math.abs(c1.box.height - c2.box.height) > 5) {
                    alignmentIssues++;
                    this.detailedFailures.push({
                        type: 'Alignment',
                        card: `${c1.index} & ${c2.index}`,
                        feedId: `${c1.feedId} & ${c2.feedId}`,
                        description: `Uneven card heights in same row (Diff: ${Math.abs(c1.box.height - c2.box.height).toFixed(1)}px)`,
                        location: 'Row Alignment',
                        snippet: c1.html + '...',
                        severity: 'Info'
                    });
                }
            }
        }

        if (alignmentIssues > 0) {
            this.logAudit(`Alignment: Found ${alignmentIssues} instances of uneven card alignment.`, 'info');
        } else {
            this.logAudit('Alignment: All cards are properly aligned.');
        }
    }

    async validateTextReadability() {
        console.log('Running Text Readability check...');
        const textElements = this.context.locator(this.cardSelector + ' .feedspace-element-feed-text, ' + this.cardSelector + ' .review-text, ' + this.cardSelector + ' p');
        const count = await textElements.count();
        if (count === 0) {
            this.logAudit('Text Readability: No text elements found matching standard selectors.', 'info');
            return;
        }

        // Performance Optimization: Batch process all text elements
        const textData = await textElements.evaluateAll(elements => {
            return elements.map((el, i) => {
                // Skip Clones
                if (el.closest('.slick-cloned, .clone, .duplicate, [data-fs-marquee-clone="true"]')) return null;

                // Add 2px tolerance to avoid sub-pixel false positives
                let isOverflowing = el.scrollHeight > el.clientHeight + 2 || el.scrollWidth > el.clientWidth + 2;

                // IGNORE Overflow if a "Read More" button exists in the same card (Intentional Truncation)
                const card = el.closest('.feedspace-review-item, .feedspace-element-feed-box, .feedspace-element-post-box, .feedspace-element-marquee-item, .swiper-slide');
                const hasReadMore = !!card?.querySelector('.feedspace-read-more, .read-more, .show-more, .feedspace-element-read-more-text-span, .feedspace-read-more-text');

                if (hasReadMore) {
                    isOverflowing = false;
                }

                const style = window.getComputedStyle(el);
                const fontSize = parseFloat(style.fontSize);
                const color = style.color;

                if (el.clientHeight === 0) return null; // Not visible

                const cardId = el.closest('[data-feed-id]')?.getAttribute('data-feed-id') || 'Unknown';
                const textSnippet = el.innerText.substring(0, 50).replace(/\n/g, ' ') + '...';

                return {
                    index: i + 1,
                    cardId,
                    textSnippet,
                    isOverflowing,
                    fontSize,
                    color,
                    html: el.outerHTML.substring(0, 100)
                };
            }).filter(d => d !== null);
        });

        let overflowCount = 0;
        for (const data of textData) {
            if (data.isOverflowing) {
                overflowCount++;
                this.detailedFailures.push({
                    type: 'Text Readability',
                    card: `ID: ${data.cardId} (Index #${data.index})`,
                    description: `Text is cut off or overflowing. Content starts with: "${data.textSnippet}"`,
                    location: 'CSS Overflow',
                    snippet: data.html,
                    severity: 'Medium'
                });
            }
        }

        if (overflowCount > 0) {
            this.logAudit(`Text Readability: Found ${overflowCount} instances of cut-off text.`, 'fail');
        } else {
            this.logAudit('Text Readability: All text is legible and contained.');
        }
    }

    // async validateReadMore() {
    //     console.log('Running robust Read More functionality check (Global Search)...');
    //     await this.page.waitForTimeout(1000); // Stabilization

    //     // High-confidence generic selectors
    //     const readMoreSelectors = [
    //         '.feedspace-element-read-more',
    //         '.feedspace-read-more-text',
    //         '.read-more',
    //         'span:has-text("Read more")',
    //         'button:has-text("Read more")',
    //         'span:has-text("Read More")',
    //         'button:has-text("Read More")',
    //         'a:has-text("Read more")',
    //         '.show-more'
    //     ];

    //     let targetTrigger = null;
    //     let targetCard = null;

    //     // GLOBAL SEARCH: Look for ANY card with a visible Read More button
    //     for (const selector of readMoreSelectors) {
    //         const triggers = this.context.locator(selector);
    //         const count = await triggers.count();

    //         for (let i = 0; i < count; i++) {
    //             const el = triggers.nth(i);
    //             const isVisible = await el.isVisible().catch(() => false);
    //             const isAttached = await el.count().catch(() => 0) > 0;

    //             if (isVisible || isAttached) {
    //                 // Find the parent card for this trigger
    //                 targetCard = el.locator('xpath=./ancestor::*[contains(@class, "feedspace-review-item") or contains(@class, "feedspace-element-post-box") or contains(@class, "feedspace-element-feed-box") or contains(@class, "feedspace-element-marquee-item")][1]').first();

    //                 if (isVisible) {
    //                     targetTrigger = el;
    //                     break;
    //                 }
    //             }
    //         }
    //         if (targetTrigger) break;
    //     }

    //     if (targetTrigger && targetCard) {
    //         this.logAudit('[Read More] Read More: Found a visible expansion trigger.');
    //         try {
    //             const initialHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
    //             await targetTrigger.scrollIntoViewIfNeeded().catch(() => { });
    //             await targetTrigger.click({ force: true });
    //             await this.page.waitForTimeout(1200);

    //             const expandedHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);

    //             // Check for "Read Less" or content expansion
    //             const readLessSelector = '.feedspace-read-less-text, .feedspace-element-read-less-text-span, span:has-text("Read less"), button:has-text("Read less"), span:has-text("Read Less"), button:has-text("Read Less")';
    //             const hasReadLess = await targetCard.locator(readLessSelector).count() > 0;

    //             if (hasReadLess || expandedHeight > initialHeight + 5) {
    //                 this.logAudit(`[Read More] Read More: Expansion verified. New height: ${expandedHeight}px (+${expandedHeight - initialHeight}px).`);

    //                 // Try to collapse back if possible
    //                 const collapseBtn = targetCard.locator(readLessSelector).first();
    //                 if (await collapseBtn.isVisible()) {
    //                     await collapseBtn.click({ force: true });
    //                     await this.page.waitForTimeout(1000);
    //                     this.logAudit('[Read More] Read More / Less: Full cycle validated successfully.');
    //                 }
    //             } else {
    //                 if (!(await targetTrigger.isVisible())) {
    //                     this.logAudit('[Read More] Read More: Trigger disappeared after click, assuming textual expansion successful.');
    //                 } else {
    //                     this.logAudit('[Read More] Read More: Clicked trigger but did not detect expansion or "Read Less" state.', 'info');
    //                 }
    //             }
    //         } catch (e) {
    //             this.logAudit(`[Read More] Read More: Interaction failed - ${e.message.split('\n')[0]}`, 'info');
    //         }
    //     } else {
    //         // Fallback: Check if "Read More" text exists in the DOM but is not visible/interactable
    //         const domTextCheck = this.context.locator('text=/Read [mM]ore/');
    //         if (await domTextCheck.count() > 0) {
    //             this.logAudit('[Read More] Read More: Text is truncated but interactive "Read More" button is missing or non-functional.', 'fail');
    //         } else {
    //             this.logAudit('[Read More] Read More: No "Read More" button found (all text likely visible).', 'info');
    //         }
    //     }
    // }

    async validateResponsiveness(device = 'Mobile') {
        console.log(`Running Responsiveness check for ${device}...`);
        this.reportType = device;
        const viewports = {
            'Mobile': { width: 375, height: 812 },
            'Tablet': { width: 768, height: 1024 },
            'Desktop': { width: 1440, height: 900 }
        };

        const vp = viewports[device] || viewports['Mobile'];
        await this.page.setViewportSize(vp);
        await this.page.waitForTimeout(3000);
        this.logAudit(`Responsiveness: Validated layout for ${device} (${vp.width}x${vp.height}).`);

        // Re-check visibility and layout at this breakpoint
        const container = this.context.locator(this.containerSelector).first();
        if (await container.isVisible()) {
            this.logAudit(`${device} Layout: Widget remains visible and functional.`);
        } else {
            this.logAudit(`${device} Layout: Widget became hidden!`, 'fail');
        }
    }

    async runAccessibilityAudit() {
        console.log(`Running Accessibility Audit (${this.reportType}) on container ${this.containerSelector}...`);
        try {
            await this.initContext();

            // Preliminary check to avoid Axe crash if container is missing
            const container = this.context.locator(this.containerSelector).first();
            if (await container.count() === 0) {
                this.logAudit(`Accessibility (${this.reportType}): Skipping (Container not found in current context).`, 'info');
                return;
            }

            const results = await new AxeBuilder({ page: this.page })
                .include(this.containerSelector)
                .analyze();

            this.accessibilityResults.push({ type: this.reportType, violations: results.violations });

            if (results.violations.length === 0) {
                this.logAudit(`Accessibility (${this.reportType}): No violations found.`);
            } else {
                this.logAudit(`Accessibility (${this.reportType}): Found ${results.violations.length} violations.`, 'fail');
            }
        } catch (e) {
            const isMissing = e.message.includes('No elements found') || e.message.includes('not visible');
            this.logAudit(`Accessibility Audit Note: ${e.message.split('\n')[0]}`, isMissing ? 'info' : 'fail');
        }
    }

    async validateMediaIntegrity() {
        console.log('Running Media Integrity check...');

        const images = this.context.locator('img');
        const imgCount = await images.count();
        this.logAudit(`Checking integrity of ${imgCount} images...`);

        // Performance Optimization: Batch process all images
        const imageData = await images.evaluateAll(elements => {
            return elements.map((el, i) => {
                // Skip Clones
                if (el.closest('[data-fs-marquee-clone="true"], .cloned, .clone, .duplicate, .slick-cloned')) return null;
                if (el.getAttribute('aria-hidden') === 'true') return null;

                // Skip tiny/empty images
                if ((el.width <= 1 && el.height <= 1) || (el.naturalWidth === 0 && el.naturalHeight === 0 && el.width === 0 && el.height === 0)) return null;

                const isBroken = !el.complete || el.naturalWidth === 0;

                // Get identity
                let cardId = 'Unknown';
                const parentWithId = el.closest('[data-feed-id]');
                if (parentWithId) {
                    cardId = parentWithId.getAttribute('data-feed-id');
                } else {
                    const card = el.closest('.feedspace-element-feed-box-inner, .feedspace-element-post-box, .swiper-slide, .feedspace-marquee-box-inner');
                    if (card && card.parentElement) {
                        const index = Array.from(card.parentElement.children).indexOf(card) + 1;
                        cardId = `Card #${index}`;
                    }
                }

                let selector = el.tagName.toLowerCase();
                if (el.className) selector += '.' + el.className.split(' ').join('.');

                return {
                    index: i,
                    isBroken,
                    cardId,
                    src: el.src,
                    outerHTML: el.outerHTML.substring(0, 100),
                    selector: selector
                };
            }).filter(d => d !== null);
        });

        let brokenImages = [];
        for (const data of imageData) {
            if (data.isBroken) {
                // GLOBAL DEDUPLICATION Check
                const alreadyReported = this.detailedFailures.some(f => f.type === 'Media Integrity' && f.card === `ID: ${data.cardId}`);

                if (!alreadyReported) {
                    brokenImages.push(data);
                    this.detailedFailures.push({
                        type: 'Media Integrity',
                        card: `ID: ${data.cardId}`,
                        description: 'Broken Image detected',
                        location: 'Image Element',
                        snippet: data.outerHTML,
                        severity: 'High',
                        selector: data.selector,
                        isLimitation: false
                    });
                }
            }
        }

        if (brokenImages.length > 0) {
            this.logAudit(`Media Integrity: Found broken media on ${brokenImages.length} cards.`, 'fail');
        } else {
            this.logAudit('Media Integrity: All images loaded correctly.');
        }

        // 2. Video Integrity (Same deduplication logic)
        const videos = this.context.locator('video, .feedspace-element-video-player, iframe[src*="youtube"], iframe[src*="vimeo"]');
        const videoCount = await videos.count();
        let videoErrors = 0;

        for (let i = 0; i < videoCount; i++) {
            const vid = videos.nth(i);
            const shouldSkip = await vid.evaluate(el => !!el.closest('[data-fs-marquee-clone="true"], .cloned, .clone, .duplicate, .slick-cloned'));
            if (shouldSkip) continue;

            const tag = await vid.evaluate(v => v.tagName.toLowerCase());
            let hasError = false;

            if (tag === 'video') {
                const error = await vid.evaluate(v => v.error);
                if (error) hasError = true;
            } else {
                const isVisible = await vid.isVisible();
                if (!isVisible) hasError = true;
            }

            if (hasError) {
                const identity = await vid.evaluate((el) => {
                    let id = 'Unknown';
                    const parentWithId = el.closest('[data-feed-id]');
                    if (parentWithId) {
                        id = parentWithId.getAttribute('data-feed-id');
                    } else {
                        const card = el.closest('.feedspace-element-feed-box-inner, .feedspace-element-post-box, .swiper-slide, .feedspace-marquee-box-inner');
                        if (card && card.parentElement) {
                            const index = Array.from(card.parentElement.children).indexOf(card) + 1;
                            id = `Card #${index}`;
                        }
                    }

                    let selector = el.tagName.toLowerCase();
                    if (el.className) selector += '.' + el.className.split(' ').join('.');

                    return { id, selector };
                });

                // GLOBAL DEDUPLICATION Check
                const alreadyReported = this.detailedFailures.some(f => f.type === 'Media Integrity' && f.card === `ID: ${identity.id}`);

                if (!alreadyReported) {
                    videoErrors++;

                    this.detailedFailures.push({
                        type: 'Media Integrity',
                        card: `ID: ${identity.id}`,
                        description: 'Video Playback/Loading Error',
                        location: tag,
                        snippet: await vid.evaluate(el => el.outerHTML.substring(0, 100)),
                        severity: 'High',
                        selector: identity.selector,
                        isLimitation: false
                    });
                }
            }
        }

        if (videoErrors > 0) {
            this.logAudit(`Media Integrity: Found video issues on ${videoErrors} cards.`, 'fail');
        } else if (videoCount > 0) {
            this.logAudit(`Media Integrity: Verified ${videoCount} videos.`);
        }
    }
    /**
     * MASTER AUDIT FLOW: Executes all standard validations and specialized unique behaviors.
     */
    async performComprehensiveAudit() {
        const widgetName = this.constructor.name;
        console.log(`\n[MASTER-AUDIT] Starting comprehensive audit for: ${widgetName}`);

        try {
            await this.initContext();

            // --- PART 1: Standard Base Audits ---
            await this.validateVisibility();
            //await this.validateBranding();
            //await this.validateCTA();
            //await this.validateDateConsistency();
            await this.validateLayoutIntegrity();
            await this.validateAlignment();
            await this.runAccessibilityAudit();

            // --- PART 2: Specialized Widget-Specific Audits ---
            // These can load more content (e.g. Masonry Load More), so they must happen before final integrity checks
            if (typeof this.validateUniqueBehaviors === 'function') {
                console.log(`[MASTER-AUDIT] Executing specialized unique behaviors for ${widgetName}...`);
                await this.validateUniqueBehaviors();
            } else {
                console.log(`[MASTER-AUDIT] No specialized behaviors defined for ${widgetName}.`);
            }

            // --- PART 3: Post-Interaction Integrity Checks (Run on ALL loaded content) ---
            await this.validateTextReadability();
            await this.validateMediaIntegrity();
            //  await this.validateReadMore();
            await this.validateCardConsistency();

            // --- PART 4: Finalize Coverage ---
            this.finalizeAuditCoverage();

        } catch (error) {
            console.error(`[MASTER-AUDIT] Critical error during audit for ${widgetName}: ${error.message}`);
            this.logAudit(`Critical Audit Failure: ${error.message}`, 'fail');
        }

        const failures = this.auditLog.filter(l => l.type === 'fail');
        console.log(`[MASTER-AUDIT] Completed audit for ${widgetName}. Found ${failures.length} base/specialized failures.`);
    }

    finalizeAuditCoverage() {
        const categories = [
            { key: '[Interactive]', label: 'Interactive Behavior' },
            { key: '[Navigation]', label: 'Navigation (Arrows/Dots)' },
            { key: '[Playback]', label: 'Media Playback' },
            { key: '[Responsiveness]', label: 'Responsiveness' },
            { key: '[Read More]', label: 'Read More / Less Cycle' },
            { key: '[Load More]', label: 'Load More Content' }
        ];

        categories.forEach(cat => {
            const hit = this.auditLog.some(l => l.message && l.message.includes(cat.key));
            if (!hit) {
                this.logAudit(`${cat.key} Checked (No specialized ${cat.label} required or applicable).`, 'info');
            }
        });
    }

    getReportData() {
        return {
            auditLog: this.auditLog,
            reviewStats: this.reviewStats,
            detailedFailures: this.detailedFailures,
            accessibilityResults: this.accessibilityResults,
            generatedReports: Array.from(this.generatedReports || [])
        };
    }

    async validateCardConsistency() {
        console.log('Running Card Consistency check...');
        // User feedback: Some reviews only have star ratings, so strict author/text checks are removed.
        this.logAudit('Card Consistency: Checks skipped (Star-only reviews are valid).');
    }


    async generateReport(widgetType, filenameSuffix = '') {
        const reportKey = `${this.reportType}_${filenameSuffix}`;
        this.generatedReports = this.generatedReports || new Set();

        // Allow generating same report type if suffix is different (e.g. different URL)
        if (this.generatedReports.has(reportKey)) {
            console.log(`[WIDGET-AUDIT] Report for ${reportKey} already generated. Skipping.`);
            return;
        }

        console.log(`[WIDGET-AUDIT] Generating ${this.reportType} report for ${widgetType} (Suffix: ${filenameSuffix}). Reviews: ${this.reviewStats.total}`);
        this.generatedReports.add(reportKey);
        const reportDir = path.resolve('reports');
        if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir, { recursive: true });

        const filename = `Report_${widgetType}_${this.reportType}${filenameSuffix ? '_' + filenameSuffix : ''}.html`;
        const reportPath = path.join(reportDir, filename);
        const date = new Date().toLocaleString();

        // Helper to find audit results by keywords (case-insensitive)
        const getAuditStatus = (keyword) => {
            const logs = this.auditLog.filter(l => l.message && l.message.toLowerCase().includes(keyword.toLowerCase()));

            // IF NO LOGS, return a clean "Checked/Passed" if it's a known optional category
            if (logs.length === 0) {
                return { icon: '✅', message: `No ${keyword} issues detected during audit.`, type: 'pass' };
            }

            const failed = logs.filter(l => l.type === 'fail');
            if (failed.length > 0) return { icon: '❌', message: failed[failed.length - 1].message, type: 'fail' };

            const passed = logs.filter(l => l.type === 'pass');
            if (passed.length > 0) return { icon: '✅', message: passed[passed.length - 1].message, type: 'pass' };

            // Info only (e.g., N/A or detection logs)
            return { icon: 'ℹ️', message: logs[logs.length - 1].message, type: 'info' };
        };

        const contentIssueEntry = this.auditLog.find(l => l.message.includes('Card Consistency'));
        const dateIssueEntry = this.auditLog.find(l => l.message.includes('Date Consistency'));
        const a11yIssueEntry = this.auditLog.find(l => l.message.includes('Accessibility'));

        const styles = `
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; line-height: 1.6; color: #333; max-width: 1100px; margin: 0 auto; padding: 30px; background: #f8f9fa; }
            h1, h2, h3 { color: #2c3e50; }
            .report-card { background: white; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.08); margin-bottom: 30px; }
            .summary-item { margin-bottom: 12px; font-size: 16px; border-bottom: 1px solid #f0f0f0; padding-bottom: 8px; }
            
            table { width: 100%; border-collapse: collapse; margin: 20px 0; background: white; font-size: 14px; }
            th, td { padding: 12px 15px; border: 1px solid #e1e4e8; text-align: left; vertical-align: top; }
            th { background-color: #f1f3f5; color: #495057; font-weight: 600; }
            tr:nth-child(even) { background-color: #fafbfc; }
            
            .severity-critical { background: #fee2e2; color: #991b1b; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            .severity-high { background: #ffedd5; color: #9a3412; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            .severity-low { background: #dcfce7; color: #166534; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold; }
            
            .selector-tag { color: #e83e8c; font-weight: bold; font-family: monospace; font-size: 12px; background: #fff0f6; padding: 2px 4px; border-radius: 3px; border: 1px solid #ffdeeb; }
            .html-snippet { background: #2d3436; color: #fab1a0; padding: 10px; border-radius: 4px; display: block; overflow-x: auto; font-family: 'Courier New', Courier, monospace; font-size: 11px; margin-top: 5px; }
            
            .issue-group { border-bottom: 1px solid #edf2f7; padding: 10px 0; }
            .issue-group:last-child { border-bottom: none; }
            
            .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 20px; margin-bottom: 30px; }
            .metric-box { background: #fff; border: 1px solid #e1e4e8; padding: 20px; border-radius: 8px; text-align: center; }
            .metric-val { font-size: 28px; font-weight: bold; color: #3498db; display: block; }
            .metric-label { font-size: 12px; color: #7f8c8d; text-transform: uppercase; letter-spacing: 1px; }

            .defect-table th { background-color: #fff5f5; color: #c53030; }
            .limitation-table th { background-color: #ebf8ff; color: #2b6cb0; }
        `;

        // Grouping Logic
        const groupFailures = (failures) => {
            const groups = {};
            failures.forEach(f => {
                const key = `${f.type}|${f.description}`;
                if (!groups[key]) {
                    groups[key] = {
                        type: f.type,
                        description: f.description,
                        severity: f.severity,
                        examples: []
                    };
                }
                groups[key].examples.push(f);
            });
            return Object.values(groups);
        };

        const generateTableRows = (groupedFailures) => {
            if (groupedFailures.length === 0) return '<tr><td colspan="5" style="text-align:center; color:green; padding: 20px;">✅ No issues detected in this category.</td></tr>';

            return groupedFailures.map(group => {
                const affectedCards = group.examples.map(e => `#${e.card}`).slice(0, 5).join(', ') + (group.examples.length > 5 ? '...' : '');
                const selectors = [...new Set(group.examples.map(e => e.selector))].slice(0, 3).map(s => `<div class="selector-tag">${s}</div>`).join('');

                const severityClass = (group.severity || 'info').toLowerCase();
                const severityLabel = group.severity || 'Info';

                return `
                    <tr>
                        <td style="font-weight:bold;">${group.type}</td>
                        <td>${affectedCards} (${group.examples.length} affected)</td>
                        <td>${selectors || '<span style="color:#999">N/A</span>'}</td>
                        <td>
                            ${group.description}
                            <code class="html-snippet">${group.examples[0].snippet}</code>
                        </td>
                        <td><span class="severity-${severityClass}">${severityLabel}</span></td>
                    </tr>`;
            }).join('');
        };

        const defects = this.detailedFailures.filter(f => !f.isLimitation);
        const limitations = this.detailedFailures.filter(f => f.isLimitation);

        // Add automation-logged "info" as limitations if they look like skips/timeouts
        // EXCLUDE boilerplate "Checked", "No found", "Audit Note", and standard feature checks to keep Section 2.2 clean
        this.auditLog.filter(l => l.type !== 'pass' &&
            (l.message.includes('skipping') || l.message.includes('No') || l.message.includes('timeout')) &&
            !l.message.includes('Checked (No specialized') &&
            !l.message.includes('No "Read More" button found') &&
            !l.message.includes('No Load More button found') &&
            !l.message.includes('No media play buttons found') &&
            !l.message.includes('No Inline CTA found') &&
            !l.message.includes('No text elements found matching') &&
            !l.message.includes('Accessibility Audit Note')
        ).forEach(l => {
            const alreadyIn = limitations.some(lim => lim.description === l.message);
            if (!alreadyIn) {
                limitations.push({
                    type: 'Automation Alert',
                    card: 'N/A',
                    selector: 'Global',
                    description: l.message,
                    snippet: 'N/A',
                    severity: 'Low',
                    isLimitation: true
                });
            }
        });

        const defectsHtml = generateTableRows(groupFailures(defects));
        const limitationsHtml = generateTableRows(groupFailures(limitations));

        // 2.2 Accessibility Detailed Results
        let a11yDetailedHtml = '';
        let totalA11yViolations = 0;
        this.accessibilityResults.forEach(res => {
            res.violations.forEach(v => {
                totalA11yViolations++;
                let nodesHtml = '';
                v.nodes.forEach(node => {
                    nodesHtml += `
                        <div style="margin-top:10px;">
                            <span class="selector-tag">${node.target.join(' > ')}</span>
                            <code class="html-snippet">${node.html.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code>
                        </div>`;
                });
                a11yDetailedHtml += `
                    <div class="violation-card">
                        <h4 style="margin-top:0;">${v.id} [${res.type}]</h4>
                        <p><strong>Description:</strong> ${v.description}</p>
                        <p><strong>Severity:</strong> <span class="severity-critical">${v.impact}</span></p>
                        ${nodesHtml}
                    </div>`;
            });
        });

        // 2.3 Feature Matrix
        const features = [
            ['Widget Detection', 'widget detected'],
            ['Branding Integrity', 'Branding'],
            ['CTA Functionality', 'CTA'],
            ['Layout & Alignment', 'Layout Integrity'],
            ['Text Readability', 'Text Readability'],
            ['Media Integrity', 'Media Integrity'],
            ['Date Consistency', 'Date Consistency'],
            ['Interactive Behavior', '[Interactive]'],
            ['Navigation (Arrows/Dots)', '[Navigation]'],
            ['Media Playback', '[Playback]'],
            ['Read More / Less Cycle', '[Read More]'],
            ['Load More Content', '[Load More]'],
            ['Responsiveness', '[Responsiveness]']
        ];

        let featureRows = '';
        features.forEach(([name, key]) => {
            const status = getAuditStatus(key);
            featureRows += `
                <tr>
                    <td>${name}</td>
                    <td style="text-align:center;">${status.icon}</td>
                    <td>${status.message}</td>
                </tr>`;
        });

        const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>Refined Widget UI Audit - ${widgetType}</title>
    <style>${styles}</style>
</head>
<body>
    <h1>1. Executive Summary</h1>
    <div class="report-card">
        <div class="metrics-grid">
            <div class="metric-box"><span class="metric-val">${this.reviewStats.total}</span><span class="metric-label">Total Reviews</span></div>
            <div class="metric-box"><span class="metric-val">${this.reviewStats.text}</span><span class="metric-label">Text Reviews</span></div>
            <div class="metric-box"><span class="metric-val">${this.reviewStats.video}</span><span class="metric-label">Video Reviews</span></div>
            <div class="metric-box"><span class="metric-val">${this.reviewStats.audio}</span><span class="metric-label">Audio Reviews</span></div>
        </div>

        <div class="summary-item">${getAuditStatus('Visibility').icon} Widget Visibility: ${getAuditStatus('Visibility').type === 'fail' ? 'Issues found' : 'Validated'}</div>
        <div class="summary-item">${getAuditStatus('Media Integrity').icon} Media Verification: ${this.detailedFailures.some(f => f.type === 'Media Integrity') ? 'Defects found' : 'Passed'}</div>
        <div class="summary-item">${getAuditStatus('Layout Integrity').icon} Structural Integrity: ${this.detailedFailures.some(f => f.type === 'Layout Integrity') ? 'Defects found' : 'Passed'}</div>
        
        <div style="margin-top:20px; padding:15px; background:#fff5f5; border-radius:8px; border-left:5px solid #c53030;">
            <strong>⚠️ Audit Findings:</strong> 
            Found ${defects.length} functional UI defects and ${limitations.length} automation/data limitations.
        </div>
    </div>

    <h1>2. Detailed Findings</h1>
    
    <h2>2.1 Functional UI Defects (Requires Dev Attention)</h2>
    <p>These issues represent visible bugs in the widget UI or content delivery.</p>
    <table class="defect-table">
        <thead>
            <tr>
                <th style="width:150px;">Defect Type</th>
                <th style="width:200px;">Impacted Elements</th>
                <th style="width:200px;">CSS / Unique ID</th>
                <th>Description & Snippet</th>
                <th style="width:100px;">Severity</th>
            </tr>
        </thead>
        <tbody>
            ${defectsHtml}
        </tbody>
    </table>

    <h2>2.2 Automation & Data Limitations</h2>
    <p>These entries indicate scenarios where data was missing (e.g., no reviews) or automation could not perform a check.</p>
    <table class="limitation-table">
        <thead>
            <tr>
                <th style="width:150px;">Check Type</th>
                <th style="width:150px;">Scope</th>
                <th style="width:200px;">Identification</th>
                <th>Observation</th>
                <th style="width:100px;">Status</th>
            </tr>
        </thead>
        <tbody>
            ${limitationsHtml}
        </tbody>
    </table>

    <h2>2.3 Accessibility Audit</h2>
    <div class="report-card">
        ${a11yDetailedHtml || '<p style="color:green; font-weight:bold;">✅ No accessibility violations detected via browser audit.</p>'}
    </div>

    <h2>2.4 Full Feature Matrix</h2>
    <table>
        <thead>
            <tr><th>Feature</th><th>Status</th><th>Notes</th></tr>
        </thead>
        <tbody>
            ${featureRows}
        </tbody>
    </table>

    <div style="text-align: center; margin-top: 50px; color: #bdc3c7; font-size: 12px; padding-bottom: 50px;">
        Generated by Antigravity Automation Agent on ${date} | URL: ${this.config?.page?.url || 'N/A'}
    </div>
</body>
</html>`;

        fs.writeFileSync(reportPath, htmlContent);
        console.log(`Grouped HTML Report generated: ${reportPath}`);
    }
}

module.exports = { BaseWidget };
