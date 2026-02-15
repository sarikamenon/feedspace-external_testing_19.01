const { HorizontalScrollWidget } = require('../pages/widgets/HorizontalScrollWidget');

class HorizontalScrollValidator {
    /**
     * @param {import('playwright').Page} page
     * @param {Object} config - widget-specific config (e.g., uiRules, type)
     */
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new HorizontalScrollWidget(page, config);
    }

    /**
     * Run all base validations for Horizontal Scroll Widget
     */
    async runFullAudit() {
        console.log('[Validator] Starting full Horizontal Scroll audit...');

        await this.widget.initContext();

        // Visibility & minimum reviews
        const minReviews = this.config.uiRules?.minReviews || 1;
        await this.widget.validateVisibility(minReviews);

        // Branding & CTA
        await this.widget.validateBranding();
        await this.widget.validateCTA();

        // Horizontal scrolling
        await this.widget.validateHorizontalScrolling();

        // Media integrity
        await this.widget.validateMediaIntegrity();

        // Review counts & classification
        await this.widget.validateReviewCountsAndTypes();

        // Read More / Read Less
        await this.widget.validateReadMoreExpansion();

        // Text readability / truncation
        await this.widget.validateTextReadability();

        // Card & layout integrity
        await this.widget.validateCardConsistency();
        await this.widget.validateLayoutIntegrity();
        await this.widget.validateAlignment();

        // Accessibility audit
        await this.widget.runAccessibilityAudit();

        // Mobile responsiveness
        await this.widget.validateResponsiveness('Mobile');

        console.log('[Validator] Horizontal Scroll audit complete.');
    }

    /**
     * Generate report using existing widget method
     */
    async generateReport(reportName) {
        this.widget.finalizeAuditCoverage();
        await this.widget.generateReport(reportName);
        return this.widget.getReportData();
    }

    /**
     * Access audit logs directly if needed
     */
    getDisplayData() {
        return this.widget.getReportData();
    }

    get auditLog() {
        return this.widget.auditLog;
    }

    get detailedFailures() {
        return this.widget.detailedFailures;
    }

    get reviewStats() {
        return this.widget.reviewStats;
    }

    // Proxy specifically for apiDrivenSteps to get data comfortably
    getReportData() {
        return this.widget.getReportData();
    }
}

module.exports = { HorizontalScrollValidator };
