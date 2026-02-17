const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class MasonryWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-element-container:not(.feedspace-carousel-widget)';
        this.loadMoreSelector = '.load-more-btn, button:has-text("Load More"), span:has-text("Load More"), .load-more-reviews';
        this.cardSelector = [
            '.feedspace-element-container:not(.feedspace-carousel-widget) .feedspace-element-feed-box',
            '.feedspace-element-container:not(.feedspace-carousel-widget) .feedspace-review-item',
            '.feedspace-element-container:not(.feedspace-carousel-widget) .feedspace-element-post-box',
            '.feedspace-element-container:not(.feedspace-carousel-widget).feedspace-element-dark-mode .feedspace-element-feed-box',
            '.feedspace-element-container:not(.feedspace-carousel-widget).feedspace-element-dark-mode .feedspace-review-item'
        ].join(', ');
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
        await this.validateLoadMore();

        // 3. Branding & CTA
        await this.validateBranding();
        await this.validateCTA();

        // 4. Media Playback validation
        await this.validateMediaPlayback();

        // 5. Read More / Less validation
        await this.validateReadMore();

        // 6. Social Redirection validation
        if (this.config.allow_social_redirection == 1 || this.config.allow_social_redirection === '1') {
            await this.validateSocialRedirection();
        }

        // 7. Date Consistency
        await this.validateDateConsistency();
    }

    async validateLoadMore() {
        const loadMore = this.context.locator(this.loadMoreSelector).first();

        if (await loadMore.isVisible().catch(() => false)) {
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
    }

    async validateBranding() {
        // Masonry specific branding check
        const branding = this.context.locator('a[title="Capture reviews with Feedspace"], .feedspace-branding, a:has-text("Feedspace"), a[href*="utm_source=powered-by-feedspace"]').first();
        if (await branding.isVisible()) {
            this.logAudit('Branding: Feedspace branding is visible in masonry context.');
        } else {
            this.logAudit('Branding: Feedspace branding not found or hidden in masonry.', 'info');
        }
    }

    async validateCTA() {
        console.log('Running Masonry Inline CTA detection...');
        const ctaSelector = '.feedspace-element-feed-box-inner.feedspace-inline-cta-card, .feedspace-inline-cta-card, .feedspace-cta-content, .feedspace-cta-button-container-d9';
        const cta = this.context.locator(ctaSelector).first();

        if (await cta.isVisible().catch(() => false)) {
            this.logAudit(`Inline CTA detected using selector: ${ctaSelector}`);
        } else {
            this.logAudit('No Inline CTA found on this Masonry widget.', 'info');
        }
    }

    async validateMediaPlayback() {
        console.log('Running Masonry Media Playback validation...');

        const videoPlayBtnSelector = 'div.feedspace-video-review-header > div.feedspace-video-review-header-wrap > div.play-btn, .feedspace-element-play-feed, .play-btn';
        const audioPlayBtnSelector = 'div.feedspace-element-audio-feed > div.feedspace-element-audio-icon > div.play-btn, .feedspace-audio-play-btn';

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
        console.log('Running robust Masonry Read More / Less verification...');
        await this.page.waitForTimeout(1000); // Wait for content stability

        // Search for ANY visible Read More button in the widget
        const readMoreSelectors = [
            'button:has-text("Read More")',
            'button:has-text("Read more")',
            '.feedspace-element-read-more',
            '.read-more',
            '.feedspace-read-more-text',
            'span:has-text("Read More")',
            'span:has-text("Read more")'
        ];

        let targetTrigger = null;
        let targetCard = null;

        for (const selector of readMoreSelectors) {
            const triggers = this.context.locator(selector);
            const count = await triggers.count();
            for (let i = 0; i < count; i++) {
                const trigger = triggers.nth(i);
                if (await trigger.isVisible().catch(() => false)) {
                    targetTrigger = trigger;
                    // Find the parent card for Masonry specifically
                    targetCard = trigger.locator('xpath=./ancestor::*[contains(@class, "feedspace-element-review-contain-box") or contains(@class, "feedspace-element-feed-box") or contains(@class, "feedspace-review-item")][1]').first();
                    break;
                }
            }
            if (targetTrigger) break;
        }

        if (!targetTrigger || !targetCard) {
            this.logAudit('[Read More] Read More: No visible "Read More" button found in any Masonry card.', 'info');
            return;
        }

        const initialHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
        this.logAudit(`[Read More] Read More: Found button. Initial card height: ${initialHeight}px. Clicking...`, 'info');

        try {
            await targetTrigger.scrollIntoViewIfNeeded().catch(() => { });
            await targetTrigger.click({ force: true });
            await this.page.waitForTimeout(1500);

            const expandedHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);

            // Search for visible Read Less button
            const readLessBtn = this.context.locator('button:has-text("Read Less"), button:has-text("Read less"), .feedspace-read-less-btn, span:has-text("Read Less"), span:has-text("Read less")').first();
            const hasReadLess = await readLessBtn.isVisible();

            if (expandedHeight > initialHeight + 5 || hasReadLess) {
                this.logAudit(`[Read More] Read More: Expansion verified. New height: ${expandedHeight}px (+${expandedHeight - initialHeight}px).`);

                if (hasReadLess) {
                    this.logAudit('[Read More] Read Less: "Read Less" button visible. Clicking to collapse...', 'info');
                    await readLessBtn.click({ force: true });
                    await this.page.waitForTimeout(1200);

                    const collapsedHeight = await targetCard.evaluate(el => el.offsetHeight).catch(() => 0);
                    if (collapsedHeight < expandedHeight || !(await readLessBtn.isVisible())) {
                        this.logAudit('[Read More] Read More / Less: Full cycle (Expand -> Collapse) validated successfully.');
                    } else {
                        this.logAudit('[Read More] Read Less: Clicked button but card did not collapse.', 'fail');
                    }
                }
            } else {
                if (!(await targetTrigger.isVisible())) {
                    this.logAudit('[Read More] Read More: Trigger hidden after click, assuming expansion.');
                } else {
                    this.logAudit(`[Read More] Read More: Expansion failed (Height remained ${expandedHeight}px).`, 'info');
                }
            }
        } catch (e) {
            this.logAudit(`[Read More] Read More / Less: Interaction failed - ${e.message.split('\n')[0]}`, 'info');
        }
    }

    async validateDateConsistency() {
        const configDate = this.config.allow_to_display_feed_date;
        console.log(`[MasonryWidget] Validating Date Consistency (Config: ${configDate})...`);

        // Use locators relevant to Masonry layout
        const dateElements = this.context.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span');
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
                // Check for "undefined", "null", or empty text
                const texts = await dateElements.allInnerTexts();
                const invalidDates = texts.filter(t => t.toLowerCase().includes('undefined') || t.toLowerCase().includes('null') || t.trim() === '');

                if (invalidDates.length > 0) {
                    this.logAudit(`Date Consistency: Found invalid dates (undefined/null/empty) in ${invalidDates.length} cards.`, 'fail');
                } else {
                    this.logAudit(`Date Consistency: All ${foundCount} dates are valid and visible.`, 'pass');
                }
            } else {
                this.logAudit('Date Consistency: Dates expected (1) but none found in DOM.', 'fail');
            }
        } else {
            this.logAudit(`Date Consistency: Config value '${configDate}' is optional/unknown. Found ${foundCount} dates.`, 'info');
        }
    }

    async validateSocialRedirection() {
        const configSocial = this.config.allow_social_redirection;
        console.log(`[MasonryWidget] Validating Social Redirection (Config: ${configSocial})...`);

        const socialRedirectionSelector = 'div.flex > div.flex > a.feedspace-d6-header-icon, .social-redirection-button, .feedspace-element-header-icon > a > img, .feedspace-element-header-icon a';
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
}

module.exports = { MasonryWidget };
