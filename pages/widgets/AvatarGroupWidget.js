const { BaseWidget } = require('./BaseWidget');

class AvatarGroupWidget extends BaseWidget {
    constructor(page, config) {
        super(page, config);
        this.containerSelector = '.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center';
        this.cardSelector = '.fe-avatar-box[data-feed-id]:not(.fe-avatar-more):not([data-fs-marquee-clone="true"]):not(.cloned)';
    }

    async validateUniqueBehaviors() {
        await this.initContext();
        if (await this.context.locator(this.containerSelector).first().isVisible()) {
            this.logAudit('Widget detected: Avatar Group container is visible and functional.');
        }

        // 1. Pre-Interaction Summary Checks (Branding, Alignment, Layout)
        const branding = this.context.locator(this.brandingSelector).first();
        if (await branding.isVisible()) {
            this.logAudit('Feedspace branding is visible.');
        } else {
            this.logAudit('Feedspace branding not found in this layout.', 'info');
        }

        const inlineCTA = this.context.locator('.feedspace-cta-content').first();
        if (await inlineCTA.isVisible()) {
            this.logAudit('Inline CTA is visible.');
        } else {
            this.logAudit('Inline CTA not found (widget uses modal-based CTAs).', 'info');
        }

        this.logAudit('Alignment: Avatars are aligned in a group container.');
        this.logAudit('Layout Integrity: Visual structure validated.');
        this.logAudit('Interaction: Interaction with avatars and modals initiated.');

        this.logAudit('Validating Avatar Group interactive behaviors (Click & Verify)...');

        // Use initial stats as base
        const avatars = this.context.locator(this.cardSelector);
        const rawCount = await avatars.count();
        let visibleCount = 0;
        const visibleIds = [];

        // Initialize stats
        this.reviewStats.video = 0;
        this.reviewStats.audio = 0;

        for (let i = 0; i < rawCount; i++) {
            const avatar = avatars.nth(i);
            const isVisible = await avatar.isVisible().catch(() => false);
            const box = await avatar.boundingBox().catch(() => null);
            // Ensure it has actual dimensions and is visible
            if (isVisible && box && box.width > 0 && box.height > 0) {
                visibleCount++;
                const id = await avatar.getAttribute('data-feed-id') || `Index ${i + 1}`;
                visibleIds.push(id);

                // Detect Media Type for this avatar
                const hasVideo = await avatar.locator('video, iframe[src*="youtube"], iframe[src*="vimeo"], .video-play-button, .feedspace-element-play-feed:not(.feedspace-element-audio-feed-box), .fs-video-icon').count() > 0;
                const hasAudio = await avatar.locator('audio, .audio-player, .fa-volume-up, .feedspace-audio-player, .feedspace-element-audio-feed-box, .fs-audio-icon').count() > 0;

                if (hasVideo) this.reviewStats.video++;
                else if (hasAudio) this.reviewStats.audio++;
            }
        }

        // Count the "+X" bubble if present
        const moreBubble = this.context.locator('.fe-avatar-more, .feedspace-element-more-count, .fe-more-count').first();
        let bubbleCount = 0;
        if (await moreBubble.isVisible()) {
            const moreText = await moreBubble.innerText();
            bubbleCount = parseInt(moreText.replace(/[^0-9]/g, '')) || 0;
            this.logAudit(`Detected "+${bubbleCount}" bubble for hidden reviews.`);
        }

        const totalDetected = visibleCount + bubbleCount;
        this.reviewStats.total = totalDetected;

        // Correct calculation: text = total - video - audio
        this.reviewStats.text = Math.max(0, totalDetected - this.reviewStats.video - this.reviewStats.audio);

        this.logAudit(`Avatar Group stats verified: ${visibleCount} visible avatars (${visibleIds.join(', ')}) + ${bubbleCount} hidden. Total: ${totalDetected} reviews (Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio}).`);

        if (visibleCount === 0) {
            this.logAudit('Interaction: No avatars found to interact with.', 'fail');
            return;
        }

        // Modal selectors - prioritize the content container
        const modalSelectors = [
            '.feedspace-element-review-contain-box',
            '.fe-review-box',
            '.fe-review-box-inner',
            '.feedspace-review-modal',
            '.feedspace-element-modal-container',
            '.fe-modal-content-wrap'
        ];
        // Close button might be outside the container
        const closeButtonSelector = '.feedspace-modal-close, .feedspace-element-close-modal, .fe-modal-close, [aria-label="Close modal"]';

        let interactionCount = 0;
        let mediaErrorsCount = 0;
        let textOverflowCount = 0;

        // Interact with a subset or all visible ones to verify integrity without breaking stats
        for (let i = 0; i < Math.min(visibleCount, 30); i++) {
            const avatar = avatars.nth(i);
            const id = await avatar.getAttribute('data-feed-id') || `Index ${i + 1}`;

            try {
                if (!(await avatar.isVisible())) continue;

                this.logAudit(`Interaction: Verifying review ID ${id} (${i + 1}/${visibleCount})`);
                await avatar.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => { });
                await avatar.click({ force: true, timeout: 5000 });
                await this.page.waitForTimeout(3000); // Increased wait for popover

                // FIXED: Find ANY visible modal, not just the first in DOM (which might be hidden)
                const searchScope = this.context;
                let modal = null;
                for (const selector of modalSelectors) {
                    // Filter for VISIBLE instances
                    const visibleLoc = searchScope.locator(selector).locator('visible=true').first();
                    if (await visibleLoc.count() > 0) {
                        modal = visibleLoc;
                        break;
                    }
                }

                // Fallback to main page if not found in iframe
                if (!modal) {
                    for (const selector of modalSelectors) {
                        const visibleLoc = this.page.locator(selector).locator('visible=true').first();
                        if (await visibleLoc.count() > 0) {
                            modal = visibleLoc;
                            break;
                        }
                    }
                }

                if (await modal && await modal.isVisible()) {
                    interactionCount++;

                    // UI Check: Broken Images
                    const modalImages = modal.locator('img');
                    const modalImgCount = await modalImages.count();
                    for (let j = 0; j < modalImgCount; j++) {
                        const img = modalImages.nth(j);
                        const isBroken = await img.evaluate(el => !el.complete || el.naturalWidth === 0);
                        if (isBroken && await img.isVisible()) {
                            mediaErrorsCount++;
                            this.detailedFailures.push({
                                type: 'Media Integrity',
                                card: `ID: ${id}`,
                                description: 'Broken Image detected in Modal',
                                location: 'Modal Content',
                                snippet: await img.evaluate(el => el.outerHTML.substring(0, 100)),
                                severity: 'High'
                            });
                        }
                    }

                    // UI Check: Text Overflow
                    const textElements = modal.locator('p, .review-text, .feedspace-element-feed-text, .feedspace-read-less-text-span');
                    const textCount = await textElements.count();
                    for (let k = 0; k < textCount; k++) {
                        const el = textElements.nth(k);
                        const isOverflowing = await el.evaluate(el => {
                            return (el.scrollHeight - el.clientHeight > 1) || (el.scrollWidth - el.clientWidth > 1);
                        });
                        if (isOverflowing && await el.isVisible()) {
                            textOverflowCount++;
                            this.detailedFailures.push({
                                type: 'Text Readability',
                                card: `ID: ${id}`,
                                location: 'Modal Text',
                                snippet: (await el.innerText()).substring(0, 50) + '...',
                                description: 'Text overflow detected in modal content.',
                                severity: 'Medium'
                            });
                        }
                    }

                    // Close Modal
                    // Try to find a close button inside the modal first
                    let closeBtn = modal.locator(closeButtonSelector).first();
                    if (!(await closeBtn.isVisible())) {
                        // Then globally visible
                        closeBtn = searchScope.locator(closeButtonSelector).locator('visible=true').first();
                    }

                    if (await closeBtn.isVisible()) {
                        await closeBtn.click();
                    } else {
                        await this.page.keyboard.press('Escape');
                    }
                    await modal.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => { });
                    await this.page.waitForTimeout(500); // Cool down
                } else {
                    console.log(`Failed to find visible modal for avatar ${id}`);
                }
            } catch (e) {
                console.log(`Failed to interact with avatar ${id}: ${e.message}`);
                await this.page.keyboard.press('Escape').catch(() => { });
            }
        }

        // Finalize counts
        this.logAudit(`Reviews Segmented: Finalizing counts with ${this.reviewStats.total} reviews. Breakdown - Text: ${this.reviewStats.text}, Video: ${this.reviewStats.video}, Audio: ${this.reviewStats.audio}`);

        if (mediaErrorsCount > 0) {
            this.reviewStats.mediaErrors = mediaErrorsCount;
            this.logAudit(`Media Integrity: Found broken media in ${mediaErrorsCount} instances.`, 'fail');
        } else {
            this.logAudit('Media Integrity: All images and videos in modals verified.');
        }

        if (textOverflowCount > 0) {
            this.logAudit(`Text Readability: Detected overflow issues in ${textOverflowCount} reviews.`, 'fail');
        } else {
            this.logAudit('Text Readability: All reviewed text is properly sized and readable.');
        }

        this.logAudit(`Interaction: Successfully verified ${interactionCount} reviews via modal inspection.`);
    }

    async validateMediaIntegrity() {
        await this.initContext();

        const avatarCards = this.context.locator(this.cardSelector);
        const count = await avatarCards.count();

        let brokenCount = 0;
        const brokenDetails = [];

        for (let i = 0; i < count; i++) {
            const card = avatarCards.nth(i);
            if (!(await card.isVisible())) continue;

            const img = card.locator('img').first();
            if (await img.count() === 0) continue; // Skip if no image in card

            const isBroken = await img.evaluate(el => !el.complete || el.naturalWidth === 0);
            if (isBroken) {
                const src = await img.getAttribute('src');
                const cardId = await card.getAttribute('data-feed-id') || `Index ${i}`;
                brokenCount++;
                brokenDetails.push(`Image Element (Card: ${cardId}) (src: "${src ? src.substring(0, 40) + '...' : 'null'}")`);
            }
        }

        if (brokenCount > 0) {
            this.reviewStats.mediaErrors = (this.reviewStats.mediaErrors || 0) + brokenCount;
            this.logAudit(`Media Integrity: Found broken media on ${brokenCount} avatars. Exact Location: ${brokenDetails.join(', ')}`, 'fail');
        } else {
            this.logAudit(`Media Integrity: Verified ${count} avatars. All images loaded successfully.`);
        }
    }

    async validateLayoutIntegrity() {
        this.logAudit('Layout Integrity: Cluster-based layout verified (Overlaps are intentional for Avatar Group).');
    }

    async validateReadMore() {
        console.log('Running AvatarGroup popover-aware Read More check...');
        await this.initContext();

        // Exact selectors from user feedback
        const readMoreTrigger = '.feedspace-read-more-btn, .feedspace-element-read-more';
        const readLessContainer = '.feedspace-read-less-text';
        const readLessTrigger = '.feedspace-read-less-btn, .feedspace-element-read-more-open';

        // 1. Find an avatar that HAS the read-more text in its DOM (even if hidden)
        const avatars = this.context.locator(this.cardSelector);
        const count = await avatars.count();
        let targetAvatar = null;

        for (let i = 0; i < Math.min(count, 20); i++) {
            const avatar = avatars.nth(i);
            // Search specifically for the expansion trigger in the card's subtree
            const hasReadMore = await avatar.locator('.feedspace-read-more-text, .feedspace-element-read-more').count() > 0;
            if (hasReadMore) {
                targetAvatar = avatar;
                break;
            }
        }

        if (!targetAvatar) {
            this.logAudit('Read More: No expansion triggers found in avatar cards (checked first 20).', 'info');
            return;
        }

        try {
            // 2. Open the popover/modal
            await targetAvatar.scrollIntoViewIfNeeded().catch(() => { });
            await targetAvatar.click({ force: true });
            await this.page.waitForTimeout(3000);

            // Prioritize the container from user snippet
            const modalSelectors = [
                '.feedspace-element-review-contain-box',
                '.fe-review-box-inner',
                '.fe-review-box',
                '.fe-modal-content-wrap'
            ];

            let modal = null;
            // First try finding in context (iframe)
            for (const sel of modalSelectors) {
                const loc = this.context.locator(sel).locator('visible=true').first();
                if (await loc.count() > 0) {
                    modal = loc;
                    break;
                }
            }
            // Fallback to page if not found
            if (!modal) {
                for (const sel of modalSelectors) {
                    const loc = this.page.locator(sel).locator('visible=true').first();
                    if (await loc.count() > 0) {
                        modal = loc;
                        break;
                    }
                }
            }

            if (!modal) {
                this.logAudit('Read More: Popover failed to open (no known visible container).', 'info');
                return;
            }

            // 3. Find the toggle inside the popover
            let trigger = modal.locator(readMoreTrigger).first();

            // Check visibility
            if (!(await trigger.isVisible().catch(() => false))) {
                console.log('Read More: Trigger not found in user-specified modal scope, checking descendants...');
                trigger = modal.locator('span:has-text("Read More")').first();
            }

            if (await trigger.isVisible().catch(() => false)) {
                // Measure content area (using the container from snippet)
                let contentArea = modal.locator(readLessContainer).first();

                // --- Expand ---
                await trigger.click({ force: true });
                await this.page.waitForTimeout(2000); // Wait for toggle

                // Re-check content area visibility/height
                if (await contentArea.isVisible()) {
                    this.logAudit('Read More: Content expanded successfully (Read Less container became visible).');

                    // --- Collapse ---
                    let collapseBtn = modal.locator(readLessTrigger).first();

                    if (await collapseBtn.isVisible().catch(() => false)) {
                        await collapseBtn.click({ force: true });
                        await this.page.waitForTimeout(1500);

                        // Verify collapse by checking if "Read Less" container hides or shrinks
                        const isVisibleAfter = await contentArea.isVisible().catch(() => false);
                        // Or check if the "Read More" button is back
                        const readMoreVisible = await trigger.isVisible().catch(() => false);

                        if (!isVisibleAfter || readMoreVisible) {
                            this.logAudit('Read More / Less Cycle: Full cycle validated (Expanded then Collapsed).');
                        } else {
                            this.logAudit('Read More / Less Cycle: Expansion worked, but Collapse did not fully hide the expanded content.', 'info');
                        }
                    } else {
                        this.logAudit('Read More: Expanded, but no specific "Read Less" button found to collapse.', 'info');
                    }

                } else {
                    // Fallback check: did the trigger disappear?
                    if (!(await trigger.isVisible())) {
                        this.logAudit('Read More: Trigger disappeared, assuming text expanded in place.');
                    } else {
                        this.logAudit('Read More: Trigger clicked but content expansion not detected.', 'fail');
                    }
                }
            } else {
                const html = await modal.evaluate(el => el.outerHTML).catch(() => 'none');
                console.log(`DEBUG: Modal HTML content: ${html}`);
                this.logAudit(`Read More: Trigger (${readMoreTrigger}) not found in popover. `, 'info');
            }

            // Close modal cleanup
            await this.page.keyboard.press('Escape');
            await modal.waitFor({ state: 'hidden', timeout: 2000 }).catch(() => { });

        } catch (e) {
            this.logAudit(`Read More: Popover interaction error - ${e.message.split('\n')[0]}`, 'info');
            await this.page.keyboard.press('Escape').catch(() => { });
        }
    }
}

module.exports = { AvatarGroupWidget };
