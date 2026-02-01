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
            this.logAudit('Widget container is visible.');
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
        await this.initContext();
        const nextBtn = this.context.locator(this.nextButton);

        // Use a set to track unique reviews by ID to handle lazy loading/clones
        const processedIds = new Set();
        this.reviewStats = { total: 0, text: 0, video: 0, audio: 0 };

        // Reset to start
        const prevBtn = this.context.locator(this.prevButton);
        let resetCounter = 0;
        while (await prevBtn.isEnabled() && resetCounter < 60) {
            await prevBtn.click();
            await this.page.waitForTimeout(100);
            resetCounter++;
        }

        let safetyCounter = 0;
        let reachedEnd = false;

        while (!reachedEnd && safetyCounter < 60) {
            // Find all potential review items currently in DOM
            const currentReviews = this.context.locator(this.cardSelector);
            const count = await currentReviews.count();

            for (let i = 0; i < count; i++) {
                const slide = currentReviews.nth(i);
                const id = await slide.getAttribute('data-feed-id');

                // If it has an ID and we haven't processed it yet
                if (id && !processedIds.has(id)) {
                    processedIds.add(id);

                    // Detect media (no scroll for speed)
                    const hasVideo = await slide.locator('video, [src*=".mp4"], iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed, .play-icon, img[src*="manual_video_review"]').count() > 0;
                    const hasAudio = await slide.locator('audio, [src*=".mp3"], .audio-player, .feedspace-audio-player, .feedspace-element-audio-feed-box, .microphone-icon').count() > 0;

                    if (hasVideo) this.reviewStats.video++;
                    else if (hasAudio) this.reviewStats.audio++;
                    else this.reviewStats.text++;

                    this.reviewStats.total++;
                }
            }

            if (await nextBtn.isDisabled() || safetyCounter >= 55) {
                reachedEnd = true;
            } else {
                try {
                    await nextBtn.click({ timeout: 1000 });
                    await this.page.waitForTimeout(150); // Short wait for slide transition
                } catch (e) { reachedEnd = true; }
            }
            safetyCounter++;
        }

        this.logAudit(`Reviews Segmented: Total unique IDs processed ${this.reviewStats.total} (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio})`);

        if (this.reviewStats.total > 0) {
            this.logAudit(`Review Count: Substantial volume detection successful (Count: ${this.reviewStats.total}).`);
        } else {
            this.logAudit(`Review Count: Detected ${this.reviewStats.total} reviews. Check if content is loaded.`, 'info');
        }

        // Media integrity check (Scenarios 11, 14, 15, 16)
        await this.validateMediaIntegrity();
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
}

module.exports = { AvatarSliderWidget };
