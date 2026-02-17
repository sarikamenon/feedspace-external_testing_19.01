class FloatingCardsConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        const container = '.feedspace-floating-widget';
        this.locators = {
            is_show_ratings: page.locator(`${container} div.feedspace-card-body > div.feedspace-stars > svg, ${container} .feedspace-element-feed-box-inner > div.feedspace-element-review-box > svg`),
            allow_to_display_feed_date: page.locator(`${container} .feedspace-element-date.feedspace-wol-date, ${container} .feedspace-element-date`),
            show_full_review: page.locator(`${container} span:has-text("Read More"), ${container} .feedspace-read-less-btn.feedspace-element-read-more.feedspace-element-read-more-open`),
            show_platform_icon: page.locator(`${container} div.feedspace-element-header-icon > a > img`),
            allow_social_redirection: page.locator(`${container} div.feedspace-element-header-icon > a > img, ${container} .feedspace-element-header-icon a`),
            cta_enabled: page.locator(`${container} .feedspace-cta-button-container-d13`),
        };

        this.auditLog = [];
    }

    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1;
    }

    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[FloatingCardsConfig] ${status.toUpperCase()}: ${message}`);
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

module.exports = { FloatingCardsConfig };
