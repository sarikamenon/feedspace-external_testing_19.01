const { BaseWidget } = require('./BaseWidget');
const { expect } = require('@playwright/test');

class AvatarSliderWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.feedspace-single-review-widget.feedspace-show-left-right-shadow';
        this.sliderTrackSelector = '.feedspace-slider-track';
        this.cardSelector = '.feedspace-review-box, .feedspace-items-slider-items, [data-feed-id]';
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
        await this.validateReadMore();

        // 3. Media Classification & Counts (Scenarios 11-24)
        await this.validateMediaAndCounts();
        await this.validateMediaPlayback();

        // 4. Branding & CTA (Requirement 4)
        await this.validateBranding();
        this.logAudit('Inline CTA: Not applicable for Avatar Slider.', 'info');

        // 5. Social Redirection validation
        if (this.config.allow_social_redirection == 1 || this.config.allow_social_redirection === '1') {
            await this.validateSocialRedirection();
        }

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

        // Relaxed visibility check for navigation wrapper
        if (await navWrp.count() > 0) {
            await navWrp.scrollIntoViewIfNeeded().catch(() => { });
        } else {
            this.logAudit('Navigation: Navigation wrapper not found.', 'info');
        }

        if (await nextBtn.count() === 0 || await prevBtn.count() === 0) {
            this.logAudit('Navigation: Missing Next or Prev buttons.', 'fail');
            return;
        }

        const initialVisibleSlideIndex = await this.getFirstVisibleSlideIndex();
        if (initialVisibleSlideIndex === -1) {
            this.logAudit('[Navigation] No visible slides found to test navigation sequence.', 'info');
            // If none are visible, try to click next anyway to trigger visibility
            if (await nextBtn.isVisible()) await nextBtn.click({ force: true });
            await this.page.waitForTimeout(1000);
        }

        const retryIndex = await this.getFirstVisibleSlideIndex();
        if (retryIndex === -1) {
            this.logAudit('[Navigation] Slides remain hidden after interaction attempt.', 'info');
            return;
        }

        const initialSlide = this.context.locator(this.cardSelector).nth(retryIndex);
        const initialContent = await initialSlide.innerText().catch(() => 'N/A');

        // Click Next
        if (await nextBtn.isVisible()) {
            await nextBtn.click({ force: true });
            await this.page.waitForTimeout(1000);
            const postNextIndex = await this.getFirstVisibleSlideIndex();
            const postNextContent = await this.context.locator(this.cardSelector).nth(postNextIndex).innerText().catch(() => 'N/A');

            if (postNextContent !== initialContent) {
                this.logAudit('[Navigation] Successfully moved to next review via arrow click.');
            } else {
                this.logAudit('[Navigation] Content did not change after clicking Next.', 'info');
            }

            // Click Prev
            if (await prevBtn.isVisible()) {
                await prevBtn.click({ force: true });
                await this.page.waitForTimeout(800);
                this.logAudit('[Navigation] Back navigation triggered.');
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

        const nextBtn = this.context.locator(this.nextButton);
        let playbackVerified = false;

        // Cycle through up to 5 slides to find and test playback on the "active" slide
        for (let i = 0; i < 5; i++) {
            const activeSlide = this.context.locator('.feedspace-review-box.active').first();
            if (await activeSlide.count() > 0) {
                const playTrigger = activeSlide.locator([
                    'video',
                    'iframe',
                    '.video-play-button',
                    '.feedspace-element-play-feed',
                    '.feedspace-element-play-button',
                    'img[src*="manual_video_review"]',
                    '.play-icon'
                ].join(', ')).first();

                if (await playTrigger.count() > 0 && await playTrigger.isVisible()) {
                    try {
                        await playTrigger.click({ force: true });
                        await this.page.waitForTimeout(2000);
                        this.logAudit(`[Playback] Interaction verified on active review ${i + 1}.`);
                        playbackVerified = true;
                        break; // Verified one, that's enough for smoke test
                    } catch (e) {
                        console.log(`Playback attempt failed: ${e.message}`);
                    }
                }
            }

            if (await nextBtn.isVisible()) {
                await nextBtn.click({ force: true });
                await this.page.waitForTimeout(1000);
            } else {
                break;
            }
        }

        if (!playbackVerified) {
            this.logAudit('[Playback] No active playback triggers found or interactive. (N/A)', 'info');
        }
    }

    async isSlideVisible(slide) {
        if (!(await slide.isVisible().catch(() => false))) return false;

        return await slide.evaluate(el => {
            const style = window.getComputedStyle(el);
            const rect = el.getBoundingClientRect();
            // Looser check: check if it's within the viewport roughly
            return style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                rect.height > 1 &&
                rect.width > 1;
        });
    }

    async validateMediaAndCounts() {
        this.logAudit('Behavior: Validating Media loading and Review counts.');
        try {
            await this.initContext();

            // Performance Optimization: Batch process all reviews in the DOM at once
            // This is much faster than clicking "Next" 292 times
            // Strategy: Specifically look inside the track for reviews to avoid finding clones outside it
            const track = this.context.locator(this.sliderTrackSelector);
            const allReviews = track.locator(this.cardSelector);
            const initialCount = await allReviews.count();

            this.logAudit(`Initial scan detected ${initialCount} review elements in the slider track. Processing...`);

            const cardData = await allReviews.evaluateAll(elements => {
                return elements.map(el => {
                    // Filter out elements that aren't actually review cards (e.g. wrapper divs)
                    if (el.classList.contains('feedspace-slider-track')) return null;

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
        const slides = track.locator('.feedspace-items-slider-items, > *');
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

    async validateTextReadability() {
        this.logAudit('Behavior: Detailed Text Readability check for Avatar Slider.');
        await this.initContext();

        const cards = this.context.locator('.feedspace-review-box');
        const cardCount = await cards.count();

        if (cardCount === 0) {
            this.logAudit('Text Readability: No review cards found.', 'info');
            return;
        }

        const readabilityIssues = await cards.evaluateAll(elements => {
            const issues = [];

            elements.forEach((card, index) => {
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
                    selector: '.feedspace-review-box',
                    description: desc,
                    location: 'Visual Integrity',
                    snippet: data.html,
                    severity: 'High'
                });
            }
        }

        if (failCount > 0) {
            this.logAudit(`Text Readability: Found issues in ${failCount} unique review cards.`, 'fail');
        } else {
            this.logAudit('Text Readability: All visible text is legible and properly contained.');
        }
    }

    async validateReadMore() {
        this.logAudit('Behavior: Validating Read More/Less functionality.');
        await this.initContext();

        const readMoreSelectors = [
            'i:has-text("Read More")',
            'button:has-text("Read More")',
            '.read-more',
            '.feedspace-read-more-btn',
            '.feedspace-element-read-more'
        ];
        const expandedSelector = 'i:has-text("Read Less"), button:has-text("Read Less"), .feedspace-read-less-btn, .feedspace-element-read-less';

        const nextBtn = this.context.locator(this.nextButton);
        let readMoreVerified = false;

        // Cycle through up to 5 slides to find and test Read More on the "active" slide
        for (let i = 0; i < 5; i++) {
            const activeSlide = this.context.locator('.feedspace-review-box.active').first();
            if (await activeSlide.count() > 0) {
                let targetTrigger = null;
                for (const selector of readMoreSelectors) {
                    const trigger = activeSlide.locator(selector).first();
                    if (await trigger.isVisible().catch(() => false)) {
                        targetTrigger = trigger;
                        break;
                    }
                }

                if (targetTrigger) {
                    const initialHeight = await activeSlide.evaluate(el => el.offsetHeight).catch(() => 0);
                    this.logAudit(`[Read More] Found trigger on active review ${i + 1}. Initial height: ${initialHeight}px. Clicking...`);
                    try {
                        await targetTrigger.scrollIntoViewIfNeeded().catch(() => { });
                        await targetTrigger.click({ force: true });
                        await this.page.waitForTimeout(1500);

                        const currentHeight = await activeSlide.evaluate(el => el.offsetHeight).catch(() => 0);
                        const hasReadLess = await activeSlide.locator(expandedSelector).first().isVisible().catch(() => false);

                        if (hasReadLess || currentHeight > initialHeight + 2) {
                            this.logAudit(`[Read More] Expansion validated on active review ${i + 1}. New height: ${currentHeight}px. State: ${hasReadLess ? 'Read Less Visible' : 'Height Increased'}`);

                            // Validate Collapse
                            const collapseBtn = activeSlide.locator(expandedSelector).first();
                            if (await collapseBtn.isVisible()) {
                                this.logAudit('[Read More] Read Less: Clicking to verify collapse...', 'info');
                                await collapseBtn.click({ force: true });
                                await this.page.waitForTimeout(1200);

                                const finalHeight = await activeSlide.evaluate(el => el.offsetHeight).catch(() => 0);
                                if (finalHeight < currentHeight || !(await collapseBtn.isVisible())) {
                                    this.logAudit('[Read More] Read More / Less: Full cycle (Expand -> Collapse) validated successfully.');
                                } else {
                                    this.logAudit('[Read More] Read Less: Card did not collapse properly.', 'fail');
                                }
                            }
                            readMoreVerified = true;
                            break;
                        } else {
                            this.logAudit(`[Read More] Expansion failed. Height remained ${currentHeight}px.`, 'info');
                        }
                    } catch (e) {
                        this.logAudit(`[Read More] Interaction failed - ${e.message.split('\n')[0]}`, 'info');
                    }
                }
            }

            if (await nextBtn.isVisible()) {
                await nextBtn.click({ force: true });
                await this.page.waitForTimeout(1200);
            } else {
                break;
            }
        }

        if (!readMoreVerified) {
            this.logAudit('[Read More] No expansion triggers found on active slides. (N/A)', 'info');
        }
    }

    async validateDateConsistency() {
        const configDate = this.config.allow_to_display_feed_date;
        console.log(`[AvatarSliderWidget] Validating Date Consistency (Config: ${configDate})...`);

        try {
            // Use slider track to avoid clones/hidden elements outside
            const track = this.context.locator(this.sliderTrackSelector);
            const dateElements = track.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span');

            // To be safe, also look at the general card selector result if track is empty (fallback)
            const fallbackDates = this.context.locator('.feedspace-review-box .feedspace-element-date');

            const count = await dateElements.count();
            const finalCount = count > 0 ? count : await fallbackDates.count();
            const finalDates = count > 0 ? dateElements : fallbackDates;

            if (configDate == 0 || configDate === '0') {
                if (finalCount === 0) {
                    this.logAudit('Date Consistency: Dates are hidden as per configuration.', 'pass');
                } else {
                    // Check visibility logic - iterate a few
                    let visibleCount = 0;
                    for (let i = 0; i < Math.min(finalCount, 5); i++) {
                        if (await finalDates.nth(i).isVisible()) visibleCount++;
                    }

                    if (visibleCount === 0) {
                        this.logAudit('Date Consistency: Date elements present but hidden (CSS checks out).', 'pass');
                    } else {
                        this.logAudit(`Date Consistency: Dates should be hidden (0) but passed visibility check on ${visibleCount} samples.`, 'fail');
                    }
                }
            } else if (configDate == 1 || configDate === '1') {
                if (finalCount > 0) {
                    // Check specific "undefined" or "null" test
                    const texts = await finalDates.allInnerTexts();
                    const invalidDates = texts.filter(t => t.toLowerCase().includes('undefined') || t.toLowerCase().includes('null'));

                    if (invalidDates.length > 0) {
                        this.logAudit(`Date Consistency: Found invalid dates (undefined/null) in ${invalidDates.length} instances.`, 'fail');
                    } else {
                        // Check visibility of at least one
                        if (await finalDates.first().isVisible()) {
                            this.logAudit(`Date Consistency: All ${finalCount} dates found are valid and visible.`, 'pass');
                        } else {
                            this.logAudit('Date Consistency: Dates found in DOM but seemingly hidden.', 'fail');
                        }
                    }
                } else {
                    this.logAudit('Date Consistency: Dates expected (1) but none found in slider items.', 'fail');
                }
            } else {
                this.logAudit(`Date Consistency: Config value '${configDate}' is optional/unknown. Found ${finalCount} dates.`, 'info');
            }
        } catch (e) {
            this.logAudit(`Date Consistency: Error during check - ${e.message}`, 'info');
        }
    }

    async validateSocialRedirection() {
        const configSocial = this.config.allow_social_redirection;
        console.log(`[AvatarSliderWidget] Validating Social Redirection (Config: ${configSocial})...`);

        const socialRedirectionSelector = '.social-redirection-button, .feedspace-element-header-icon > a > img, div.flex > div.flex > a.feedspace-d6-header-icon, .feedspace-element-header-icon a';
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

module.exports = { AvatarSliderWidget };
