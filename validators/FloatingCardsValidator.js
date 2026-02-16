const { FloatingCardsWidget } = require('../pages/widgets/FloatingCardsWidget');

class FloatingCardsValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new FloatingCardsWidget(page, config);

        // Consolidated report
        this.reportData = {
            widget: 'FloatingCards',
            url: page.url(),
            auditLog: [],
            featureResults: [],
            reviewStats: {},
            detailedFailures: [],
            accessibilityResults: [],
            summary: { total: 0, pass: 0, fail: 0 }
        };
        this.logAudit('Detailed Audit results for FloatingCards Widget', 'info');
    }

    logAudit(message, status = 'info') {
        this.reportData.auditLog.push({ message, status });
        console.log(`[FloatingCardsValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Floating Cards audit...', 'info');

            await this.widget.initContext();

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI();

            // 2️⃣ Unique behaviors & interactions (includes Popups, Read More, etc.)
            await this.widget.validateUniqueBehaviors();

            // 3️⃣ Finalize stats and failures
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

            this.logAudit('Floating Cards audit complete.', 'info');
        } catch (e) {
            this.logAudit(`Audit failed due to exception: ${e.message}`, 'fail');
        }
    }

    async validateConfigAgainstUI() {
        const configKeys = [
            'is_show_ratings', 'show_full_review', 'allow_to_display_feed_date',
            'show_platform_icon', 'cta_enabled', 'allow_to_remove_branding'
        ];

        for (const key of configKeys) {
            const apiValue = this.config[key] ?? 'N/A';
            let uiValue = 'N/A';

            try {
                let locator;
                switch (key) {
                    case 'is_show_ratings':
                        locator = this.widget.context.locator(`div.feedspace-element-feed-box-inner > div.feedspace-element-review-box > svg`);
                        break;
                    case 'show_full_review':
                        // User specifically mapped this to read-less-btn structure in Config snippet
                        locator = this.widget.context.locator('.feedspace-read-less-btn.feedspace-element-read-more.feedspace-element-read-more-open');
                        break;
                    case 'allow_to_display_feed_date':
                        locator = this.widget.context.locator('.feedspace-element-date.feedspace-wol-date');
                        break;
                    case 'show_platform_icon':
                        locator = this.widget.context.locator(`div.feedspace-element-header-icon > a > img`);
                        break;
                    case 'cta_enabled':
                        locator = this.widget.context.locator(`.feedspace-cta-button-container-d13`);
                        break;
                    case 'allow_to_remove_branding':
                    case 'hideBranding':
                        locator = this.widget.context.locator('a[title="Capture reviews with Feedspace"]');
                        break;
                }

                if (locator) {
                    // check existence in DOM (isVisible on first element)
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

    async generateReport(reportName) {
        this.widget.finalizeAuditCoverage();
        await this.widget.generateReport(reportName);
        return this.getReportData();
    }
}

module.exports = { FloatingCardsValidator };
