const { Given, When, Then } = require('@cucumber/cucumber');
const { WidgetFactory } = require('../pages/widgets/WidgetFactory');
const testData = require('../testData/widgetConfig.json');
console.log('CONFIRMED: Loaded configuration from testData/widgetConfig.json');
const { expect } = require('@playwright/test');

let currentWidget;

Given('I load the widget URL', async function () {
    const url = testData.page.url;
    if (!url) {
        throw new Error(`No URL found in widgetConfig.json`);
    }
    console.log(`Navigating to widget URL: ${url}`);

    const maxRetries = 3;
    let attempts = 0;
    let loaded = false;

    while (attempts < maxRetries && !loaded) {
        attempts++;
        try {
            console.log(`[Dynamic Test] Navigation attempt ${attempts}/${maxRetries}...`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            loaded = true;
            console.log(`[Dynamic Test] Navigation successful.`);
        } catch (error) {
            console.warn(`[Dynamic Test] Navigation failed (attempt ${attempts}): ${error.message}`);
            if (this.page.isClosed()) {
                throw new Error('Browser closed during navigation retry.');
            }
            if (attempts === maxRetries) throw error;
            await this.page.waitForTimeout(3000);
        }
    }

    await this.page.waitForTimeout(2000); // Small grace period for late scripts
});

Then('the framework should dynamically detect the widget as {string}', async function (widgetType) {
    const detectedInstances = await WidgetFactory.detectAndCreate(this.page, widgetType, testData);
    this.detectedWidgets = detectedInstances; // Store array
    expect(this.detectedWidgets.length).toBeGreaterThan(0);
    console.log(`[Dynamic Test] Detected ${this.detectedWidgets.length} widgets.`);
});

Then('the widget should be visible and contain at least {int} reviews', async function (minReviews) {
    for (const widget of this.detectedWidgets) {
        console.log(`[Validation] Checking visibility for ${widget.constructor.name}`);
        await widget.validateVisibility(minReviews);
        const failures = widget.auditLog.filter(l => l.type === 'fail' && l.message.includes('reviews'));
        expect(failures, `[${widget.constructor.name}] Visibility failures: ${failures.map(f => f.message).join(', ')}`).toHaveLength(0);
    }
});

Then('the widget should follow the layout and branding guidelines', async function () {
    for (const widget of this.detectedWidgets) {
        await widget.validateBranding();
        await widget.validateCTA();
    }
});

Then('I perform a comprehensive UI audit', { timeout: 600 * 1000 }, async function () {
    console.log('DEBUG: Starting consolidated UI audit for ALL detected widgets...');

    for (const widget of this.detectedWidgets) {
        // This single call now handles all base audits and specialized unique behaviors
        await widget.performComprehensiveAudit();
    }
});

Then('I save the intermediate report for {string}', async function (widgetType) {
    for (const widget of this.detectedWidgets) {
        const typeName = widget.constructor.name.replace('Widget', '');
        const reportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto') ? typeName : widgetType;
        await widget.generateReport(reportName);
    }
});

When('I reload the page to verify persistence', async function () {
    console.log(`[Dynamic Test] Reloading page to verify persistence...`);

    // 1. Capture state of existing widgets
    const savedStates = this.detectedWidgets.map(w => ({
        type: w.constructor.name,
        auditLog: [...w.auditLog],
        detailedFailures: [...w.detailedFailures],
        accessibilityResults: [...w.accessibilityResults],
        reviewStats: { ...w.reviewStats }
    }));

    // 2. Reload
    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(3000);

    // 3. Re-detect widgets on the refreshed page
    const newWidgets = await WidgetFactory.detectAndCreate(this.page, 'Auto', testData);

    if (newWidgets.length === 0) {
        console.warn('[Dynamic Test] Warning: No widgets detected after reload.');
    }

    // 4. Map saved state to new instances
    // Logic: Try to match by type. If multiple of same type, assume order is preserved.
    this.detectedWidgets = newWidgets.map((newWidget, index) => {
        // Find a matching saved state
        const savedState = savedStates.find(s => s.type === newWidget.constructor.name);

        if (savedState) {
            console.log(`[Dynamic Test] Restoring state for ${newWidget.constructor.name}`);
            newWidget.auditLog = savedState.auditLog;
            newWidget.detailedFailures = savedState.detailedFailures;
            newWidget.accessibilityResults = savedState.accessibilityResults;
            newWidget.reviewStats = savedState.reviewStats; // Restore stats!

            // Remove used state to avoid double-assignment if strict order
            // (Optional: simple finding is robust enough for unique widget types)
        } else {
            console.log(`[Dynamic Test] New widget detected after reload: ${newWidget.constructor.name} (No prior state found)`);
        }
        return newWidget;
    });
});

Then('I verify widget responsiveness on mobile', async function () {
    for (const widget of this.detectedWidgets) {
        await widget.validateResponsiveness('Mobile');
        // Do NOT call validateVisibility() here again without care, as it might reset stats if page state is flaky.
        // BaseWidget.validateResponsiveness() calls logAudit but doesn't reset stats.
        // However, we might want to ensure the widget is still present.
        const isVisible = await widget.context.locator(widget.containerSelector).first().isVisible().catch(() => false);
        if (!isVisible) {
            widget.logAudit('Responsiveness: Widget container not found after reload/resize.', 'fail');
        }
    }
});

Then('I generate the final UI audit report for {string}', async function (widgetType) {
    let totalFailures = 0;

    for (const widget of this.detectedWidgets) {
        const typeName = widget.constructor.name.replace('Widget', '');
        const finalReportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto') ? typeName : widgetType;

        widget.finalizeAuditCoverage();
        await widget.generateReport(finalReportName);

        const failures = widget.auditLog.filter(l => l.type === 'fail');
        totalFailures += failures.length;
    }

    if (totalFailures > 0) {
        throw new Error(`Widget Audit Failed with ${totalFailures} total issues across widgets. Check reports for details.`);
    }
});
