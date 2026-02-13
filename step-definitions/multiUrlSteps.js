const { Given, When, Then } = require('@cucumber/cucumber');
const { WidgetFactory } = require('../pages/widgets/WidgetFactory');
const { SheetUtils } = require('../utils/SheetUtils');
const path = require('path');
const fs = require('fs');

let widgetDataList = [];

// Helper to load config
const getSheetConfig = (configPath) => {
    const fullPath = path.resolve(configPath);
    return JSON.parse(fs.readFileSync(fullPath, 'utf8'));
};

Given('I fetch the list of customer URLs from {string}', async function (source) {
    if (source === 'GoogleSheet') {
        const config = getSheetConfig('testData/googleSheetConfig.json');
        console.log(`[Multi-URL] Fetching customer URLs from Google Sheet: ${config.sheetUrl}`);
        try {
            widgetDataList = await SheetUtils.fetchGoogleSheet(config.sheetUrl);
            console.log(`[Multi-URL] Successfully fetched ${widgetDataList.length} URLs from Google Sheet.`);
        } catch (e) {
            console.error(`[Multi-URL] Error fetching from Google Sheet: ${e.message}`);
            throw e;
        }
    } else {
        console.log(`[Multi-URL] Fetching from source: ${source}`);
    }
});


Then('I sequentially process each URL by executing the following workflow:', { timeout: 300 * 60 * 1000 }, async function (dataTable) {
    const steps = dataTable.rows().flat();
    console.log(`[Multi-URL] Starting sequential audit for ${widgetDataList.length} URLs with workflow:`);
    steps.forEach(step => console.log(`  - ${step}`));

    for (let i = 0; i < widgetDataList.length; i++) {
        console.log(`[Multi-URL] Processing URL ${i + 1} of ${widgetDataList.length}`);
        const data = widgetDataList[i];
        // Normalize keys (handle 'Url', 'URL', 'url', or 'Widget Link')
        const url = data.Url || data.URL || data.url || data['Widget Link'] || data['WidgetLink'];

        // Extract website name or domain as fallback
        let websiteName = data.WebsiteName || data.Name;
        if (!websiteName && url) {
            try {
                const domain = new URL(url).hostname.replace('www.', '').split('.')[0];
                websiteName = domain.charAt(0).toUpperCase() + domain.slice(1);
            } catch (e) {
                websiteName = `Site_${i + 1}`;
            }
        }
        websiteName = websiteName || `Site_${i + 1}`;

        if (!url) {
            console.warn(`[Multi-URL] Skipping row ${i + 1} due to missing URL.`);
            continue;
        }

        console.log(`\n==================================================`);
        console.log(`>>> [URL ${i + 1}/${widgetDataList.length}] ${websiteName}`);
        console.log(`>>> Target: ${url}`);
        console.log(`==================================================\n`);

        try {
            // 0. Reset Viewport to Desktop (ensure clean state)
            await this.page.setViewportSize({ width: 1280, height: 800 });

            // 1. Load URL
            await loadWidgetUrl(this.page, url);

            // 2. Detect Widgets
            const detectedInstances = await WidgetFactory.detectAndCreate(this.page, 'Auto', { widgets: [] });

            if (detectedInstances.length === 0) {
                console.warn(`[Multi-URL] No Feedspace widgets detected on ${url}`);
                // Create a generic report to indicate failure/absence
                const dummyWidget = WidgetFactory.createInstance('Base', this.page, { type: 'Base', uiRules: {} });
                dummyWidget.logAudit(`Feedspace widget not detected on this URL: ${url}`, 'fail');
                await dummyWidget.generateReport('NotFound', websiteName);
                continue;
            }
            console.log(`[Multi-URL] Detected ${detectedInstances.length} widgets.`);

            // 3. Comprehensive Audit (Browser Mode)
            for (const widget of detectedInstances) {
                const widgetName = widget.constructor.name;
                console.log(`[Multi-URL] Auditing ${widgetName} (Browser Mode)...`);

                // Use the standardized comprehensive audit method
                await widget.performComprehensiveAudit();
            }

            // 4. Persistence Check (Reload)
            console.log(`[Multi-URL] Verifying persistence via reload...`);

            // Capture state to persist across reload
            const savedStates = detectedInstances.map(w => ({
                type: w.constructor.name,
                auditLog: [...w.auditLog],
                reviewStats: { ...w.reviewStats },
                detailedFailures: [...w.detailedFailures],
                accessibilityResults: [...w.accessibilityResults]
            }));

            await this.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
            await this.page.waitForTimeout(3000);

            // Re-detect widgets after reload
            const newWidgets = await WidgetFactory.detectAndCreate(this.page, 'Auto', { widgets: [] });

            // Restore state to new instances
            newWidgets.forEach(newWidget => {
                const saved = savedStates.find(s => s.type === newWidget.constructor.name);
                if (saved) {
                    newWidget.auditLog = saved.auditLog;
                    newWidget.reviewStats = saved.reviewStats;
                    newWidget.detailedFailures = saved.detailedFailures;
                    newWidget.accessibilityResults = saved.accessibilityResults;
                }
            });

            // 5. Mobile Responsiveness & Final Report
            for (const widget of newWidgets) {
                await widget.validateResponsiveness('Mobile');

                const typeName = widget.constructor.name.replace('Widget', '');
                // Force report type to 'Combined' for a single consolidated report
                widget.reportType = 'Combined';

                // Final report generation - includes logs from BEFORE and AFTER reload
                await widget.finalizeAuditCoverage();
                await widget.generateReport(typeName, websiteName);
            }

        } catch (error) {
            console.error(`[Multi-URL] Failed testing ${url}: ${error.message}`);
            // Continue to next URL despite error
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
