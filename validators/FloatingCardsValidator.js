const { FloatingCardsWidget } = require('../pages/widgets/FloatingCardsWidget');

class FloatingCardsValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new FloatingCardsWidget(page, config);
    }

    async runFullAudit() {
        console.log('[Validator] Starting full Floating Cards audit...');
        await this.widget.initContext();

        // Correct order of validations as per FloatingCardsWidget.js
        await this.widget.validateUniqueBehaviors();

        await this.widget.runAccessibilityAudit();

        console.log('[Validator] Floating Cards audit complete.');
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

module.exports = { FloatingCardsValidator };
