const { AvatarGroupWidget } = require('../pages/widgets/AvatarGroupWidget');
const fs = require('fs');
const path = require('path');

class AvatarGroupValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new AvatarGroupWidget(page, config);

        // Consolidated report
        this.reportData = {
            widget: 'AvatarGroup',
            url: page.url(),
            auditLog: [],
            featureResults: [],
            reviewStats: {},
            summary: { total: 0, pass: 0, fail: 0 }
        };
    }

    logAudit(message, status = 'info') {
        this.reportData.auditLog.push({ message, status });
        console.log(`[AvatarGroupValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Avatar Group audit...');

            await this.widget.initContext();

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI();

            // 2️⃣ Unique behaviors & modal interactions
            await this.widget.validateUniqueBehaviors();

            // 3️⃣ Media integrity checks
            await this.widget.validateMediaIntegrity();

            // 4️⃣ Layout checks
            await this.widget.validateLayoutIntegrity();

            // 5️⃣ Accessibility (contrast / read more)
            await this.widget.runAccessibilityAudit();

            // Include review stats from widget
            this.reportData.reviewStats = this.widget.reviewStats || {};

            // Merge widget's internal audit logs into the main report
            if (this.widget.auditLog && this.widget.auditLog.length > 0) {
                const mappedLogs = this.widget.auditLog.map(log => ({
                    message: log.message,
                    status: log.type || (log.status ? log.status : 'info'),
                    isLimitation: log.isLimitation || false
                }));
                this.reportData.auditLog.push(...mappedLogs);
            }

            this.logAudit('Avatar Group audit complete.');
        } catch (e) {
            this.logAudit(`Audit failed due to exception: ${e.message}`, 'fail');
        }
    }

    async validateConfigAgainstUI() {
        const configKeys = [
            'is_show_ratings', 'show_full_review', 'allow_to_display_feed_date',
            'allow_social_redirection', 'cta_enabled', 'hideBranding',
            'show_avatar_border', 'avatar_border_color', 'widget_position',
            'number_of_review_text', 'card_hover_color', 'is_show_indicators'
        ];

        for (const key of configKeys) {
            const apiValue = this.config[key] ?? 'N/A';
            let uiValue = 'N/A';

            try {
                let locator;
                switch (key) {
                    case 'is_show_ratings':
                        locator = this.widget.context.locator('.feedspace-stars, .star-rating');
                        break;
                    case 'show_full_review':
                        locator = this.widget.context.locator('.feedspace-read-more-btn, i:has-text("Read More")');
                        break;
                    case 'allow_to_display_feed_date':
                        locator = this.widget.context.locator('.feedspace-element-date, .feedspace-wol-date');
                        break;
                    case 'allow_social_redirection':
                        locator = this.widget.context.locator('.social-redirection-button img');
                        break;
                    case 'cta_enabled':
                        locator = this.widget.context.locator('.feedspace-cta-button-container-d9');
                        break;
                    case 'hideBranding':
                    case 'allow_to_remove_branding':
                        locator = this.widget.context.locator('a[href*="utm_source=powered-by-feedspace"]');
                        break;
                    default:
                        locator = null;
                }

                if (locator && (await locator.count()) > 0) {
                    uiValue = (await locator.first().isVisible()) ? '1' : '0';
                }
            } catch (e) {
                uiValue = 'error';
            }

            const status = apiValue.toString() === uiValue.toString() ? 'PASS' : 'FAIL';
            this.reportData.featureResults.push({ feature: key, api_value: apiValue, ui_value: uiValue, status });
            this.logAudit(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: ${status}`, status === 'FAIL' ? 'fail' : 'info');

            // Update summary
            this.reportData.summary.total++;
            if (status === 'PASS') this.reportData.summary.pass++;
            else this.reportData.summary.fail++;
        }
    }

    async generateReport(reportName = 'AvatarGroupReport.json') {
        try {
            const filePath = path.join(process.cwd(), reportName);
            fs.writeFileSync(filePath, JSON.stringify(this.reportData, null, 2), 'utf-8');
            this.logAudit(`Report generated: ${filePath}`);
        } catch (e) {
            this.logAudit(`Failed to write report: ${e.message}`, 'fail');
        }
    }

    getReportData() {
        return this.reportData;
    }
}

module.exports = { AvatarGroupValidator };
