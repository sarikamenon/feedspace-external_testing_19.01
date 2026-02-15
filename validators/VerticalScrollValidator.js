const { VerticalScrollWidget } = require('../pages/widgets/VerticalScrollWidget');

class VerticalScrollValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new VerticalScrollWidget(page, config);
    }

    async runFullAudit() {
        console.log('[Validator] Starting full Vertical Scroll audit...');

        await this.widget.initContext();

        const minReviews = this.config.uiRules?.minReviews || 1;
        await this.widget.validateVisibility(minReviews);

        // VerticalScrollWidget has a comprehensive wrapper method
        await this.widget.validateUniqueBehaviors();

        await this.widget.runAccessibilityAudit();

        console.log('[Validator] Vertical Scroll audit complete.');
    }

    async generateReport(reportName) {
        this.widget.finalizeAuditCoverage();
        await this.widget.generateReport(reportName);
        return this.widget.getReportData();
    }

    getReportData() {
        return this.widget.getReportData();
    }
}

module.exports = { VerticalScrollValidator };
