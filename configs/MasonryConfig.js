class MasonryConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        this.locators = {
            is_show_ratings: page.locator('.feedspace-video-review-header-star, .feedspace-stars, .star-rating, div.feedspace-element-review-box > svg, .feedspace-star-fill-color'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span'),
            show_full_review: page.locator('.feedspace-element-read-more, .feedspace-element-read-more-text-span, i:has-text("Read More"), .read-more'),
            show_platform_icon: page.locator('img[alt$="logo"], .feedspace-element-header-icon img, .feedspace-element-header-icon, i.social-redirection-button, .fe-social-icon, .fe-social-link img, img[src*="social-icons"], img[src*="logo"], div[class*="social-icon"]'),
            cta_enabled: page.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content, .fe-cta-container'),
            allow_social_redirection: page.locator('a.social-redirection-button, .fe-social-link, a.feedspace-d6-header-icon, div.flex > div.flex > a.feedspace-d6-header-icon, .feedspace-element-header-icon a'),
            hideBranding: page.locator('a[href*="utm_source=powered-by-feedspace"][title="Capture reviews with Feedspace"]'),
            allow_to_remove_branding: page.locator('a[href*="utm_source=powered-by-feedspace"][title="Capture reviews with Feedspace"]'),
            is_show_arrows_buttons: page.locator('.feedspace-element-carousel-arrow.left, .feedspace-element-carousel-arrow.right, .prev-btn, .next-btn'),
            enable_load_more: page.locator('.load-more-btn, button:has-text("Load More"), span:has-text("Load More")')
        };

        this.auditLog = [];
    }

    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1;
    }

    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[MasonryConfig] ${status.toUpperCase()}: ${message}`);
    }

    async generateFeatureReport() {
        const report = [];

        for (const [key, locator] of Object.entries(this.locators)) {
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

module.exports = { MasonryConfig };
