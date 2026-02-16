const { StripSliderWidget } = require('../pages/widgets/StripSliderWidget');

class StripSliderValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new StripSliderWidget(page, config);

        // Consolidated report
        this.reportData = {
            widget: 'StripSlider',
            url: page.url(),
            auditLog: [],
            featureResults: [],
            reviewStats: {},
            detailedFailures: [],
            accessibilityResults: [],
            summary: { total: 0, pass: 0, fail: 0 }
        };
        this.logAudit('Detailed Audit results for StripSlider Widget', 'info');
    }

    logAudit(message, status = 'info') {
        this.reportData.auditLog.push({ message, status });
        console.log(`[StripSliderValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Strip Slider audit...', 'info');

            await this.widget.initContext();

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI();

            // 2️⃣ Unique behaviors & interactions
            await this.widget.validateUniqueBehaviors();

            // Results aggregation
            this.reportData.reviewStats = this.widget.reviewStats || {};
            this.reportData.detailedFailures = this.widget.detailedFailures || [];
            this.reportData.accessibilityResults = this.widget.accessibilityResults || [];

            // Merge widget's internal audit logs
            if (this.widget.auditLog && this.widget.auditLog.length > 0) {
                const mappedLogs = this.widget.auditLog.map(log => ({
                    message: log.message,
                    status: log.type || (log.status ? log.status : 'info'),
                    isLimitation: log.isLimitation || false
                }));
                this.reportData.auditLog.push(...mappedLogs);
            }

            this.logAudit('Strip Slider audit complete.', 'info');
        } catch (e) {
            this.logAudit(`Audit failed due to exception: ${e.message}`, 'fail');
        }
    }

    async validateConfigAgainstUI() {
        const configKeys = [
            'is_show_ratings', 'show_full_review', 'allow_to_display_feed_date',
            'allow_social_redirection', 'cta_enabled', 'allow_to_remove_branding'
        ];

        for (const key of configKeys) {
            const apiValue = this.config[key] ?? 'N/A';
            let uiValue = 'N/A';

            try {
                let locator;
                switch (key) {
                    case 'is_show_ratings':
                        locator = this.widget.context.locator('div.feedspace-video-review-header-wrap > div.feedspace-video-review-header-inner > div.feedspace-video-review-header-star, .feedspace-stars');
                        break;
                    case 'show_full_review':
                        locator = this.widget.context.locator('span:has-text("Read More")');
                        break;
                    case 'allow_to_display_feed_date':
                        locator = this.widget.context.locator('.feedspace-element-date.feedspace-wol-date');
                        break;
                    case 'allow_social_redirection':
                        locator = this.widget.context.locator('div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon');
                        break;
                    case 'cta_enabled':
                        locator = this.widget.context.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content');
                        break;
                    case 'hideBranding':
                    case 'allow_to_remove_branding':
                        locator = this.widget.context.locator('a[href*="utm_source=powered-by-feedspace"]');
                        break;
                    case 'show_platform_icon':
                        locator = this.widget.context.locator('div.feedspace-element-header-icon > a > img');
                        break;
                }

                if (locator) {
                    uiValue = await locator.first().isVisible().catch(() => false) ? "1" : "0";
                }
            } catch (e) {
                uiValue = 'error';
            }

            const status = apiValue.toString() === uiValue.toString() ? 'PASS' : 'FAIL';
            this.reportData.featureResults.push({
                feature: key,
                api_value: apiValue,
                ui_value: uiValue,
                status
            });

            if (status === 'FAIL') {
                this.logAudit(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: FAIL`, 'fail');
            } else {
                this.logAudit(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: PASS`);
            }
        }
    }

    getReportData() {
        return this.reportData;
    }
}

module.exports = { StripSliderValidator };
