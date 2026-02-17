class AvatarGroupConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        this.locators = {
            is_show_ratings: page.locator('div.feedspace-element-review-box svg.feedspace-stars, div.feedspace-element-review-box svg.star-rating, .fe-avatar-rating'),
            show_star_ratings: page.locator('div.feedspace-element-review-box svg.feedspace-stars, div.feedspace-element-review-box svg.star-rating, .fe-star-indicator'),
            show_platform_icon: page.locator('div.feedspace-element-bio-top div.feedspace-element-header-icon, div.feedspace-element-bio-info div.feedspace-element-header-icon'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date.feedspace-wol-date, .fe-avatar-date'),
            show_full_review: page.locator('i:has-text("Read More")'),
            allow_social_redirection: page.locator('a.social-redirection-button, .fe-social-link'),
            allow_to_remove_branding: page.locator('a[href*="utm_source=powered-by-feedspace"]'),
            cta_enabled: page.locator('div.fe-review-box-inner > div.feedspace-element-feed-box-inner > div.feedspace-cta-button-container-d9, .feedspace-cta-button-container-d9, .fe-cta-container')
        };

        this.auditLog = [];
    }

    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1;
    }

    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[AvatarGroupConfig] ${status.toUpperCase()}: ${message}`);
    }

    async generateFeatureReport() {
        const report = [];

        // 🟢 OPEN MODAL to check visibility of elements typically inside (ratings, platforms, etc)
        this.log("[Config] Opening modal for configuration check...");
        const avatarTrigger = this.page.locator('.fe-avatar-box:not(.fe-avatar-more)').first();
        if (await avatarTrigger.count() > 0) {
            await avatarTrigger.click({ force: true });
            await this.page.waitForTimeout(3000); // Allow modal time to fully render
        }

        const modalContainer = this.page.locator('.fe-review-box, .feedspace-element-review-contain-box, .fe-modal-content').filter({ visible: true }).first();

        const modalLocators = {
            is_show_ratings: modalContainer.locator('.feedspace-stars, .star-rating, .fe-avatar-rating, .fe-star-indicator, div.feedspace-element-review-box > svg'),
            show_star_ratings: modalContainer.locator('.feedspace-stars, .star-rating, .fe-avatar-rating, .fe-star-indicator, div.feedspace-element-review-box > svg'),
            show_platform_icon: modalContainer.locator('img[alt$="logo"], .feedspace-element-header-icon img, .feedspace-element-header-icon, i.social-redirection-button, .fe-social-icon, .fe-social-link img, img[src*="social-icons"], img[src*="logo"], div[class*="social-icon"]'),
            allow_to_display_feed_date: modalContainer.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span'),
            show_full_review: modalContainer.locator('i:has-text("Read More"), i:has-text("Read Less"), .feedspace-element-read-more, .read-more'),
            allow_social_redirection: modalContainer.locator('a.social-redirection-button, .fe-social-link, a.feedspace-d6-header-icon, .feedspace-element-header-icon a'),
            allow_to_remove_branding: this.page.locator('a[href*="utm_source=powered-by-feedspace"][title="Capture reviews with Feedspace"]'),
            cta_enabled: modalContainer.locator('div.fe-review-box-inner > div.feedspace-element-feed-box-inner > div.feedspace-cta-button-container-d9, .feedspace-cta-button-container-d9, .fe-cta-container, .feedspace-cta-content')
        };

        for (const [key, locator] of Object.entries(modalLocators)) {
            const apiValue = this.configJson[key] ?? 'absent';
            let uiValue = '0';
            let info = '';

            try {
                if (key === 'allow_to_remove_branding' || key === 'hideBranding') {
                    // Branding uses Inverse Logic
                    const branding = locator.first();
                    const isVisible = await branding.isVisible().catch(() => false);
                    uiValue = isVisible ? '0' : '1';
                } else if (locator) {
                    const count = await locator.count().catch(() => 0);
                    let isVisible = count > 0;

                    if (isVisible) {
                        const firstVisible = await locator.filter({ visible: true }).count().catch(() => 0);
                        if (firstVisible === 0) {
                            const isHidden = await locator.first().evaluate(el => window.getComputedStyle(el).display === 'none').catch(() => true);
                            if (isHidden) isVisible = false;
                        }
                    }

                    if (key === 'show_full_review') {
                        uiValue = isVisible ? "1" : "0";
                    } else if (isVisible) {
                        if (key === 'allow_to_display_feed_date') {
                            const text = await locator.first().innerText().catch(() => '');
                            uiValue = text.trim().length > 0 ? '1' : '0';
                        } else {
                            uiValue = "1";
                        }
                    } else {
                        uiValue = "0";
                    }
                }
            } catch (e) {
                uiValue = 'error';
            }

            let status = 'FAIL';
            if (apiValue === 'absent') {
                status = 'FAIL';
                info = 'API response not got';
            } else {
                const normApi = (apiValue === '1' || apiValue === 1 || apiValue === true) ? '1' : '0';
                status = (normApi === uiValue) ? 'PASS' : 'FAIL';
            }

            report.push({
                feature: key,
                api_value: apiValue,
                ui_value: uiValue,
                status,
                info
            });
            this.log(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: ${status}${info ? ` (${info})` : ''}`, status === 'FAIL' ? 'fail' : 'info');
        }

        // 🟢 CLOSE MODAL
        const closeBtnSelectors = ['.feedspace-modal-close', '.fe-modal-close', '.close-button', 'i:has-text("Close")'];
        for (const sel of closeBtnSelectors) {
            const btn = this.page.locator(sel).first();
            if (await btn.isVisible()) {
                await btn.click({ force: true }).catch(() => { });
                break;
            }
        }

        // Safer Escape: Support Frame contexts where page.keyboard might be undefined
        try {
            if (this.page.keyboard) {
                await this.page.keyboard.press('Escape').catch(() => { });
            } else {
                await this.page.locator('body').press('Escape').catch(() => { });
            }
        } catch (err) { }

        return report;
    }
}

module.exports = { AvatarGroupConfig };
