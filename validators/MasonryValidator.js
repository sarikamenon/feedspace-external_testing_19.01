const { MasonryWidget } = require('../pages/widgets/MasonryWidget');

class MasonryValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new MasonryWidget(page, config);
    }

    async runFullAudit() {
        console.log('[Validator] Starting full Masonry audit...');
        await this.widget.initContext();
        await this.widget.validateUniqueBehaviors();
        await this.widget.runAccessibilityAudit();
        console.log('[Validator] Masonry audit complete.');
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

module.exports = { MasonryValidator };
