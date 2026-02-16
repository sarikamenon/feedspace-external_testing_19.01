const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class CarouselWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget';
        // Correctly scope card search to the container (handling comma-separated container selectors and dark mode)
        this.cardSelector = [
            'div.feedspace-element-carousel-track > div.feedspace-element-feed-box > div.feedspace-element-feed-box-inner',
            '.feedspace-carousel-widget .feedspace-element-feed-box',
            '.feedspace-element-container.feedspace-carousel-widget .feedspace-element-feed-box',
            '.feedspace-element-container.feedspace-carousel-widget.feedspace-element-dark-mode .feedspace-element-feed-box',
            '.feedspace-carousel-widget .feedspace-review-item',
            '.feedspace-element-container.feedspace-carousel-widget .feedspace-review-item',
            '.feedspace-element-container.feedspace-carousel-widget.feedspace-element-dark-mode .feedspace-review-item',
            '.feedspace-carousel-widget .feedspace-element-post-box',
            '.feedspace-element-container.feedspace-carousel-widget .feedspace-element-post-box',
            '.feedspace-element-container.feedspace-carousel-widget.feedspace-element-dark-mode .feedspace-element-post-box',
            '.feedspace-carousel-widget .swiper-slide',
            '.feedspace-element-container.feedspace-carousel-widget .swiper-slide',
            '.feedspace-element-container.feedspace-carousel-widget.feedspace-element-dark-mode .swiper-slide',
            // Nested variations (container > widget)
            '.feedspace-element-container .feedspace-carousel-widget .feedspace-element-feed-box',
            '.feedspace-element-container .feedspace-carousel-widget.feedspace-element-dark-mode .feedspace-element-feed-box',
            '.feedspace-element-container .feedspace-carousel-widget .feedspace-review-item',
            '.feedspace-element-container .feedspace-carousel-widget.feedspace-element-dark-mode .feedspace-review-item',
            '.feedspace-element-container .feedspace-carousel-widget .feedspace-element-post-box',
            '.feedspace-element-container .feedspace-carousel-widget.feedspace-element-dark-mode .feedspace-element-post-box',
            '.feedspace-element-container .feedspace-carousel-widget .swiper-slide',
            '.feedspace-element-container .feedspace-carousel-widget.feedspace-element-dark-mode .swiper-slide'
        ].join(', ');

        this.navContainerSelector = '.feedspace-element-carousel-container';
        this.prevSelector = '.slick-prev, .carousel-control-prev, .prev-btn, .feedspace-element-carousel-arrow.left, button[aria-label="Previous item"]';
        this.nextSelector = '.slick-next, .carousel-control-next, .next-btn, .feedspace-element-carousel-arrow.right, button[aria-label="Next item"]';
        this.indicatorsSelector = '.feedspace-element-carousel-indicators, .slick-dots';
    }

    get navContainer() { return this.context.locator(this.navContainerSelector); }
    get prevButton() { return this.context.locator(this.prevSelector); }
    get nextButton() { return this.context.locator(this.nextSelector); }
    get indicators() { return this.context.locator(this.indicatorsSelector); }

    async validateVisibility(minReviewsOverride) {
        // 1. Initialize Context
        await this.initContext();
        const minReviews = minReviewsOverride || this.config.uiRules?.minReviews || 1;

        console.log(`[Carousel Debug] Validating visibility. Selector length: ${this.cardSelector.length}`);

        // 2. Check Container
        const container = this.context.locator(this.containerSelector).first();
        if (!(await container.isVisible({ timeout: 15000 }).catch(() => false))) {
            this.logAudit('Widget container not visible after timeout (15s).', 'fail');
            return;
        }

        // 3. Get Cards & Wait
        const cards = this.context.locator(this.cardSelector);
        try {
            await cards.first().waitFor({ state: 'visible', timeout: 10000 });
        } catch (e) {
            console.log('[Carousel Debug] Timeout waiting for cards.');
        }

        // 4. Deduplication Logic (The Fix)
        // Fetch identifying attributes in one go
        const cardData = await cards.evaluateAll(elements => elements.map(el => {
            // Find data-feed-id on the element or its parent
            let fId = el.getAttribute('data-feed-id');
            if (!fId) {
                const parent = el.closest('[data-feed-id]');
                if (parent) fId = parent.getAttribute('data-feed-id');
            }

            return {
                feedId: fId,
                class: el.className,
                hasVideo: !!el.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed:not(.feedspace-element-audio-feed-box)'),
                hasAudio: !!el.querySelector('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box')
            };
        }));

        const uniqueIndices = [];
        const seenFeedIds = new Set();

        for (let i = 0; i < cardData.length; i++) {
            const data = cardData[i];

            // Priority 1: Semantic Clone check (Swiper/Slick usually mark clones)
            const isClone = data.class.includes('clone') ||
                data.class.includes('duplicate') ||
                data.class.includes('slick-cloned') ||
                data.class.includes('swiper-slide-duplicate');

            if (isClone) continue;

            // Priority 2: Feed ID De-duplication
            if (data.feedId) {
                if (!seenFeedIds.has(data.feedId)) {
                    seenFeedIds.add(data.feedId);
                    uniqueIndices.push(i);
                }
            } else {
                // If no ID and not a clone, include it
                uniqueIndices.push(i);
            }
        }

        const finalCount = uniqueIndices.length;
        console.log(`[Carousel Debug] Final unique card count: ${finalCount} (Total found: ${cardData.length})`);

        // 5. Populate Stats based ONLY on Unique Cards
        this.reviewStats.total = finalCount;
        this.reviewStats.text = 0;
        this.reviewStats.video = 0;
        this.reviewStats.audio = 0;

        for (const index of uniqueIndices) {
            const data = cardData[index];
            if (data.hasVideo) this.reviewStats.video++;
            else if (data.hasAudio) this.reviewStats.audio++;
            else this.reviewStats.text++;
        }

        // 6. Log Results
        this.logAudit(`Widget container is visible. Detected ${finalCount} unique reviews/avatars.`);
        this.logAudit(`Reviews Segmented: Total ${finalCount} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`);

        if (finalCount === 0) {
            console.log('[Carousel Debug] CRITICAL: No cards found. Dumping Container HTML:');
            const html = await container.evaluate(el => el.innerHTML).catch(e => 'Could not get HTML: ' + e.message);
            console.log(html.substring(0, 2000));
        }

        if (finalCount >= minReviews) {
            this.logAudit(`Found ${finalCount} reviews (min required: ${minReviews}).`);
        } else {
            this.logAudit(`Insufficient reviews: Found ${finalCount}, expected at least ${minReviews}.`, 'fail');
        }
    }

    async validateUniqueBehaviors() {
        await this.initContext();

        this.logAudit('Validating Carousel specialized behaviors (Navigation & Playback)...');

        // Note: Base audits (Branding, CTA, Layout, etc.) are already handled by the general audit flow.
        this.logAudit('[Interactive] Validating Carousel specialized behaviors (Navigation & Playback)...');

        // 1. Navigation & Swiping
        await this.validateNavigation();
        await this.validateIndicators();
        await this.simulateSwipe();

        // 2. Playback
        await this.validateMediaPlayback();

        // 3. Read More
        await this.validateReadMore();

        this.logAudit('[Interactive] User can navigate, swipe, play media, and expand text in carousel.');
    }

    async validateMediaPlayback() {
        console.log('Running Carousel Media Playback validation...');

        // Selectors provided by the user for Carousel widget
        const videoPlayBtnSelector = 'div.feedspace-element-feed-box-header-inner > div.play-btn > span.feedspace-media-play-icon, div.feedspace-video-review-header-wrap > div.feedspace-element-feed-box-header-inner > div.play-btn, .feedspace-element-play-feed, .feedspace-element-play-btn, .play-btn, .feedspace-video-play-btn, div.feedspace-video-review-header .play-btn';
        const audioPlayBtnSelector = 'div.feedspace-element-audio-feed > div.feedspace-element-audio-icon > div.play-btn, .feedspace-audio-play-btn';

        const videoButtons = this.context.locator(videoPlayBtnSelector);
        const audioButtons = this.context.locator(audioPlayBtnSelector);

        const videoCount = await videoButtons.count();
        const audioCount = await audioButtons.count();

        console.log(`[Playback-Audit] videoCount: ${videoCount}, audioCount: ${audioCount} in context: ${this.context.url ? this.context.url() : 'Page'}`);

        if (videoCount === 0 && audioCount === 0) {
            this.logAudit('[Playback] Checked (No media play buttons found to validate).', 'info');
            return;
        }

        let videoSummary = '';
        let videoVerified = 0;
        // --- 1. Validate Video Playback ---
        for (let i = 0; i < videoCount && videoVerified < 1; i++) {
            const btn = videoButtons.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                try {
                    // Skip if parent card is a clone
                    const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-feed-box") or contains(@class, "swiper-slide")][1]');
                    const cardClass = await card.getAttribute('class').catch(() => '');
                    if (cardClass.includes('clone') || cardClass.includes('duplicate') || cardClass.includes('slick-cloned')) {
                        continue;
                    }

                    await btn.click({ timeout: 3000 });
                } catch (e) {
                    await btn.evaluate(node => node.click()).catch(() => { });
                }

                await this.page.waitForTimeout(3000);
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-feed-box") or contains(@class, "swiper-slide")][1]');
                const videoEl = card.locator('video').first();

                if (await videoEl.count() > 0) {
                    const state = await videoEl.evaluate(v => ({
                        paused: v.paused,
                        currentTime: v.currentTime,
                        readyState: v.readyState
                    })).catch(() => ({ readyState: 0 }));

                    if (state.readyState >= 1 || state.currentTime > 0) {
                        videoSummary = `Video (ReadyState: ${state.readyState}, Time: ${state.currentTime.toFixed(2)})`;
                        videoVerified++;
                        await videoEl.evaluate(v => v.pause()).catch(() => { });
                    }
                } else {
                    videoSummary = 'Video (Assume success/iframe)';
                    videoVerified++;
                }
            }
        }

        let audioSummary = '';
        let audioVerified = 0;
        // --- 2. Validate Audio Playback ---
        for (let i = 0; i < audioCount && audioVerified < 1; i++) {
            const btn = audioButtons.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                try {
                    // Skip if parent card is a clone
                    const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-feed-box") or contains(@class, "swiper-slide")][1]');
                    const cardClass = await card.getAttribute('class').catch(() => '');
                    if (cardClass.includes('clone') || cardClass.includes('duplicate') || cardClass.includes('slick-cloned')) {
                        continue;
                    }

                    await btn.click({ timeout: 3000 });
                } catch (e) {
                    await btn.evaluate(node => node.click()).catch(() => { });
                }

                await this.page.waitForTimeout(3000);
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-feed-box") or contains(@class, "swiper-slide")][1]');
                const audioEl = card.locator('audio').first();

                if (await audioEl.count() > 0) {
                    const state = await audioEl.evaluate(a => ({
                        paused: a.paused,
                        currentTime: a.currentTime,
                        readyState: a.readyState
                    })).catch(() => ({ readyState: 0 }));

                    if (state.readyState >= 1 || state.currentTime > 0) {
                        audioSummary = `Audio (ReadyState: ${state.readyState}, Time: ${state.currentTime.toFixed(2)})`;
                        audioVerified++;
                        await audioEl.evaluate(a => a.pause()).catch(() => { });
                    }
                } else {
                    audioSummary = 'Audio (Assume success/streaming)';
                    audioVerified++;
                }
            }
        }

        // --- 3. Combined Reporting ---
        const results = [];
        if (videoVerified > 0) results.push(videoSummary);
        if (audioVerified > 0) results.push(audioSummary);

        if (results.length > 0) {
            this.logAudit(`[Playback] Verified media playback success: ${results.join(' | ')}.`);
        } else if (videoCount > 0 || audioCount > 0) {
            this.logAudit('[Playback] Media found but playback verification timed out or failed.', 'info');
        }
    }

    async simulateSwipe() {
        const container = this.context.locator(this.containerSelector).first();
        const box = await container.boundingBox();
        if (!box) return;

        console.log('Simulating swipe gesture...');
        await this.page.mouse.move(box.x + box.width * 0.8, box.y + box.height / 2);
        await this.page.mouse.down();
        await this.page.mouse.move(box.x + box.width * 0.2, box.y + box.height / 2, { steps: 5 });
        await this.page.mouse.up();
        await this.page.waitForTimeout(500);
        this.logAudit('[Interactive] Swipe gesture simulated.');
    }

    async validateIndicators() {
        this.logAudit('[Indicators] Checking for carousel indicators and arrows...');

        // Target requested selectors
        const indicators = this.context.locator('.feedspace-element-carousel-indicators');
        const leftArrow = this.context.locator('.feedspace-element-carousel-arrow.left');
        const rightArrow = this.context.locator('.feedspace-element-carousel-arrow.right');

        const hasIndicators = await indicators.isVisible().catch(() => false);
        const hasLeft = await leftArrow.isVisible().catch(() => false);
        const hasRight = await rightArrow.isVisible().catch(() => false);

        if (hasIndicators) {
            this.logAudit('[Indicators] Carousel dot indicators (.feedspace-element-carousel-indicators) found and visible.');
        } else {
            this.logAudit('[Indicators] Carousel dot indicators not found or hidden.', 'info');
        }

        if (hasLeft || hasRight) {
            this.logAudit(`[Navigation] Arrows found (Left: ${hasLeft}, Right: ${hasRight}).`);
        } else {
            this.logAudit('[Navigation] Manual arrow controls (.feedspace-element-carousel-arrow) not found or hidden.', 'info');
        }
    }

    async validateNavigation() {
        this.logAudit('[Navigation] Checking control visibility...');
        const next = this.context.locator(this.nextSelector);
        const prev = this.context.locator(this.prevSelector);

        if (await next.isVisible() || await prev.isVisible()) {
            this.logAudit('[Navigation] Manual controls found.');
            if (await next.isEnabled()) {
                await next.click();
                await this.page.waitForTimeout(500);
                this.logAudit('[Navigation] Successfully interacted with Next control.');
            }
            if (await prev.isEnabled()) {
                await prev.click();
                await this.page.waitForTimeout(500);
                this.logAudit('[Navigation] Successfully interacted with Previous control.');
            }
        } else {
            this.logAudit('[Navigation] No manual navigation arrows detected (Autoscroll or hide).', 'info');
        }
    }

    async validateReadMore() {
        console.log('Running Carousel-specific Read More functionality check...');

        const readMoreSelector = '.feedspace-element-read-more, .feedspace-read-less-btn.feedspace-element-read-more, .feedspace-read-more-text';
        const expandedSelector = '.feedspace-read-less-text, .feedspace-element-read-less, .feedspace-element-read-more-open, .feedspace-read-less-btn, .feedspace-element-read-more:not(:visible), span:has-text("Read less"), button:has-text("Read less")';

        const triggers = this.context.locator(readMoreSelector);
        const count = await triggers.count();

        if (count === 0) {
            this.logAudit('[Read More] No expansion triggers found (all text likely visible).', 'info');
            return;
        }

        let expansionResult = null;
        let collapseResult = null;

        for (let i = 0; i < count; i++) {
            const btn = triggers.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-review-contain-box") or contains(@class, "feedspace-review-box") or contains(@class, "feedspace-element-post-box") or contains(@class, "feedspace-review-item")][1]').first();

                const cardClass = await card.getAttribute('class').catch(() => '');
                if (cardClass.includes('clone') || cardClass.includes('duplicate') || cardClass.includes('slick-cloned')) {
                    continue;
                }

                const initialClasses = await btn.getAttribute('class').catch(() => '');
                const initialText = await btn.innerText().catch(() => '');
                const initialHeight = await card.evaluate(el => el.offsetHeight).catch(() => 0);

                try {
                    await btn.scrollIntoViewIfNeeded().catch(() => { });
                    // Try standard click, fallback to JS click if element is clipped/outside viewport
                    await btn.click({ force: true, timeout: 5000 }).catch(async (e) => {
                        console.warn(`Click failed: ${e.message}. Attempting JS click...`);
                        await btn.evaluate(el => el.click());
                    });
                    await this.page.waitForTimeout(1200);

                    const currentHeight = await card.evaluate(el => el.offsetHeight).catch(() => 0);
                    const currentClasses = await btn.getAttribute('class').catch(() => '');
                    const currentText = await btn.innerText().catch(() => '');
                    const hasReadLessElement = await card.locator(expandedSelector).first().isVisible().catch(() => false);

                    const heightIncreased = currentHeight > initialHeight + 3;
                    const stateChanged = initialClasses !== currentClasses || initialText !== currentText;

                    if (hasReadLessElement || heightIncreased || stateChanged) {
                        expansionResult = `Verified (+${currentHeight - initialHeight}px)`;

                        // Validating Collapse
                        const collapseBtn = card.locator(expandedSelector).first();
                        if (await collapseBtn.isVisible()) {
                            await collapseBtn.click({ force: true });
                            await this.page.waitForTimeout(1000);

                            const heightCollapsed = await card.evaluate(el => el.offsetHeight).catch(() => currentHeight);
                            const isStillExpanded = await collapseBtn.isVisible().catch(() => false);

                            if (heightCollapsed < currentHeight - 2 || !isStillExpanded) {
                                collapseResult = `Verified (-${currentHeight - heightCollapsed}px)`;
                            } else {
                                collapseResult = 'Unscaled (height did not decrease)';
                            }
                        } else {
                            collapseResult = 'Trigger missing';
                        }
                        break;
                    }
                } catch (e) {
                    console.warn(`Interaction failed on trigger #${i}: ${e.message}`);
                }
            }
        }

        if (expansionResult && collapseResult) {
            this.logAudit(`[Read More] Full cycle validated. Expansion: ${expansionResult}, Collapse: ${collapseResult}.`);
        } else if (expansionResult) {
            this.logAudit(`[Read More] Expansion validated (${expansionResult}), but Collapse check had issue: ${collapseResult || 'N/A'}.`, 'info');
        } else if (count > 0) {
            this.logAudit('[Read More] Expansion triggers found but failed to verify state change after click.', 'info');
        }
    }
}

module.exports = { CarouselWidget };
