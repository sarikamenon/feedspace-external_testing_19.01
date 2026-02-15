// configs/HorizontalScrollConfig.js

class HorizontalScrollConfig {
    constructor(page, configJson) {
        this.page = page;                  // Playwright Page object
        this.configJson = configJson || {}; // API JSON

        // Map API JSON keys to locators in the UI
        this.locators = {
            is_show_ratings: page.locator('.feedspace-video-review-header-star'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date.feedspace-wol-date'),
            show_full_review: page.locator('.feedspace-element-read-more, .feedspace-element-read-more-text-span, .read-more, span:has-text("Read more"), button:has-text("Read more"), .show-more, i:has-text("Read More")'),
            show_platform_icon: page.locator('div.feedspace-element-header-icon > a > img'),

        };

        this.auditLog = [];
    }

    // Check if a feature is enabled in API JSON
    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1;
    }

    // Log messages for audit/report
    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[HorizontalScrollConfig] ${status.toUpperCase()}: ${message}`);
    }

    // Get locator for a given API key
    getLocator(key) {
        return this.locators[key] || null;
    }

    // Generate JSON vs UI report
    async generateFeatureReport() {
        const report = [];

        for (const [key, locator] of Object.entries(this.locators)) {
            const apiValue = this.configJson[key] ?? 'N/A';
            let uiValue = 'N/A';

            try {
                if (locator && typeof locator.isVisible === 'function') {
                    uiValue = await locator.isVisible().catch(() => false) ? "1" : "0";
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

        console.table(report);
        return report;
    }
}

module.exports = { HorizontalScrollConfig };
