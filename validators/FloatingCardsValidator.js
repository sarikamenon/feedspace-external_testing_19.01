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
    }

    logAudit(message, status = 'info', isLimitation = false) {
        this.reportData.auditLog.push({ message, status, isLimitation });
        console.log(`[FloatingCardsValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Floating Cards audit...');
            await this.widget.initContext();
            this.reportData.url = this.page.url();

            // 0️⃣ Validate Visibility (Counts reviews & populates stats)
            await this.widget.validateVisibility().catch(e => this.logAudit(`Visibility failed: ${e.message}`, 'fail'));

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI().catch(e => this.logAudit(`Config mapping failed: ${e.message}`, 'fail'));

            // 2️⃣ Unique behaviors & interactions
            await this.widget.validateUniqueBehaviors().catch(e => this.logAudit(`Unique behaviors failed: ${e.message}`, 'fail'));

            this.logAudit('Floating Cards audit complete.');
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
        this.logAudit('Performing interactive config check (opening popup)...');
        // Open first card to reveal modal elements
        const firstCard = this.page.locator('.feedspace-card.mounted').first();
        const popup = this.page.locator('.fe-review-modal, #fs-global-review-modal-d13').first();

        let popupOpened = false;
        try {
            if (await firstCard.isVisible()) {
                await firstCard.click({ force: true });
                await popup.waitFor({ state: 'visible', timeout: 5000 });
                popupOpened = true;
            }
        } catch (e) {
            this.logAudit(`Could not open popup for config check: ${e.message}`, 'info');
        }

        const { FloatingCardsConfig } = require('../configs/FloatingCardsConfig');
        const configChecker = new FloatingCardsConfig(this.page, this.config);
        const configReport = await configChecker.generateFeatureReport();

        // Close popup if opened
        if (popupOpened) {
            const closeBtn = popup.locator('button.fe-review-modal-close, button[aria-label="Close"], .close-button').first();
            if (await closeBtn.isVisible()) {
                await closeBtn.click();
            } else {
                await this.page.keyboard.press('Escape');
            }
            await popup.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => { });
        }

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

    async generateReport(reportName) {
        this.widget.finalizeAuditCoverage();
        await this.widget.generateReport(reportName);
        return this.getReportData();
    }
}

module.exports = { FloatingCardsValidator };
