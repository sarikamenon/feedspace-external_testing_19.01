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
        const widgetName = widget.constructor.name;
        console.log(`\n[AUDIT] Starting audit for: ${widgetName}`);
        try {

            await widget.validateVisibility();
            await widget.validateBranding();
            await widget.validateCTA();
            await widget.validateDateConsistency();
            await widget.validateLayoutIntegrity();
            await widget.validateAlignment();
            await widget.validateTextReadability();
            await widget.runAccessibilityAudit();
            await widget.validateMediaIntegrity();
            await widget.validateReadMore();
            await widget.validateCardConsistency();

            if (typeof widget.validateUniqueBehaviors === 'function') {
                await widget.validateUniqueBehaviors();
            }
        } catch (error) {
            console.error(`[AUDIT] Critical error during audit for ${widgetName}: ${error.message}`);
            widget.logAudit(`Critical Audit Failure: ${error.message}`, 'fail');
        }

        const failures = widget.auditLog.filter(l => l.type === 'fail');
        if (failures.length > 0) {
            console.log(`[AUDIT] Found ${failures.length} failures for ${widgetName}, continuing...`);
        }
    }
});

Then('I save the intermediate report for {string}', async function (widgetType) {
    for (const widget of this.detectedWidgets) {
        const typeName = widget.constructor.name.replace('Widget', '');
        const reportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto') ? typeName : widgetType;
        await widget.generateReport(reportName);
    }
});

Then('I verify widget responsiveness on mobile', async function () {
    for (const widget of this.detectedWidgets) {
        await widget.validateResponsiveness('Mobile');
        await widget.validateVisibility();
        await widget.validateAlignment();
    }
});

Then('I generate the final UI audit report for {string}', async function (widgetType) {
    let totalFailures = 0;

    for (const widget of this.detectedWidgets) {
        const typeName = widget.constructor.name.replace('Widget', '');
        const finalReportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto') ? typeName : widgetType;

        await widget.generateReport(finalReportName);

        const failures = widget.auditLog.filter(l => l.type === 'fail');
        totalFailures += failures.length;
    }

    if (totalFailures > 0) {
        throw new Error(`Widget Audit Failed with ${totalFailures} total issues across widgets. Check reports for details.`);
    }
});
