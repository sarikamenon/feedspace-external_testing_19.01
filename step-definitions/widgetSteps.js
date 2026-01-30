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
    await this.page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await this.page.waitForTimeout(2000); // Small grace period for late scripts
});

Given('I load the widget URL for type {string}', async function (widgetType) {
    // Keeping this for backward compatibility or direct type testing if needed
    // But now we usually load the single URL from config
    const url = testData.page.url;
    await this.page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await this.page.waitForTimeout(2000);
});

Then('the framework should dynamically detect the widget as {string}', async function (widgetType) {
    currentWidget = await WidgetFactory.detectAndCreate(this.page, widgetType, testData);
    this.currentWidget = currentWidget; // Attach to World for hooks
    expect(currentWidget).toBeDefined();
});

Then('the widget should be visible and contain at least {int} reviews', async function (minReviews) {
    await this.currentWidget.validateVisibility(minReviews);
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('reviews'));
    expect(failures, `Visibility/Review count failures: ${failures.map(f => f.message).join(', ')}`).toHaveLength(0);
});

Then('the widget should follow the layout and branding guidelines', async function () {
    await this.currentWidget.validateBranding();
    await this.currentWidget.validateCTA();
});

Then(/Date Consistency: All review dates appear valid./, async function () {
    await this.currentWidget.validateDateConsistency();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Date Consistency'));
    expect(failures, `Date Consistency failures detected.`).toHaveLength(0);
});

Then(/Layout Integrity: No overlapping cards found./, async function () {
    await this.currentWidget.validateLayoutIntegrity();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Layout Integrity'));
    expect(failures, `Layout Integrity issues detected.`).toHaveLength(0);
});

Then(/Text Readability: No text overflow detected \(all content visible\)./, async function () {
    await this.currentWidget.validateTextReadability();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Text Readability'));
    expect(failures, `Text Readability issues detected.`).toHaveLength(0);
});

Then('I verify the widget-specific unique behaviors for {string}', async function (widgetType) {
    if (typeof this.currentWidget.validateUniqueBehaviors === 'function') {
        await this.currentWidget.validateUniqueBehaviors();
    } else {
        console.log(`No unique behaviors defined for ${widgetType}, skipping.`);
    }
});

Then('I run accessibility audit for the widget', async function () {
    await this.currentWidget.runAccessibilityAudit();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Accessibility'));
    expect(failures, `Accessibility violations detected.`).toHaveLength(0);
});

Then('I verify widget responsiveness on mobile', async function () {
    await this.currentWidget.validateResponsiveness('Mobile');
    await this.currentWidget.validateVisibility();
    await this.currentWidget.validateAlignment();
});



Then('I perform a comprehensive UI audit', async function () {
    console.log('DEBUG: Starting consolidated UI audit...');
    await this.currentWidget.validateVisibility();
    await this.currentWidget.validateBranding();
    await this.currentWidget.validateCTA();
    await this.currentWidget.validateDateConsistency();
    await this.currentWidget.validateLayoutIntegrity();
    await this.currentWidget.validateAlignment();
    await this.currentWidget.validateTextReadability();
    await this.currentWidget.runAccessibilityAudit();
    await this.currentWidget.validateMediaIntegrity();
    await this.currentWidget.validateReadMore();
    await this.currentWidget.validateCardConsistency();

    if (typeof this.currentWidget.validateUniqueBehaviors === 'function') {
        await this.currentWidget.validateUniqueBehaviors();
    }

    // DO NOT throw errors here - let the test continue to mobile testing
    // Errors will be thrown at the final report generation step
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail');
    if (failures.length > 0) {
        console.log(`[AUDIT] Found ${failures.length} failures, but continuing to mobile testing...`);
    }
});

Then('user validates card consistency and content', async function () {
    await this.currentWidget.validateCardConsistency();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Consistency'));
    expect(failures).toHaveLength(0);
});

Then('verify that no review dates are undefined', async function () {
    await this.currentWidget.validateDateConsistency();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Date'));
    expect(failures).toHaveLength(0);
});

Then('verify that review text is not overflowing', async function () {
    await this.currentWidget.validateTextReadability();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Readability'));
    expect(failures).toHaveLength(0);
});

Then('verify optional UI elements if present', async function () {
    await this.currentWidget.validateBranding();
    await this.currentWidget.validateCTA();
});

Then('user performs generic accessibility audit', async function () {
    await this.currentWidget.runAccessibilityAudit();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Accessibility'));
    expect(failures).toHaveLength(0);
});

Then('user validates structural integrity of the widget', async function () {
    await this.currentWidget.validateLayoutIntegrity();
    await this.currentWidget.validateAlignment();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && (l.message.includes('Layout') || l.message.includes('Alignment')));
    expect(failures).toHaveLength(0);
});

Then('verify that broken media is reported as an error', async function () {
    await this.currentWidget.validateMediaIntegrity();
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail' && l.message.includes('Media Integrity'));
    expect(failures).toHaveLength(0);
});

Then('I save the intermediate report for {string}', async function (widgetType) {
    const reportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto')
        ? this.currentWidget.constructor.name.replace('Widget', '')
        : widgetType;

    // Generate but DO NOT throw error yet (similar to individual flow)
    await this.currentWidget.generateReport(reportName);
});

Then('I generate the final UI audit report for {string}', async function (widgetType) {
    const finalReportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto')
        ? this.currentWidget.constructor.name.replace('Widget', '')
        : widgetType;
    await this.currentWidget.generateReport(finalReportName);

    // Fail the test if there were any failures logged (similar to individual flow)
    const failures = this.currentWidget.auditLog.filter(l => l.type === 'fail');
    if (failures.length > 0) {
        throw new Error(`Widget Audit Failed for ${finalReportName} with ${failures.length} issues. Check report for details.`);
    }
});
