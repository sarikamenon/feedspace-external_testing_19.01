class StripSliderConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        this.locators = {
            is_show_ratings: page.locator('div.feedspace-video-review-header-wrap > div.feedspace-video-review-header-inner > div.feedspace-video-review-header-star, .feedspace-stars'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date.feedspace-wol-date'),
            show_full_review: page.locator('span:has-text("Read More")'),
            show_platform_icon: page.locator('div.feedspace-element-header-icon > a > img, div.feedspace-review-bio-info > div.feedspace-element-header-icon > a'),
            allow_social_redirection: page.locator('div.feedspace-review-bio-info > div.feedspace-element-header-icon > a, div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon'),
            cta_enabled: page.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content'),
            hideBranding: page.locator('a[href*="utm_source=powered-by-feedspace"]'),
            allow_to_remove_branding: page.locator('a[href*="utm_source=powered-by-feedspace"]'),
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

        for (const [key, locator] of Object.entries(this.locators)) {
            const apiValue = this.configJson[key] ?? 'N/A';
            let uiValue = 'N/A';

            try {
                if (locator && typeof locator.isVisible === 'function') {
                    uiValue = await locator.first().isVisible().catch(() => false) ? "1" : "0";
                }
            } catch (e) {
                uiValue = 'error';
            }

            const status = apiValue.toString() === uiValue.toString() ? 'PASS' : 'FAIL';
            report.push({
                feature: key,
                api_value: apiValue,
                ui_value: uiValue,
                status
            });
            this.log(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: ${status}`, status === 'FAIL' ? 'fail' : 'info');
        }
        return report;
    }
}

module.exports = { StripSliderConfig };
