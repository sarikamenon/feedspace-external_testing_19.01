class VerticalScrollConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        this.locators = {
            is_show_ratings: page.locator('.feedspace-stars, .star-rating'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date, .feedspace-wol-date'),
            show_full_review: page.locator('.feedspace-element-read-more, .read-more, button:has-text("Read more")'),
            show_platform_icon: page.locator('div.feedspace-element-header-icon > a > img'),
            allow_social_redirection: page.locator('.social-redirection-button, .feedspace-element-header-icon > a > img'),
            cta_enabled: page.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content'),
            hideBranding: page.locator('a[href*="utm_source=powered-by-feedspace"]'),
            allow_to_remove_branding: page.locator('a[href*="utm_source=powered-by-feedspace"]'),
            is_show_indicators: page.locator('.feedspace-element-carousel-indicators, .slick-dots'),
            enable_load_more: page.locator('.load-more-btn, button:has-text("Load More")'),
            audio_play_button: page.locator('.feedspace-media-play-icon'),
            video_play_button: page.locator('.play-btn')
        };

        this.auditLog = [];
    }

    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1;
    }

    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[VerticalScrollConfig] ${status.toUpperCase()}: ${message}`);
    }

    async generateFeatureReport() {
        const report = [];

        for (const [key, locator] of Object.entries(this.locators)) {
            const apiValue = this.configJson[key] ?? 'N/A';
            let uiValue = 'N/A';

            try {
                if (locator && typeof locator.isVisible === 'function') {
                    // VerticalScroll often has many items, check first visible one
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

module.exports = { VerticalScrollConfig };
