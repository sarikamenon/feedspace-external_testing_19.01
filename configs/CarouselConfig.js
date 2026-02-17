class CarouselConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        // Map API JSON keys to locators in the UI (Standardized)
        this.locators = {
            is_show_ratings: page.locator('.feedspace-video-review-header-star, .feedspace-stars, .star-rating, div.feedspace-element-review-box > svg, .feedspace-star-fill-color'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span'),
            show_full_review: page.locator('.feedspace-element-read-more, .read-more, i:has-text("Read More")'),
            show_platform_icon: page.locator('div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon'),
            cta_enabled: page.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content, .fe-cta-container'),
            // hideBranding: page.locator('a[href*="utm_source=powered-by-feedspace"][title="Capture reviews with Feedspace"]'),
            allow_to_remove_branding: page.locator('a[title="Capture reviews with Feedspace"]'),
            is_show_arrows_buttons: page.locator('.slick-prev, .carousel-control-prev, .prev-btn, .feedspace-element-carousel-arrow.left, button[aria-label="Previous item"], .slick-next, .carousel-control-next, .next-btn, .feedspace-element-carousel-arrow.right, button[aria-label="Next item"]'),
            is_show_indicators: page.locator('.feedspace-element-carousel-indicators, .slick-dots'),
            allow_social_redirection: page.locator('.social-redirection-button, .fe-social-link, div.flex > div.flex > a.feedspace-d6-header-icon, .feedspace-element-header-icon a')
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
            let apiValue = 'undefined';
            let uiValue = 'undefined';
            let status = 'undefined';

            // 1. Handle Missing Keys (undefined)
            if (this.configJson[key] === undefined || this.configJson[key] === null) {
                report.push({
                    feature: key,
                    api_value: 'absent',
                    ui_value: 'absent',
                    status: 'absent'
                });
                this.log(`Feature: ${key}, API: absent, UI: absent, Status: absent`, 'info');
                continue;
            }

            apiValue = (this.configJson[key] === true || this.configJson[key] === 1 || this.configJson[key] === "1") ? "1" : "0";

            try {
                if (locator && typeof locator.isVisible === 'function') {
                    // Optimized visibility check: search for any visible instance across potential clones
                    const visibleCount = await locator.filter({ visible: true }).count().catch(() => 0);
                    const isVisible = visibleCount > 0;

                    if (key === 'show_full_review') {
                        // 0 = Truncated (Button Present), 1 = Full Review (Button Absent)
                        uiValue = isVisible ? "0" : "1";
                    } else if (key === 'hideBranding' || key === 'allow_to_remove_branding') {
                        // 0 = Visible, 1 = Hidden
                        uiValue = isVisible ? "0" : "1";
                    } else {
                        // 1 = Visible, 0 = Hidden
                        uiValue = isVisible ? "1" : "0";
                    }
                }
            } catch (e) {
                uiValue = 'error';
            }

            status = apiValue.toString() === uiValue.toString() ? 'PASS' : 'FAIL';

            report.push({
                feature: key,
                api_value: apiValue,
                ui_value: uiValue,
                status,
                logic: (key === 'show_full_review' || key === 'hideBranding' || key === 'allow_to_remove_branding') ? 'inverse' : 'direct'
            });
            this.log(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: ${status}`, status === 'FAIL' ? 'fail' : 'info');
        }
        return report;
    }
}

module.exports = { CarouselConfig };
