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

    // Diagnostic logging
    this.page.on('console', msg => {
        if (msg.type() === 'error') console.log(` [BROWSER ERROR] ${msg.text()}`);
    });

    const maxRetries = 3;
    let attempts = 0;
    let loaded = false;

    while (attempts < maxRetries && !loaded) {
        attempts++;
        try {
            console.log(`[Individual Test] Navigation attempt ${attempts}/${maxRetries}...`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            loaded = true;
            console.log(`[Individual Test] Navigation successful.`);
        } catch (error) {
            console.warn(`[Individual Test] Navigation failed (attempt ${attempts}): ${error.message}`);
            if (this.page.isClosed()) {
                throw new Error('Browser closed during navigation retry.');
            }
            if (attempts === maxRetries) throw error;
            await this.page.waitForTimeout(3000);
        }
    }

    if (this.page.isClosed()) return;

    const pageTitle = await this.page.title().catch(() => 'Unknown');
    console.log(`[Individual Test] Current Title: "${pageTitle}"`);

    await this.page.waitForSelector('body', { timeout: 10000 }).catch(() => console.error('Body NOT found!'));
    await this.page.waitForTimeout(10000);
    console.log(`[Individual Test] Finished initialization wait.`);

    // Debug screenshot to see what's loaded
    await this.page.screenshot({ path: `reports/debug_after_wait_${widgetType}.png` }).catch(() => { });

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
    const typeHint = typeof currentWidgetType !== 'undefined' ? currentWidgetType : 'Auto';
    const widgets = await WidgetFactory.detectAndCreate(this.page, typeHint, individualConfig);
    currentWidget = widgets.find(w => w.constructor.name.toLowerCase().includes(typeHint.toLowerCase())) || widgets[0];

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

    const widgets = await WidgetFactory.detectAndCreate(this.page, expectedType, individualConfig);
    // Strict matching: find matching type.
    currentWidget = widgets.find(w => w.constructor.name.toLowerCase().includes(expectedType.toLowerCase()));

    if (!currentWidget && widgets.length > 0) {
        console.warn(`[Individual Test] Expected ${expectedType} but detection found: ${widgets.map(w => w.constructor.name).join(', ')}. Falling back to first detected.`);
        currentWidget = widgets[0];
    }

    this.currentWidget = currentWidget;

    if (!currentWidget) {
        console.error(`[Individual Test] Error: Widget ${expectedType} was not detected.`);
    }
    if (currentWidgetType !== expectedType) {
        console.warn(`[Individual Test] Warning: Expected ${expectedType} but found ${currentWidgetType}`);
    }
});

Then('the individual widget should be visible with valid reviews', { timeout: 120 * 1000 }, async function () {
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

Then('individual verify that review text is not overflowing', { timeout: 120 * 1000 }, async function () {
    await currentWidget.validateTextReadability();
});

Then('individual verify optional UI elements if present', async function () {
    await currentWidget.validateBranding();
    await currentWidget.validateCTA();
    await currentWidget.validateReadMore();
});

Then('individual user performs generic accessibility audit', { timeout: 120 * 1000 }, async function () {
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
        console.error('--- AUDIT FAILURES DETECTED ---');
        failures.forEach(f => console.error(`[FAIL] ${f.message}`));
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

Then('I verify AvatarSlider review counts and classifications match', { timeout: 120 * 1000 }, async function () {
    await this.currentWidget.validateMediaAndCounts();
});

Then('I verify AvatarSlider branding is displayed and clickable', async function () {
    await this.currentWidget.validateBranding();
});

// Granular steps for VerticalScroll
Then('I verify VerticalScroll scrolling behavior is smooth and continuous', async function () {
    await this.currentWidget.validateVerticalScrolling();
});

Then('I verify VerticalScroll media loads and plays correctly', async function () {
    await this.currentWidget.validateMediaIntegrity();
    if (typeof this.currentWidget.validateMediaPlayback === 'function') {
        await this.currentWidget.validateMediaPlayback();
    }
});

Then(/^I verify VerticalScroll Read More\/Read Less functionality$/, { timeout: 60 * 1000 }, async function () {
    await this.currentWidget.validateReadMoreExpansion();
});

Then('I verify VerticalScroll review counts and classifications match', async function () {
    await this.currentWidget.validateReviewCountsAndTypes();
});


// Granular steps for HorizontalScroll
Then('I verify HorizontalScroll scrolling behavior is smooth and continuous', async function () {
    await this.currentWidget.validateHorizontalScrolling();
});

Then('I verify HorizontalScroll media loads and plays correctly', async function () {
    await this.currentWidget.validateMediaIntegrity();
});

Then('I verify HorizontalScroll review counts and classifications match', async function () {
    await this.currentWidget.validateReviewCountsAndTypes();
});

Then(/^I verify HorizontalScroll Read More\/Read Less functionality$/, { timeout: 60 * 1000 }, async function () {
    await this.currentWidget.validateReadMoreExpansion();
});

// Granular steps for Floating Widget
Then('I verify Floating Widget container loads successfully', async function () {
    await this.currentWidget.validateFloatingWidgetLoading();
});

Then('I verify Floating Widget popup sequence and interaction', { timeout: 600 * 1000 }, async function () {
    await this.currentWidget.validatePopupSequence();
});

Then('I verify Floating Widget media playback and loading', { timeout: 120 * 1000 }, async function () {
    await this.currentWidget.validateMediaPlayback();
});

Then(/^I verify Floating Widget Read More \/ Read Less functionality$/, { timeout: 60 * 1000 }, async function () {
    await this.currentWidget.validateReadMoreExpansion();
});

Then('I verify Floating Widget review counts and classifications', async function () {
    await this.currentWidget.validateReviewCountsAndTypes();
});

