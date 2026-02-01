const { Given, When, Then } = require('@cucumber/cucumber');
const { WidgetFactory } = require('../pages/widgets/WidgetFactory');
const individualConfig = require('../testData/individualWidgetConfig.json');
const { expect } = require('@playwright/test');

let currentWidget;
let currentWidgetType;

Given('I initiate testing for {string} widget', async function (widgetType) {
    console.log(`\n[Individual Test] Initiating for: ${widgetType}`);
    this.currentPlatform = 'Browser'; // Default platform

    // Reset module-level variables to ensure fresh widget instance for each scenario
    currentWidget = null;
    currentWidgetType = null;

    // Find config for this specific type
    const widgetData = individualConfig.widgets.find(w => w.type === widgetType);
    if (!widgetData) {
        throw new Error(`Configuration for widget type '${widgetType}' not found in individualWidgetConfig.json`);
    }

    const url = widgetData.url;
    if (!url) {
        throw new Error(`URL not defined for widget type '${widgetType}' in individualWidgetConfig.json`);
    }

    console.log(`[Individual Test] Navigating to: ${url}`);
    await this.page.goto(url, { waitUntil: 'load', timeout: 45000 });
    await this.page.waitForTimeout(2000); // Wait for initialization

    currentWidgetType = widgetType;
});


When('I reload the widget page', async function () {
    console.log(`[Individual Test] Reloading widget page for consistency check...`);
    // Store existing logs and stats to persist across platform re-initialization
    const oldLogs = currentWidget ? [...currentWidget.auditLog] : [];
    const oldFailures = currentWidget ? [...currentWidget.detailedFailures] : [];
    const oldA11y = currentWidget ? [...currentWidget.accessibilityResults] : [];
    const oldStats = currentWidget ? { ...currentWidget.reviewStats } : null;

    await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
    await this.page.waitForTimeout(3000);

    // Re-detect and re-init to ensure fresh context
    currentWidget = await WidgetFactory.detectAndCreate(this.page, currentWidgetType, individualConfig);

    // Restore logs and stats if instance was successfully recreated
    if (currentWidget) {
        currentWidget.auditLog = oldLogs;
        currentWidget.detailedFailures = oldFailures;
        currentWidget.accessibilityResults = oldA11y;
        if (oldStats) currentWidget.reviewStats = oldStats;
    }
    this.currentWidget = currentWidget;
});

Then('the individual framework detects {string}', async function (expectedType) {
    // If widget is already detected (e.g. from a reload step), don't overwrite it
    if (currentWidget && currentWidgetType === expectedType) {
        console.log(`[Individual Test] Widget ${expectedType} already detected and context initialized.`);
        this.currentWidget = currentWidget;
        return;
    }

    currentWidget = await WidgetFactory.detectAndCreate(this.page, expectedType, individualConfig);
    this.currentWidget = currentWidget;

    expect(currentWidget).toBeDefined();
    expect(currentWidgetType).toBe(expectedType);
});

Then('the individual widget should be visible with valid reviews', async function () {
    const widgetData = individualConfig.widgets.find(w => w.type === currentWidgetType);
    const minReviews = widgetData.uiRules.minReviews || 1;
    await currentWidget.validateVisibility(minReviews);
});

Then('the individual widget follows layout and branding guidelines', async function () {
    await currentWidget.validateBranding();
    await currentWidget.validateCTA();
});

Then('I verify individual widget-specific behaviors for {string}', { timeout: 300 * 1000 }, async function (widgetType) {
    if (typeof currentWidget.validateUniqueBehaviors === 'function') {
        await currentWidget.validateUniqueBehaviors();
    }
});

Then('individual user validates card consistency and content', async function () {
    await currentWidget.validateCardConsistency();
});

Then('individual verify that no review dates are undefined', async function () {
    await currentWidget.validateDateConsistency();
});

Then('individual verify that review text is not overflowing', async function () {
    await currentWidget.validateTextReadability();
});

Then('individual verify optional UI elements if present', async function () {
    await currentWidget.validateBranding();
    await currentWidget.validateCTA();
    await currentWidget.validateReadMore();
});

Then('individual user performs generic accessibility audit', async function () {
    await currentWidget.runAccessibilityAudit();
});

Then('individual user validates structural integrity of the widget', async function () {
    await currentWidget.validateLayoutIntegrity();
    await currentWidget.validateAlignment();
});

Then('individual verify that broken media is reported as an error', async function () {
    await currentWidget.validateMediaIntegrity();
});

Then('individual verify widget responsiveness on mobile', async function () {
    this.currentPlatform = 'Mobile';
    await currentWidget.validateResponsiveness('Mobile');
});

Then('I generate the individual final UI audit report for {string}', async function (widgetType) {
    let finalReportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto')
        ? currentWidget.constructor.name.replace('Widget', '')
        : widgetType;

    // BaseWidget.generateReport appends this.reportType automatically
    finalReportName = `Individual_${finalReportName}`;

    await currentWidget.generateReport(finalReportName);

    // Fail the test at the VERY END if there were any failures logged
    const failures = currentWidget.auditLog.filter(l => l.type === 'fail');
    if (failures.length > 0) {
        throw new Error(`Individual Widget Audit Failed with ${failures.length} issues. Check report for details.`);
    }
});

Then('I save the intermediate individual report for {string}', async function (widgetType) {
    let finalReportName = (widgetType === 'DetectedWidget' || widgetType === 'Auto')
        ? currentWidget.constructor.name.replace('Widget', '')
        : widgetType;

    // BaseWidget.generateReport appends this.reportType automatically
    finalReportName = `Individual_${finalReportName}`;

    // Generate but DO NOT throw error yet
    await currentWidget.generateReport(finalReportName);
});
// Granular steps for AvatarSlider
Then('I verify AvatarSlider navigation buttons are functional and correct', async function () {
    await this.currentWidget.validateNavigation();
});

Then('I verify AvatarSlider media loads successfully across slides', async function () {
    await this.currentWidget.validateMediaIntegrity();
});

Then('I verify AvatarSlider review counts and classifications match', async function () {
    await this.currentWidget.validateMediaAndCounts();
});

Then('I verify AvatarSlider branding is displayed and clickable', async function () {
    await this.currentWidget.validateBranding();
});
