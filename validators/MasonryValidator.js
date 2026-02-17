const { MasonryWidget } = require('../pages/widgets/MasonryWidget');

class MasonryValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new MasonryWidget(page, config);

        // Consolidated report
        this.reportData = {
            widget: 'Masonry',
            url: page.url(),
            auditLog: [],
            featureResults: [],
            reviewStats: {},
            summary: { total: 0, pass: 0, fail: 0 }
        };
    }

    logAudit(message, status = 'info', isLimitation = false) {
        this.reportData.auditLog.push({ message, status, isLimitation });
        console.log(`[MasonryValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Masonry audit...');
            await this.widget.initContext();
            this.reportData.url = this.page.url();

            // 0️⃣ Validate Visibility (Counts reviews & populates stats)
            await this.widget.validateVisibility().catch(e => this.logAudit(`Visibility failed: ${e.message}`, 'fail'));

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI().catch(e => this.logAudit(`Config mapping failed: ${e.message}`, 'fail'));

            // 2️⃣ Unique behaviors & interactions
            await this.widget.validateUniqueBehaviors().catch(e => this.logAudit(`Unique behaviors failed: ${e.message}`, 'fail'));

            this.logAudit('Masonry audit complete.');
        } catch (e) {
            this.logAudit(`Critical audit exception: ${e.message}`, 'fail');
        } finally {
            // ALWAYS merge data from widget
            this.reportData.reviewStats = this.widget.reviewStats || {};
            this.reportData.detailedFailures = this.widget.detailedFailures || [];
            this.reportData.accessibilityResults = this.widget.accessibilityResults || [];

            if (this.widget.auditLog && this.widget.auditLog.length > 0) {
                const mappedLogs = this.widget.auditLog.map(log => ({
                    message: log.message,
                    status: log.type || (log.status ? log.status : 'info'),
                    isLimitation: log.isLimitation || false
                }));
                this.reportData.auditLog.push(...mappedLogs);
            }
        }
    }

    async validateConfigAgainstUI() {
        // Instantiate the config checker to use its synchronized locators and logic
        const { MasonryConfig } = require('../configs/MasonryConfig');
        const configChecker = new MasonryConfig(this.widget.context, this.config);
        const configReport = await configChecker.generateFeatureReport();

        // Map configChecker results to validator's reportData
        for (const res of configReport) {
            this.reportData.featureResults.push({
                feature: res.feature,
                api_value: res.api_value,
                ui_value: res.ui_value,
                status: res.status
            });

            const logStatus = res.status === 'PASS' ? 'info' : 'fail';
            this.logAudit(`Feature: ${res.feature}, API: ${res.api_value}, UI: ${res.ui_value}, Status: ${res.status}${res.info ? ` (${res.info})` : ''}`, logStatus);
        }
    }

    getReportData() {
        return this.reportData;
    }
}

module.exports = { MasonryValidator };
