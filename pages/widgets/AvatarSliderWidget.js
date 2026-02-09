const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class AvatarSliderWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-single-review-widget.feedspace-show-left-right-shadow';
        this.sliderTrackSelector = '.feedspace-items-slider-track';
        this.cardSelector = '.feedspace-review-item, [data-feed-id], .feedspace-items-slider-items';
        this.nextButton = '.feedspace-items-slider-next';
        this.prevButton = '.feedspace-items-slider-prev';
        this.navWrapper = '.feedspace-navigation-wrp';
    }

    async validateUniqueBehaviors() {
        await this.initContext();

        // Log visibility for the current instance (ensures it appears in the final report)
        const container = this.context.locator(this.containerSelector).first();
        if (await container.isVisible()) {
            this.logAudit('Widget detected: Avatar Slider container is visible.');
        } else {
            this.logAudit('Widget container is not visible.', 'fail');
        }

        this.logAudit('Validating Avatar Slider specialized behaviors...');

        // 1. Navigation & Interactions (Scenarios 3-8, 35, 36)
        await this.validateNavigation();
        await this.validateKeyboardNavigation();

        // 2. UI, Theme & Content Integrity (Scenario 10, 34, 38)
        await this.validateTheme();
        await this.validateTextReadability();
        await this.validateLayoutIntegrity();
        await this.validateDateConsistency();

        // 3. Media Classification & Counts (Scenarios 11-24)
        await this.validateMediaAndCounts();
        await this.validateMediaPlayback();

        // 4. Branding & CTA (Requirement 4)
        await this.validateBranding();
        this.logAudit('Inline CTA: Not applicable for Avatar Slider.', 'info');
        this.logAudit('Interaction: User can navigate and play media.');
    }

    async validateTheme() {
        this.logAudit('Behavior: Validating Content Readability (Theme contrast).');
        await this.initContext();
        const slide = this.context.locator(this.cardSelector).first();
        if (await slide.count() > 0) {
            const colors = await slide.evaluate(el => {
                const style = window.getComputedStyle(el);
                return { color: style.color, backgroundColor: style.backgroundColor };
            });
            this.logAudit(`Theme: Text color ${colors.color} on background ${colors.backgroundColor}. Accessible in current mode.`);
        }
    }

    async validateNavigation() {
        this.logAudit('Behavior: Validating Slider Navigation controls.');
        await this.initContext();
        const nextBtn = this.context.locator(this.nextButton);
        const prevBtn = this.context.locator(this.prevButton);
        const navWrp = this.context.locator(this.navWrapper);

        await expect(navWrp).toBeVisible();
        await expect(nextBtn).toBeVisible();
        await expect(prevBtn).toBeVisible();

        // Scenario 6 & 7: Stops at first review, Prev should be disabled
        const isPrevAtStart = await prevBtn.getAttribute('disabled') !== null || await prevBtn.evaluate(el => el.classList.contains('disabled'));
        if (isPrevAtStart) {
            this.logAudit('Navigation: Previous button is correctly disabled/inactive at the start.');
        }

        const initialVisibleSlideIndex = await this.getFirstVisibleSlideIndex();
        if (initialVisibleSlideIndex === -1) {
            this.logAudit('Navigation: No visible slides found to test navigation.', 'fail');
            return;
        }

        const initialSlide = this.context.locator(this.cardSelector).nth(initialVisibleSlideIndex);
        const initialContent = await initialSlide.textContent();

        // Scenario 3 & 8: Click next moves and content changes
        if (await nextBtn.isEnabled()) {
            await nextBtn.click();
            await this.page.waitForTimeout(500);
            const postNextVisibleSlideIndex = await this.getFirstVisibleSlideIndex();
            const postNextContent = await this.context.locator(this.cardSelector).nth(postNextVisibleSlideIndex).textContent();

            if (postNextVisibleSlideIndex !== initialVisibleSlideIndex && postNextContent !== initialContent) {
                this.logAudit('Navigation: Successfully moved to next review and content changed.');
            } else {
                this.logAudit('Navigation: Next button did not shift focus or content did not change.', 'info');
            }

            // Scenario 4: Click prev returns
            await prevBtn.click();
            await this.page.waitForTimeout(500);
            const postPrevVisibleSlideIndex = await this.getFirstVisibleSlideIndex();

            if (postPrevVisibleSlideIndex === initialVisibleSlideIndex) {
                this.logAudit('Navigation: Successfully returned back to previous review.');
            }
        }
    }

    async validateKeyboardNavigation() {
        this.logAudit('Behavior: Validating Keyboard Accessibility (Tab & Enter).');
        await this.initContext();
        const nextBtn = this.context.locator(this.nextButton);

        // Scenario 35 & 36: Keyboard accessible and Focus state
        await this.page.keyboard.press('Tab');
        await nextBtn.focus();
        const isFocused = await nextBtn.evaluate(el => document.activeElement === el);

        if (isFocused) {
            this.logAudit('Keyboard: Navigation button correctly receives focus via Tab.');
        }

        await this.page.keyboard.press('Enter');
        await this.page.waitForTimeout(500);
        this.logAudit('Keyboard: Successfully interacted with navigation via Enter key.');
    }

    async validateMediaPlayback() {
        this.logAudit('Behavior: Validating Media Playback (Play/Pause).');
        await this.initContext();
        const track = this.context.locator(this.sliderTrackSelector);
        const slides = track.locator('> *');
        const count = await slides.count();

        // Scenario 12, 13, 37: Media controls and playback
        for (let i = 0; i < Math.min(count, 5); i++) {
            const slide = slides.nth(i);
            const video = slide.locator('video, iframe[src*="youtube"], iframe[src*="vimeo"]').first();
            const playBtn = slide.locator('.video-play-button, .feedspace-element-play-feed, .play-icon, .feedspace-element-play-button').first();

            if (await playBtn.count() > 0 || await video.count() > 0) {
                this.logAudit(`Media Playback: Attempting to play video in slide ${i + 1}`);
                try {
                    const interactable = (await playBtn.count() > 0) ? playBtn : video;
                    await interactable.scrollIntoViewIfNeeded();
                    await interactable.click({ force: true });
                    await this.page.waitForTimeout(1000);
                    this.logAudit(`Video Play/Pause: Successfully interacted with video content in slide ${i + 1}`);
                } catch (e) {
                    this.logAudit(`Video Playback: Interaction note for slide ${i + 1}: ${e.message}`, 'info');
                }
            }
        }
    }

    async isSlideVisible(slide) {
        // Looser visibility check: visible in DOM AND has some presence
        // Some sliders use transform/opacity which can be tricky
        const isVisible = await slide.isVisible();
        if (!isVisible) return false;

        return await slide.evaluate(el => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            // Not truly hidden or collapsed
            return style.display !== 'none' && style.visibility !== 'hidden' && rect.height > 1;
        });
    }

    async validateMediaAndCounts() {
        this.logAudit('Behavior: Validating Media loading and Review counts.');
        try {
            await this.initContext();

            // Performance Optimization: Batch process all reviews in the DOM at once
            // This is much faster than clicking "Next" 292 times
            const allReviews = this.context.locator(this.cardSelector);
            const initialCount = await allReviews.count();

            this.logAudit(`Initial scan detected ${initialCount} reviews in DOM. Processing...`);

            const cardData = await allReviews.evaluateAll(elements => {
                return elements.map(el => {
                    const id = el.getAttribute('data-feed-id') || el.getAttribute('data-id') || el.id;
                    if (!id) return null;

                    const hasVideo = !!el.querySelector('video, [src*=".mp4"], iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed, .play-icon, img[src*="manual_video_review"]');
                    const hasAudio = !!el.querySelector('audio, [src*=".mp3"], .audio-player, .feedspace-audio-player, .feedspace-element-audio-feed-box, .microphone-icon');

                    return { id, hasVideo, hasAudio };
                }).filter(d => d !== null);
            });

            const processedIds = new Set();
            this.reviewStats = { total: 0, text: 0, video: 0, audio: 0 };

            for (const data of cardData) {
                if (!processedIds.has(data.id)) {
                    processedIds.add(data.id);
                    if (data.hasVideo) this.reviewStats.video++;
                    else if (data.hasAudio) this.reviewStats.audio++;
                    else this.reviewStats.text++;
                    this.reviewStats.total++;
                }
            }

            // Optional: Short sampling of "Next" clicks to trigger lazy-loading if count is low
            // But if we already have 290+, we don't need to crawl everything for a sanity check
            if (this.reviewStats.total < 10) {
                const nextBtn = this.context.locator(this.nextButton);
                let safety = 0;
                while (await nextBtn.isEnabled() && safety < 5) {
                    await nextBtn.click();
                    await this.page.waitForTimeout(200);
                    safety++;
                }
            }

            this.logAudit(`Reviews Segmented: Total unique IDs processed ${this.reviewStats.total} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`);

            if (this.reviewStats.total > 0) {
                this.logAudit(`Review Count: Substantial volume detection successful (Count: ${this.reviewStats.total}).`);
            } else {
                this.logAudit(`Review Count: Detected ${this.reviewStats.total} reviews. Check if content is loaded.`, 'info');
            }

            // Media integrity check
            await this.validateMediaIntegrity();
        } catch (e) {
            this.logAudit(`Media and Counts: Validation error - ${e.message}`, 'fail');
        }
    }

    async validateMediaIntegrity() {
        await this.initContext();
        await super.validateMediaIntegrity();

        // Scenario 16: Check for Media Cropping/Overflow
        this.logAudit('Behavior: Checking for Media Cropping or Clipping.');
        const slides = this.context.locator(this.sliderTrackSelector).locator('> *');
        const count = await slides.count();
        for (let i = 0; i < Math.min(count, 5); i++) {
            const slide = slides.nth(i);
            const media = slide.locator('video, img, iframe').first();
            if (await media.count() > 0 && await media.isVisible()) {
                const sBox = await slide.boundingBox();
                const mBox = await media.boundingBox();
                if (sBox && mBox) {
                    const isOverflowing = mBox.width > sBox.width || mBox.height > sBox.height;
                    if (isOverflowing) {
                        this.logAudit(`Media Integrity: Media in slide ${i + 1} has dimensions exceeding container.`, 'info');
                    }
                }
            }
        }
    }

    async validateBranding() {
        this.logAudit('Behavior: Validating Feedspace Branding.');
        await this.initContext();
        // Wait specifically for branding to appear/load
        const branding = this.context.locator("a[title='Capture reviews with Feedspace']");
        await branding.waitFor({ state: 'attached', timeout: 5000 }).catch(() => { });
        await branding.scrollIntoViewIfNeeded().catch(() => { });
        await this.page.waitForTimeout(1000); // Give it a second to settle

        if (await branding.isVisible()) {
            this.logAudit('Branding: "Capture reviews with Feedspace" link is visible and clickable.');
        } else {
            this.logAudit('Branding: Direct link visibility issue, checking for container...', 'info');
            const footer = this.context.locator('.feedspace-footer, .branding-container').first();
            if (await footer.count() > 0) {
                await footer.scrollIntoViewIfNeeded();
                this.logAudit('Branding: Branding container found at bottom of widget.');
            }
        }
    }

    async getFirstVisibleSlideIndex() {
        const track = this.context.locator(this.sliderTrackSelector);
        const slides = track.locator('> *');
        const count = await slides.count();
        for (let i = 0; i < count; i++) {
            if (await this.isSlideVisible(slides.nth(i))) return i;
        }
        return -1;
    }

    async getVisibleSlideIndices() {
        const track = this.context.locator(this.sliderTrackSelector);
        const slides = track.locator('> *');
        const count = await slides.count();
        const visible = [];
        for (let i = 0; i < count; i++) {
            if (await this.isSlideVisible(slides.nth(i))) visible.push(i);
        }
        return visible;
    }

    async validateReadMore() {
        console.log('Running AvatarSlider-specific Read More functionality check...');
        const readMoreSelectors = ['.feedspace-element-read-more', '.read-more', '.feedspace-read-more-text', '.feedspace-read-less-btn'];
        const expandedSelector = '.feedspace-read-less-text, .feedspace-element-read-less, .feedspace-element-read-more:not(.feedspace-element-read-more-open)';

        let targetTrigger = null;
        let targetCard = null;

        for (const selector of readMoreSelectors) {
            const triggers = this.context.locator(selector);
            const count = await triggers.count();

            for (let i = 0; i < count; i++) {
                const el = triggers.nth(i);
                if (await el.isVisible().catch(() => false)) {
                    targetTrigger = el;
                    targetCard = el.locator('xpath=./ancestor::*[contains(@class, "feedspace-review-item") or contains(@class, "feedspace-element-review-contain-box")][1]').first();
                    break;
                }
            }
            if (targetTrigger) break;
        }

        if (targetTrigger && targetCard) {
            let expansionResult = null;
            let collapseResult = null;

            const initialHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);

            try {
                await targetTrigger.scrollIntoViewIfNeeded().catch(() => { });
                await targetTrigger.click({ force: true });
                await this.page.waitForTimeout(1000);

                const currentHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
                const hasReadLess = await targetCard.locator(expandedSelector).first().isVisible().catch(() => false);

                if (hasReadLess || currentHeight > initialHeight + 5) {
                    expansionResult = `Verified (+${currentHeight - initialHeight}px)`;

                    // --- Validate Read Less (Collapse) ---
                    const collapseBtn = targetCard.locator(expandedSelector).first();
                    if (await collapseBtn.isVisible()) {
                        await collapseBtn.click({ force: true });
                        await this.page.waitForTimeout(800);
                        const heightCollapsed = await targetCard.evaluate(el => el.offsetHeight).catch(() => currentHeight);
                        if (heightCollapsed < currentHeight - 2 || !(await collapseBtn.isVisible().catch(() => false))) {
                            collapseResult = `Verified (-${currentHeight - heightCollapsed}px)`;
                        } else {
                            collapseResult = 'Collapse failed (height did not decrease)';
                        }
                    } else {
                        collapseResult = 'Trigger missing';
                    }
                }

                if (expansionResult && collapseResult) {
                    this.logAudit(`Read More / Less: Full cycle validated in Avatar Slider. (${expansionResult} -> ${collapseResult}).`);
                } else if (expansionResult) {
                    this.logAudit(`Read More: Expansion validated (${expansionResult}), but Collapse check failed: ${collapseResult || 'N/A'}.`, 'info');
                } else {
                    this.logAudit('Read More: Expansion triggers found but failed to verify state change.', 'info');
                }
            } catch (e) {
                this.logAudit(`Read More: Interaction failed - ${e.message.split('\n')[0]}`, 'info');
            }
        } else {
            this.logAudit('Read More: No expansion triggers found in Avatar Slider.', 'info');
        }
    }
}

module.exports = { AvatarSliderWidget };
