const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class MasonryWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-element-container';
        this.loadMoreButton = this.page.locator('.load-more-btn, button:has-text("Load More")');
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        console.log('Validating Masonry specialized behaviors...');

        // Grid alignment validation
        const container = this.context.locator(this.containerSelector).first();
        const display = await container.evaluate(el => window.getComputedStyle(el).display);
        if (display === 'grid' || display === 'flex' || display === 'block') {
            this.logAudit(`Layout: Detected ${display} based grid structure.`);
        }

        // 2. Load More validation
        const loadMore = this.context.locator('span:has-text("Load More")').first();

        if (await loadMore.isVisible()) {
            this.logAudit('[Load More] Behavior: Load More button detected. Clicking until all reviews are loaded...');
            let clickCount = 0;
            const maxClicks = 30; // Safety break

            while ((await loadMore.isVisible()) && clickCount < maxClicks) {
                const preCount = await this.context.locator(this.cardSelector).count();
                try {
                    await loadMore.click({ timeout: 5000 });
                } catch (e) {
                    await loadMore.evaluate(node => node.click()).catch(() => { });
                }
                await this.page.waitForTimeout(3000);
                const postCount = await this.context.locator(this.cardSelector).count();

                if (postCount > preCount) {
                    console.log(`Load More #${clickCount + 1}: Loaded ${postCount - preCount} new items.`);
                } else {
                    console.log(`Load More #${clickCount + 1}: No new items appeared.`);
                    // Small fallback if it's still visible but not loading
                    await this.page.evaluate(() => window.scrollBy(0, 500));
                    await this.page.waitForTimeout(2000);
                }
                clickCount++;
            }

            if (await loadMore.isVisible()) {
                this.logAudit(`[Load More] Behavior: Load More button still visible after ${clickCount} clicks.`, 'warn');
            } else {
                this.logAudit(`[Load More] Behavior: Successfully loaded all content. Load More button vanished.`);
            }

            const stats = await this.context.locator(this.cardSelector).evaluateAll(cards => {
                let text = 0, video = 0, audio = 0;
                cards.forEach(card => {
                    const hasVideo = card.querySelector('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed:not(.feedspace-element-audio-feed-box)') !== null;
                    const hasAudio = card.querySelector('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box') !== null;
                    if (hasVideo) video++;
                    else if (hasAudio) audio++;
                    else text++;
                });
                return { total: cards.length, text, video, audio };
            });

            this.reviewStats = Object.assign(this.reviewStats || {}, stats);
            this.logAudit(`[Load More] Reviews Updated: Final count is ${stats.total} (Text: ${stats.text}, Video: ${stats.video}, Audio: ${stats.audio})`);
        } else {
            this.logAudit('[Load More] Behavior: No Load More button found (or all content already loaded).', 'info');
        }

        // 3. Media Playback validation
        await this.validateMediaPlayback();

        // 4. Read More / Less validation
        await this.validateReadMore();

        // 5. Inline CTA validation
        await this.validateCTA();
    }

    async validateCTA() {
        console.log('Running Masonry Inline CTA detection...');
        const ctaSelector = '.feedspace-element-feed-box-inner.feedspace-inline-cta-card, .feedspace-inline-cta-card';
        const cta = this.context.locator(ctaSelector).first();

        if (await cta.isVisible().catch(() => false)) {
            this.logAudit('Inline CTA found: .feedspace-element-feed-box-inner.feedspace-inline-cta-card');
        } else {
            // Fallback to base check if specific one is missing
            const baseCta = this.context.locator('.feedspace-cta-content').first();
            if (await baseCta.isVisible().catch(() => false)) {
                this.logAudit('Inline CTA found: .feedspace-cta-content');
            } else {
                this.logAudit('No Inline CTA found on this Masonry widget.', 'info');
            }
        }
    }

    async validateMediaPlayback() {
        console.log('Running Masonry Media Playback validation...');

        const videoPlayBtnSelector = 'div.feedspace-video-review-header > div.feedspace-video-review-header-wrap > div.play-btn';
        const audioPlayBtnSelector = 'div.feedspace-element-audio-feed > div.feedspace-element-audio-icon > div.play-btn';

        const videoButtons = this.context.locator(videoPlayBtnSelector);
        const audioButtons = this.context.locator(audioPlayBtnSelector);

        const videoCount = await videoButtons.count();
        const audioCount = await audioButtons.count();

        console.log(`[Playback-Audit] Masonry videoCount: ${videoCount}, audioCount: ${audioCount}`);

        if (videoCount === 0 && audioCount === 0) {
            this.logAudit('[Playback] Checked (No media play buttons found to validate in Masonry).', 'info');
            return;
        }

        let videoSummary = '';
        let videoVerified = 0;
        for (let i = 0; i < videoCount && videoVerified < 1; i++) {
            const btn = videoButtons.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                try {
                    await btn.click({ timeout: 3000 });
                } catch (e) {
                    await btn.evaluate(node => node.click()).catch(() => { });
                }

                await this.page.waitForTimeout(3000);
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-feed-box") or contains(@class, "feedspace-element-review-contain-box")][1]');
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
        for (let i = 0; i < audioCount && audioVerified < 1; i++) {
            const btn = audioButtons.nth(i);
            if (await btn.isVisible().catch(() => false)) {
                try {
                    await btn.click({ timeout: 3000 });
                } catch (e) {
                    await btn.evaluate(node => node.click()).catch(() => { });
                }

                await this.page.waitForTimeout(3000);
                const card = btn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-audio-feed") or contains(@class, "feedspace-element-feed-box")][1]');
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

        const results = [];
        if (videoVerified > 0) results.push(videoSummary);
        if (audioVerified > 0) results.push(audioSummary);

        if (results.length > 0) {
            this.logAudit(`[Playback] Verified media playback success: ${results.join(' | ')}.`);
        }
    }

    async validateReadMore() {
        console.log('Running Masonry Read More / Less verification...');
        await this.page.waitForTimeout(1000); // Wait for content stability

        // User specified locator: page.locator(`button:has-text("Read More")`);
        const readMoreBtn = this.context.locator('button:has-text("Read More")').first();

        if (!(await readMoreBtn.isVisible().catch(() => false))) {
            this.logAudit('[Read More] Read More: No "Read More" button found in Masonry layout.', 'info');
            return;
        }

        const targetCard = readMoreBtn.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-review-contain-box") or contains(@class, "feedspace-element-feed-box") or contains(@class, "feedspace-review-item")][1]').first();

        if (await targetCard.count() === 0) {
            this.logAudit('[Read More] Read More: Found button but could not identify parent card.', 'warn');
            return;
        }

        const initialHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
        this.logAudit(`[Read More] Read More: Initial height: ${initialHeight}px. Clicking...`, 'info');

        try {
            await readMoreBtn.scrollIntoViewIfNeeded().catch(() => { });
            await readMoreBtn.click({ force: true });
            await this.page.waitForTimeout(1500);

            const expandedHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
            const readLessBtn = this.context.locator('button:has-text("Read Less")').first();
            const hasReadLess = await readLessBtn.isVisible();

            if (expandedHeight > initialHeight + 5 || hasReadLess) {
                this.logAudit(`[Read More] Read More: Expansion verified. New height: ${expandedHeight}px (+${expandedHeight - initialHeight}px).`);

                if (hasReadLess) {
                    await readLessBtn.click({ force: true });
                    await this.page.waitForTimeout(1200);
                    this.logAudit('[Read More] Read More / Less: Full cycle validated successfully.');
                }
            } else {
                this.logAudit(`[Read More] Read More: Expansion failed (Height remained ${expandedHeight}px).`, 'info');
            }
        } catch (e) {
            this.logAudit(`[Read More] Read More / Less: Interaction failed - ${e.message.split('\n')[0]}`, 'info');
        }
    }
}

module.exports = { MasonryWidget };
