const { StripSliderWidget } = require('../pages/widgets/StripSliderWidget');

class StripSliderValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new StripSliderWidget(page, config);
    }

    async runFullAudit() {
        console.log('[Validator] Starting full Strip Slider audit...');
        await this.widget.initContext();
        await this.widget.validateUniqueBehaviors();
        await this.widget.runAccessibilityAudit();
        console.log('[Validator] Strip Slider audit complete.');
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

module.exports = { StripSliderValidator };
