const { Given, When, Then } = require('@cucumber/cucumber');
const { WidgetFactory } = require('../pages/widgets/WidgetFactory');
const { expect } = require('@playwright/test');
const XLSX = require('xlsx');
const path = require('path');

let widgetDataList = [];

Given('I read the widget URLs from {string}', function (filePath) {
    const fullPath = path.resolve(filePath);
    console.log(`[Multi-URL] Reading Excel file from: ${fullPath}`);
    const workbook = XLSX.readFile(fullPath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    widgetDataList = XLSX.utils.sheet_to_json(sheet);
    console.log(`[Multi-URL] Loaded ${widgetDataList.length} URLs for testing.`);
});

Then('I sequentially validate each widget URL', { timeout: 3600 * 1000 }, async function () {
    for (const data of widgetDataList) {
        const url = data.Url;
        const websiteName = data.WebsiteName;

        console.log(`\n==================================================`);
        console.log(`[Multi-URL] Starting test for: ${websiteName} (${url})`);
        console.log(`==================================================\n`);

        try {
            // 1. Load URL
            await loadWidgetUrl(this.page, url);

            // 2. Detect Widget
            const detectedInstances = await WidgetFactory.detectAndCreate(this.page, 'Auto', { widgets: [] }); // Empty config as we autodect
            if (detectedInstances.length === 0) {
                console.warn(`[Multi-URL] No Feedspace widgets detected on ${url}`);
                // Create a "Not Found" report to inform the user
                const dummyWidget = WidgetFactory.createInstance('Base', this.page, { type: 'Base', uiRules: {} });
                dummyWidget.logAudit(`Feedspace widget not embedded or detected on this URL: ${url}`, 'fail');
                await dummyWidget.generateReport('NotFound', websiteName);
                console.log(`[Multi-URL] Generated "NotFound" report for ${websiteName}`);
                continue; // Move to next URL immediately
            }
            console.log(`[Multi-URL] Detected ${detectedInstances.length} widgets.`);

            // 3. Validate & Audit
            for (const widget of detectedInstances) {
                const widgetName = widget.constructor.name;
                console.log(`[Multi-URL] Validating ${widgetName}...`);

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

                // Specialized HorizontalScroll Checks (matching @Individual_HorizontalScroll)
                if (widgetName === 'HorizontalScrollWidget') {
                    console.log('[Multi-URL] [HorizontalScroll] Verifying specialized scrolling behavior...');
                    await widget.validateHorizontalScrolling();

                    console.log('[Multi-URL] [HorizontalScroll] Verifying specialized review counts & classifications...');
                    await widget.validateReviewCountsAndTypes();
                }

                if (typeof widget.validateUniqueBehaviors === 'function' && widgetName !== 'HorizontalScrollWidget') {
                    await widget.validateUniqueBehaviors();
                }

                // 4. Generate Report (Browser)
                const typeName = widgetName.replace('Widget', '');
                await widget.generateReport(typeName, websiteName);
            }

            // 5. Persistence Check (Reload)
            console.log(`[Multi-URL] Verifying persistence via reload...`);
            // Capture state
            const savedStates = detectedInstances.map(w => ({
                type: w.constructor.name,
                auditLog: [...w.auditLog],
                reviewStats: { ...w.reviewStats },
                detailedFailures: [...w.detailedFailures], // Ensure failures are saved
                accessibilityResults: [...w.accessibilityResults] // Ensure A11y is saved
            }));

            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(3000);

            // Re-detect
            const newWidgets = await WidgetFactory.detectAndCreate(this.page, 'Auto', { widgets: [] });

            // Restore state for final report if new instances found
            newWidgets.forEach(newWidget => {
                const saved = savedStates.find(s => s.type === newWidget.constructor.name);
                if (saved) {
                    newWidget.auditLog = saved.auditLog;
                    newWidget.reviewStats = saved.reviewStats;
                    newWidget.detailedFailures = saved.detailedFailures;
                    newWidget.accessibilityResults = saved.accessibilityResults;
                }
            });

            // 6. Mobile Responsiveness
            for (const widget of newWidgets) {
                await widget.validateResponsiveness('Mobile');
            }

            // 7. Final Report (Mobile)
            for (const widget of newWidgets) {
                const typeName = widget.constructor.name.replace('Widget', '');
                await widget.generateReport(typeName, websiteName);
            }

        } catch (error) {
            console.error(`[Multi-URL] Failed testing ${url}: ${error.message}`);
        }
    }
});

async function loadWidgetUrl(page, url) {
    console.log(`Navigating to widget URL: ${url}`);
    const maxRetries = 3;
    let attempts = 0;
    let loaded = false;

    while (attempts < maxRetries && !loaded) {
        attempts++;
        try {
            console.log(`[Dynamic Test] Navigation attempt ${attempts}/${maxRetries}...`);
            await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
            loaded = true;
            console.log(`[Dynamic Test] Navigation successful.`);
        } catch (error) {
            console.warn(`[Dynamic Test] Navigation failed (attempt ${attempts}): ${error.message}`);
            if (page.isClosed()) throw new Error('Browser closed during navigation retry.');
            if (attempts === maxRetries) throw error;
            await page.waitForTimeout(3000);
        }
    }
    await page.waitForTimeout(2000);
}
