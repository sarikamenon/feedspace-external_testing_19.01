const { Given, When, Then } = require('@cucumber/cucumber');
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');
const { WidgetFactory } = require('../pages/widgets/WidgetFactory');
const { WidgetTypeConstants } = require('../pages/widgets/WidgetTypeConstants');

// Import all Validator classes
const { AvatarGroupValidator } = require('../validators/AvatarGroupValidator');
const { HorizontalScrollValidator } = require('../validators/HorizontalConfigValidator');
const { AvatarSliderValidator } = require('../validators/AvatarSliderValidator');
const { CarouselValidator } = require('../validators/CarouselValidator');
const { FloatingCardsValidator } = require('../validators/FloatingCardsValidator');
const { MasonryValidator } = require('../validators/MasonryValidator');
const { StripSliderValidator } = require('../validators/StripSliderValidator');
const { VerticalScrollValidator } = require('../validators/VerticalScrollValidator');

// Import all Config classes
const { AvatarGroupConfig } = require('../configs/AvatarGroupConfig');
const { HorizontalScrollConfig } = require('../configs/HorizontalScrollConfig');
const { AvatarSliderConfig } = require('../configs/AvatarSliderConfig');
const { CarouselConfig } = require('../configs/CarouselConfig');
const { FloatingCardsConfig } = require('../configs/FloatingCardsConfig');
const { MasonryConfig } = require('../configs/MasonryConfig');
const { StripSliderConfig } = require('../configs/StripSliderConfig');
const { VerticalScrollConfig } = require('../configs/VerticalScrollConfig');

let browser;
let page;
let context;
let devApiUrl;
let widgetList = [];
let reports = [];

Given('I load the developer API URL from {string}', async function (configFile) {
    const configPath = path.resolve(__dirname, '../testData', configFile);
    if (!fs.existsSync(configPath)) throw new Error(`Config file not found: ${configFile}`);
    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    devApiUrl = config.apiUrl;
    if (!devApiUrl) throw new Error('API URL not found in config');
});

When('I fetch the widget list from the developer API', async function () {
    console.log(`Fetching widget list from: ${devApiUrl}`);

    // Local file support
    if (devApiUrl.endsWith('.json') && fs.existsSync(path.resolve(__dirname, '../testData', path.basename(devApiUrl)))) {
        const localPath = path.resolve(__dirname, '../testData', path.basename(devApiUrl));
        const json = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        widgetList = Array.isArray(json) ? json : (json.data || json.widgets || [json]);
        console.log(`Loaded ${widgetList.length} widgets from local file.`);
        return;
    }

    // Network fetch
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
    try {
        const response = await context.request.get(devApiUrl);
        if (!response.ok()) throw new Error(`API fetch failed: ${response.status()}`);
        const json = await response.json();
        widgetList = Array.isArray(json) ? json : (json.data || json.widgets || [json]);
        console.log(`Fetched ${widgetList.length} widgets from API.`);
    } catch (e) {
        throw new Error(`Failed to fetch widgets: ${e.message}`);
    } finally {
        await browser.close();
    }
});

Then('I iterate through each customer URL and perform the following:', { timeout: 100 * 60 * 60 * 1000 }, async function (dataTable) {
    // Launch browser for validation
    browser = await chromium.launch({
        headless: false,
        args: ['--start-maximized']
    });
    context = await browser.newContext({ viewport: null });
    page = await context.newPage();
    // Standardize viewport immediately to prevent re-renders during audit
    await page.setViewportSize({ width: 1920, height: 1080 });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const baseReportDir = path.resolve(__dirname, '../reports');
    const dynamicReportDir = path.join(baseReportDir, 'Dynamic_testing_reports');

    // Create directories if they don't exist
    if (!fs.existsSync(baseReportDir)) fs.mkdirSync(baseReportDir);
    if (!fs.existsSync(dynamicReportDir)) fs.mkdirSync(dynamicReportDir, { recursive: true });

    const groupedByUrl = widgetList.reduce((acc, entry) => {
        const url = entry.url || entry.widget_url || entry.link;
        if (!url) return acc;
        if (!acc[url]) acc[url] = [];
        acc[url].push(entry);
        return acc;
    }, {});

    const uniqueUrls = Object.keys(groupedByUrl);
    console.log(`Starting massive validation for ${uniqueUrls.length} unique URLs (Total widgets: ${widgetList.length})...`);
    console.log(`Reports will be saved to: ${dynamicReportDir}`);

    let processedCount = 0;

    for (const widgetUrl of uniqueUrls) {
        const urlEntries = groupedByUrl[widgetUrl];
        let reports = [];
        let domain = 'unknown';
        try { domain = new URL(widgetUrl).hostname.replace('www.', '').replace(/\./g, '_'); } catch (e) { }
        const fileTimestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const individualReportBase = path.join(dynamicReportDir, `${domain}_${fileTimestamp}`);

        console.log(`\n[${++processedCount}/${uniqueUrls.length}] Processing: ${widgetUrl} (${urlEntries.length} expected widgets)`);

        try {
            // Browser Session Recovery: Ensure browser and page are still alive
            if (!browser || !browser.isConnected() || !page || page.isClosed()) {
                console.log(`[Recovery] Browser session lost. Re-initializing...`);
                if (browser) await browser.close().catch(() => { });
                browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
                context = await browser.newContext({ viewport: null });
                page = await context.newPage();
            }

            // Step 1: Load Widget URL & Wait for content
            // Using a sub-try-catch for navigation to ensure timeout doesn't kill the loop
            try {
                await page.setViewportSize({ width: 1920, height: 1080 });
                await page.goto(widgetUrl, { waitUntil: 'load', timeout: 45000 }); // Slightly shorter timeout for scale

                // Trigger lazy loading
                await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
                await page.waitForTimeout(1000);
                await page.evaluate(() => window.scrollTo(0, 0));
                await page.waitForTimeout(5000); // Wait for profile pics/dynamic elements
            } catch (navError) {
                console.warn(`[Timeout/Nav Error] Could not load ${widgetUrl}: ${navError.message}`);
                reports.push({
                    url: widgetUrl,
                    status: 'Failed',
                    error: `Navigation/Timeout Error: ${navError.message}`
                });
                fs.writeFileSync(`${individualReportBase}.json`, JSON.stringify(reports, null, 2));
                generateHtmlReport(reports, `${individualReportBase}.html`);
                continue; // Move to next URL
            }

            // Step 2 & 3: Iterate through all expected widgets for this URL
            for (const entry of urlEntries) {
                const typeId = entry.type || entry.widget_type;
                const expectedType = (WidgetTypeConstants[typeId] || (typeof typeId === 'string' ? typeId : 'Unknown')).toLowerCase().replace(/_/g, '').replace(/-/g, '');

                console.log(`  - Validating expected widget: ${expectedType}`);

                // Detect Valid Widgets on Page for this type
                const detectedInstances = await WidgetFactory.detectAndCreate(page, expectedType, { widgets: [entry] });

                if (detectedInstances.length === 0) {
                    console.warn(`    [Not Found] No '${expectedType}' widgets detected on ${widgetUrl}`);
                    reports.push({
                        url: widgetUrl,
                        type: expectedType,
                        status: 'Widget Not Found',
                        error: `Feedspace widget not found for type: ${expectedType}`
                    });
                    continue;
                }

                console.log(`    [Info] Detected ${detectedInstances.length} instance(s) of ${expectedType}. Validating...`);

                // Step 4: Validate EACH detected instance
                for (let i = 0; i < detectedInstances.length; i++) {
                    const widgetInstance = detectedInstances[i];
                    const instanceId = `Instance ${i + 1}`;

                    // RECOVERY: Ensure session is still alive before each instance check
                    if (!browser || !browser.isConnected() || !page || page.isClosed()) {
                        console.log(`    [Recovery] Session lost during instance ${i + 1}. Re-loading URL...`);
                        if (browser) await browser.close().catch(() => { });
                        browser = await chromium.launch({ headless: false, args: ['--start-maximized'] });
                        context = await browser.newContext({ viewport: null });
                        page = await context.newPage();
                        await page.setViewportSize({ width: 1920, height: 1080 });
                        await page.goto(widgetUrl, { waitUntil: 'load', timeout: 45000 }).catch(() => { });
                        await page.waitForTimeout(3000);
                    }

                    const widgetConfigData = {
                        type: expectedType,
                        uiRules: {},
                        ...entry,
                        ...(entry.configurations || {})
                    };

                    const { validator, configChecker } = createValidatorAndConfig(expectedType, page, widgetConfigData, widgetInstance.context);

                    if (widgetInstance.containerSelector) validator.widget.containerSelector = widgetInstance.containerSelector;

                    // Run audit with internal try-catch
                    try {
                        await validator.runFullAudit();
                        // Use the results already gathered by the validator during its audit
                        // This avoids re-running checks after modals are closed in interactive widgets
                        const featureResults = validator.reportData.featureResults || [];

                        reports.push({
                            url: `${widgetUrl} (${expectedType} ${instanceId})`,
                            type: expectedType,
                            status: 'Processed',
                            timestamp: new Date().toISOString(),
                            auditData: validator.getReportData ? validator.getReportData() : {},
                            apiUiComparison: featureResults
                        });
                    } catch (auditErr) {
                        console.error(`    [Audit Error] ${expectedType} Instance ${i + 1} failed: ${auditErr.message}`);
                        reports.push({
                            url: `${widgetUrl} (${expectedType} ${instanceId})`,
                            type: expectedType,
                            status: 'Failed',
                            error: `Audit Error: ${auditErr.message}`
                        });
                    }
                }
            }

        } finally {
            // Save consolidated report for all widgets on this URL
            if (reports.length > 0) {
                fs.writeFileSync(`${individualReportBase}.json`, JSON.stringify(reports, null, 2));
                generateHtmlReport(reports, `${individualReportBase}.html`);
            }
        }
    }

    console.log(`\n==================================================`);
    console.log(`Validation complete for ${widgetList.length} URLs.`);
    console.log(`Individual reports are available in: reports/Dynamic_testing_reports/`);
    console.log(`==================================================\n`);

    if (browser) await browser.close();
});

function createValidatorAndConfig(type, page, config, context = null) {
    let validator, configChecker;
    const t = type.toLowerCase().replace(/_/g, '').replace(/-/g, '');
    const activeContext = context || page;

    switch (t) {
        case 'avatargroup':
            validator = new AvatarGroupValidator(page, config);
            configChecker = new AvatarGroupConfig(activeContext, config);
            break;
        case 'horizontalscroll':
        case 'marqueeleftright':
            validator = new HorizontalScrollValidator(page, config);
            configChecker = new HorizontalScrollConfig(activeContext, config);
            break;
        case 'avatarslider':
        case 'singleslider':
            validator = new AvatarSliderValidator(page, config);
            configChecker = new AvatarSliderConfig(activeContext, config);
            break;
        case 'carousel':
        case 'carouselslider':
            validator = new CarouselValidator(page, config);
            configChecker = new CarouselConfig(activeContext, config);
            break;
        case 'floatingcards':
        case 'floatingtoast':
            validator = new FloatingCardsValidator(page, config);
            configChecker = new FloatingCardsConfig(activeContext, config);
            break;
        case 'masonry':
            validator = new MasonryValidator(page, config);
            configChecker = new MasonryConfig(activeContext, config);
            break;
        case 'stripslider':
        case 'marqueestripe':
            validator = new StripSliderValidator(page, config);
            configChecker = new StripSliderConfig(activeContext, config);
            break;
        case 'verticalscroll':
        case 'marqueeupdown':
            validator = new VerticalScrollValidator(page, config);
            configChecker = new VerticalScrollConfig(activeContext, config);
            break;
        default:
            console.warn(`Unknown widget type '${type}' (normalized: '${t}'), defaulting to HorizontalScroll fallback.`);
            validator = new HorizontalScrollValidator(page, config);
            configChecker = new HorizontalScrollConfig(activeContext, config);
    }

    if (context && validator.widget) {
        validator.widget.context = context;
        validator.widget.isContextFixed = true;
    }

    return { validator, configChecker };
}

function generateHtmlReport(data, filePath) {
    const htmlContent = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <title>API Driven Widget Validation Report</title>
        <style>
            body { font-family: 'Segoe UI', sans-serif; padding: 20px; background: #f4f4f4; color: #333; }
            .container { max-width: 1200px; margin: 0 auto; }
            .entry { background: #fff; padding: 25px; margin-bottom: 20px; border-radius: 8px; box-shadow: 0 2px 5px rgba(0,0,0,0.1); }
            h1 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; }
            h2 { margin-top: 0; color: #2c3e50; display: flex; justify-content: space-between; align-items: center; }
            h3 { color: #7f8c8d; border-bottom: 1px solid #eee; padding-bottom: 5px; margin-top: 20px; }
            
            .status-badge { padding: 5px 10px; border-radius: 4px; font-size: 0.8em; color: white; }
            .status-Processed { background-color: #27ae60; }
            .status-Failed { background-color: #c0392b; }
            .status-Widget-Not-Found { background-color: #f39c12; }
            .status-Timeout { background-color: #e67e22; }
            
            .log-list { list-style: none; padding: 0; max-height: 400px; overflow-y: auto; background: #fafafa; border: 1px solid #eee; border-radius: 4px; }
            .log-item { padding: 8px 12px; border-bottom: 1px solid #eee; font-family: consolas, monospace; font-size: 0.9em; }
            .log-pass { color: #27ae60; border-left: 4px solid #27ae60; }
            .log-fail { color: #c0392b; border-left: 4px solid #c0392b; background: #fff0f0; }
            .log-warn { color: #f39c12; border-left: 4px solid #f39c12; }
            .log-info { color: #2980b9; border-left: 4px solid #2980b9; }

            table { width: 100%; border-collapse: collapse; margin: 10px 0; font-size: 0.9em; }
            th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
            th { background-color: #f8f9fa; font-weight: 600; }
            .diff-pass { color: #27ae60; font-weight: bold; }
            .diff-fail { color: #c0392b; font-weight: bold; }
            
            .failure-card { background: #fff5f5; border: 1px solid #feb2b2; padding: 10px; margin-bottom: 10px; border-radius: 4px; }
            .failure-title { font-weight: bold; color: #c0392b; margin-bottom: 5px; display: block; }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>API Driven Validation Report</h1>
            <p><strong>Timestamp:</strong> ${new Date().toLocaleString()} | <strong>Total Widgets:</strong> ${data.length}</p>
            
            ${data.map(r => `
                <div class="entry">
                    <h2>
                        <span>${r.url} <small style="color: #7f8c8d; font-weight: normal;">(${r.type || 'Unknown'})</small></span>
                        <span class="status-badge status-${(r.status || 'Unknown').replace(/\s+/g, '-')}">${r.status}</span>
                    </h2>
                    
                    ${r.error ? `<div class="failure-card"><strong>Error:</strong> ${r.status === 'Failed' ? r.error : ''}</div>` : ''}

                    <!-- Section: API vs UI Comparison -->
                    ${r.apiUiComparison && r.apiUiComparison.length > 0 ? `
                        <h3>Configuration Check (API vs UI)</h3>
                        <table>
                            <thead>
                                <tr>
                                    <th>Feature</th>
                                    <th>API Value</th>
                                    <th>UI Value</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${r.apiUiComparison.map(c => `
                                    <tr>
                                        <td>${c.feature}</td>
                                        <td><code>${c.api_value}</code></td>
                                        <td><code>${c.ui_value}</code></td>
                                        <td class="diff-${c.status === 'PASS' ? 'pass' : 'fail'}">${c.status}</td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    ` : '<p><em>No configuration comparison data available.</em></p>'}

                    <!-- Section: Widget Audit Log -->
                    ${r.auditData && r.auditData.auditLog ? `
                        <h3>Audit Log</h3>
                        <ul class="log-list">
                            ${r.auditData.auditLog.map(l => `
                                <li class="log-item log-${l.status || l.type || 'info'}">
                                    <strong>[${(l.status || l.type || 'INFO').toUpperCase()}]</strong> ${l.message}
                                    ${l.isLimitation ? '<span title="Known Limitation">⚠️</span>' : ''}
                                </li>
                            `).join('')}
                        </ul>
                        
                        <!-- Review Stats -->
                        ${r.auditData.reviewStats ? `
                            <div style="margin-top: 15px; padding: 10px; background: #e8f6f3; border-radius: 4px; color: #0e6251;">
                                <strong>Stats:</strong> 
                                Total: ${r.auditData.reviewStats.total || 0} | 
                                Text: ${r.auditData.reviewStats.text || 0} | 
                                Video: ${r.auditData.reviewStats.video || 0} | 
                                Audio: ${r.auditData.reviewStats.audio || 0}
                            </div>
                        ` : ''}

                        <!-- Detailed Failures -->
                        ${r.auditData.detailedFailures && r.auditData.detailedFailures.length > 0 ? `
                            <h3 style="color: #c0392b;">Detailed Failures (${r.auditData.detailedFailures.length})</h3>
                            ${r.auditData.detailedFailures.map(f => `
                                <div class="failure-card">
                                    <span class="failure-title">${f.type} - ${f.card}</span>
                                    <div>${f.description}</div>
                                    <div style="font-size: 0.85em; color: #666; margin-top: 5px;">Selector: <code>${f.selector}</code></div>
                                    ${f.snippet ? `<div style="font-size: 0.85em; color: #666; font-style: italic; margin-top: 2px;">"${f.snippet}"</div>` : ''}
                                </div>
                            `).join('')}
                        ` : ''}
                    ` : '<p><em>No audit data available.</em></p>'}
                </div>
            `).join('')}
        </div>
    </body>
    </html>`;

    fs.writeFileSync(filePath, htmlContent);
}

