class CarouselConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        // Map API JSON keys to locators in the UI (Standardized)
        this.locators = {
            is_show_ratings: page.locator('.feedspace-video-review-header-star, .feedspace-stars, .star-rating, .feedspace-element-review-box .feedspace-icon, .feedspace-star-fill-color'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date, .feedspace-wol-date'),
            show_full_review: page.locator('.feedspace-element-read-more, .feedspace-element-read-more-text-span, .read-more, button:has-text("Read more")'),
            show_platform_icon: page.locator('div.feedspace-element-header-icon > a > img'),
            cta_enabled: page.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content'),
            allow_social_redirection: page.locator('.social-redirection-button, .feedspace-element-header-icon > a > img'),
            hideBranding: page.locator('a[href*="utm_source=powered-by-feedspace"]'),
            allow_to_remove_branding: page.locator('a[href*="utm_source=powered-by-feedspace"]'),
            is_show_arrows_buttons: page.locator('.slick-prev, .carousel-control-prev, .prev-btn, .feedspace-element-carousel-arrow.left, button[aria-label="Previous item"], .slick-next, .carousel-control-next, .next-btn, .feedspace-element-carousel-arrow.right, button[aria-label="Next item"]'),
            is_show_indicators: page.locator('.feedspace-element-carousel-indicators, .slick-dots')
        };

        this.auditLog = [];
    }

    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1;
    }

    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[CarouselConfig] ${status.toUpperCase()}: ${message}`);
    }

    async generateFeatureReport() {
        const report = [];

        for (const [key, locator] of Object.entries(this.locators)) {
            // Default to "0" if API value is missing/null
            const rawApi = this.configJson[key];
            const apiValue = (rawApi === undefined || rawApi === null || rawApi === '') ? '0' : rawApi.toString();
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

module.exports = { CarouselConfig };
