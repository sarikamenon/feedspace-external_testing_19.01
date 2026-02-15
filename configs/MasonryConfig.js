class MasonryConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        this.locators = {
            is_show_ratings: page.locator('.feedspace-video-review-header-star, .feedspace-stars'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date, .feedspace-wol-date'),
            show_full_review: page.locator('.feedspace-element-read-more, .feedspace-element-read-more-text-span, button:has-text("Read more")'),
            show_platform_icon: page.locator('div.feedspace-element-header-icon > a > img'),
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

module.exports = { MasonryConfig };
