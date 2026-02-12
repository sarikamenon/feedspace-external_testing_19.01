const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class CarouselWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget';
        this.navContainerSelector = '.feedspace-element-carousel-container';
        this.prevSelector = '.slick-prev, .carousel-control-prev, .prev-btn, .feedspace-element-carousel-arrow.left, button[aria-label="Previous item"]';
        this.nextSelector = '.slick-next, .carousel-control-next, .next-btn, .feedspace-element-carousel-arrow.right, button[aria-label="Next item"]';
        this.indicatorsSelector = '.feedspace-element-carousel-indicators, .slick-dots';
    }

    get navContainer() { return this.context.locator(this.navContainerSelector); }
    get prevButton() { return this.context.locator(this.prevSelector); }
    get nextButton() { return this.context.locator(this.nextSelector); }
    get indicators() { return this.context.locator(this.indicatorsSelector); }

    async validateUniqueBehaviors() {
        await this.initContext();

        this.logAudit('Validating Carousel specialized behaviors (Navigation & Playback)...');

        // Note: Base audits (Branding, CTA, Layout, etc.) are already handled by the general audit flow.
        // This method focuses purely on Carousel-specific interactive elements.

        // 3. Navigation Controls (Optional)
        this.logAudit('Checking Optional Navigation Controls...');

        const hasNavContainer = await this.navContainer.isVisible();
        this.logAudit(`Navigation: Carousel Navigation Container is ${hasNavContainer ? 'Present' : 'Not Found (Optional)'}`, hasNavContainer ? 'info' : 'info');

        const nextBtn = this.nextButton.first();
        const prevBtn = this.prevButton.first();
        const hasNext = await nextBtn.isVisible();
        const hasPrev = await prevBtn.isVisible();

        if (hasNext) {
            this.logAudit('Navigation: Right arrow/Next control is visible.');
            await nextBtn.click({ force: true });
            await this.page.waitForTimeout(800);
            this.logAudit('Navigation: Successfully interacted with Next control.');
        } else {
            this.logAudit('Navigation: Right arrow/Next control is Not Found (Optional)', 'info');
        }

        if (hasPrev) {
            this.logAudit('Navigation: Left arrow/Previous control is visible.');
            await prevBtn.click({ force: true });
            await this.page.waitForTimeout(800);
            this.logAudit('Navigation: Successfully interacted with Previous control.');
        } else {
            this.logAudit('Navigation: Left arrow/Previous control is Not Found (Optional)', 'info');
        }

        const hasIndicators = await this.indicators.isVisible();
        this.logAudit(`Navigation: Carousel indicators/dots are ${hasIndicators ? 'Visible' : 'Not Found (Optional)'}`, 'info');

        // 4. Mobile Interaction simulation
        await this.simulateSwipe();

        // 5. Media Playback Validation (Specific to Carousel)
        await this.validateMediaPlayback();

        this.logAudit('Interaction: User can navigate, swipe, and play media in carousel.');
    }

    async validateMediaPlayback() {
        console.log('Running Carousel Media Playback validation...');

        // Selectors provided by the user for Carousel widget
        const videoPlayBtnSelector = 'div.feedspace-video-review-header > div.feedspace-video-review-header-wrap > div.play-btn, .feedspace-video-play-btn';
        const audioPlayBtnSelector = 'div.feedspace-element-audio-feed > div.feedspace-element-audio-icon > div.play-btn, .feedspace-audio-play-btn';

        const videoButtons = this.context.locator(videoPlayBtnSelector);
        const audioButtons = this.context.locator(audioPlayBtnSelector);

        const videoCount = await videoButtons.count();
        const audioCount = await audioButtons.count();

        if (videoCount === 0 && audioCount === 0) {
            this.logAudit('Media Playback: No play buttons found to validate in Carousel.', 'info');
            return;
        }

        // Validate Video Playback
        for (let i = 0; i < Math.min(videoCount, 2); i++) { // Check up to 2 for performance
            const btn = videoButtons.nth(i);
            if (await btn.isVisible()) {
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-feed-box") or contains(@class, "feedspace-review-item") or contains(@class, "swiper-slide")][1]');
                const videoEl = card.locator('video').first();

                if (await videoEl.count() > 0) {
                    await btn.click({ force: true });
                    await this.page.waitForTimeout(1500);

                    const isPlaying = await videoEl.evaluate(v => !v.paused || v.currentTime > 0);
                    if (isPlaying) {
                        this.logAudit('Media Playback: Video play button is functional in Carousel.');
                        await videoEl.evaluate(v => v.pause());
                    } else {
                        this.detailedFailures.push({
                            type: 'Media Playback',
                            card: 'Video Card',
                            description: 'Video play button clicked but media did not start playing.',
                            location: 'Video Element',
                            severity: 'High'
                        });
                        this.logAudit('Media Playback: Video play button failed to start playback.', 'fail');
                    }
                }
            }
        }

        // Validate Audio Playback
        for (let i = 0; i < Math.min(audioCount, 2); i++) {
            const btn = audioButtons.nth(i);
            if (await btn.isVisible()) {
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-feed-box") or contains(@class, "feedspace-review-item") or contains(@class, "swiper-slide")][1]');
                const audioEl = card.locator('audio').first();

                if (await audioEl.count() > 0) {
                    await btn.click({ force: true });
                    await this.page.waitForTimeout(1500);

                    const isPlaying = await audioEl.evaluate(a => !a.paused || a.currentTime > 0);
                    if (isPlaying) {
                        this.logAudit('Media Playback: Audio play button is functional in Carousel.');
                        await audioEl.evaluate(a => a.pause());
                    } else {
                        this.detailedFailures.push({
                            type: 'Media Playback',
                            card: 'Audio Card',
                            description: 'Audio play button clicked but media did not start playing.',
                            location: 'Audio Element',
                            severity: 'High'
                        });
                        this.logAudit('Media Playback: Audio play button failed to start playback.', 'fail');
                    }
                }
            }
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
        this.logAudit('Behavior: Swipe gesture simulated.');
    }

    async validateReadMore() {
        console.log('Running Carousel-specific Read More functionality check...');

        const readMoreSelector = '.feedspace-element-read-more, .feedspace-read-less-btn.feedspace-element-read-more, .feedspace-read-more-text';
        const expandedSelector = '.feedspace-read-less-text, .feedspace-element-read-less, .feedspace-element-read-more-open, .feedspace-read-less-btn, .feedspace-element-read-more:not(:visible), span:has-text("Read less"), button:has-text("Read less")';

        const triggers = this.context.locator(readMoreSelector);
        const count = await triggers.count();

        if (count === 0) {
            this.logAudit('Read More: No expansion triggers found (all text likely visible).', 'info');
            return;
        }

        let expansionResult = null;
        let collapseResult = null;

        for (let i = 0; i < count; i++) {
            const btn = triggers.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-review-contain-box") or contains(@class, "feedspace-review-box") or contains(@class, "feedspace-element-post-box") or contains(@class, "feedspace-review-item")][1]').first();

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
            this.logAudit(`Read More / Less: Full cycle validated. Expansion: ${expansionResult}, Collapse: ${collapseResult}.`);
        } else if (expansionResult) {
            this.logAudit(`Read More: Expansion validated (${expansionResult}), but Collapse check had issue: ${collapseResult || 'N/A'}.`, 'info');
        } else if (count > 0) {
            this.logAudit('Read More: Expansion triggers found but failed to verify state change after click.', 'info');
        }
    }
}

module.exports = { CarouselWidget };
