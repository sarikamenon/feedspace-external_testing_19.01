class StripSliderConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        this.locators = {
            is_show_ratings: page.locator('div.feedspace-marquee-right > div.feedspace-info-box > div.feedspace-review-star, .feedspace-stars, .feedspace-video-review-header-star'),
            allow_to_display_feed_date: page.locator('div.feedspace-info-box > div.feedspace-element-date, .feedspace-element-date.feedspace-wol-date, .feedspace-element-date'),
            show_full_review: page.locator('span:has-text("Read More"), .read-more, button:has-text("Read More"), .feedspace-element-read-more-text-span'),
            show_platform_icon: page.locator('div.feedspace-info-box div.feedspace-element-header-icon > a > img, div.feedspace-element-header-icon > a > img, a.feedspace-d6-header-icon img'),
            allow_social_redirection: page.locator('div.feedspace-info-box div.feedspace-element-header-icon, div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon, a.feedspace-d6-header-icon, .feedspace-element-header-icon a'),
            cta_enabled: page.locator('.feedspace-cta-button-container-d8, .feedspace-cta-button-container-d9, .feedspace-cta-content, .feedspace-inline-cta-card'),
            hideBranding: page.locator('a[title*="Feedspace"], a[href*="utm_source=powered-by-feedspace"], .feedspace-branding'),
            allow_to_remove_branding: page.locator('a[title*="Feedspace"], a[href*="utm_source=powered-by-feedspace"], .feedspace-branding'),
        };

        this.auditLog = [];
    }

    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1;
    }

    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[StripSliderConfig] ${status.toUpperCase()}: ${message}`);
    }

    async generateFeatureReport() {
        const report = [];

        // Locators sync with refined versions, preserving widget-specific prefixes
        const refinedLocators = {
            is_show_ratings: this.page.locator('div.feedspace-info-box > div.feedspace-review-star, .feedspace-stars, .feedspace-video-review-header-star, div.feedspace-element-review-box > svg'),
            allow_to_display_feed_date: this.page.locator('div.feedspace-info-box > div.feedspace-element-date, .feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span'),
            show_full_review: this.page.locator('span:has-text("Read More"), .read-more, i:has-text("Read More"), .feedspace-element-read-more-text-span'),
            show_platform_icon: this.page.locator('div.feedspace-info-box div.feedspace-element-header-icon img, .feedspace-element-header-icon img, i.social-redirection-button, .fe-social-icon, a.feedspace-d6-header-icon img'),
            cta_enabled: this.page.locator('.feedspace-cta-button-container-d8, .feedspace-cta-button-container-d9, .feedspace-cta-content, .feedspace-inline-cta-card, .fe-cta-container'),
            allow_to_remove_branding: this.page.locator('a[href*="utm_source=powered-by-feedspace"][title="Capture reviews with Feedspace"]'),
            allow_social_redirection: this.page.locator('a.social-redirection-button, .fe-social-link, a.feedspace-d6-header-icon, .feedspace-element-header-icon a'),
            audio_play_button: this.page.locator('.feedspace-media-play-icon, .feedspace-element-audio-icon'),
            video_play_button: this.page.locator('.play-btn, .feedspace-video-review-header .play-btn')
        };

        for (const [key, locator] of Object.entries(refinedLocators)) {
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
        return report;
    }
}

module.exports = { StripSliderConfig };
