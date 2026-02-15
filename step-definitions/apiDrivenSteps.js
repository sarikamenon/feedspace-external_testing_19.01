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
    browser = await chromium.launch({ headless: true });
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

Then('I iterate through each customer URL and perform the following:', { timeout: 600 * 1000 }, async function (dataTable) {
    // Launch browser for validation
    browser = await chromium.launch({ headless: false });
    context = await browser.newContext();
    page = await context.newPage();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const reportDir = path.resolve(__dirname, '../reports');
    if (!fs.existsSync(reportDir)) fs.mkdirSync(reportDir);
    const reportPathPart = path.join(reportDir, `Api_Driven_Report_${timestamp}`);

    console.log(`Starting validation for ${widgetList.length} widgets...`);

    let processedCount = 0;

    for (const entry of widgetList) {
        const widgetUrl = entry.url || entry.widget_url || entry.link;
        if (!widgetUrl) continue;

        console.log(`\n[${++processedCount}/${widgetList.length}] Processing: ${widgetUrl}`);

        try {
            // Step 1: Load Widget URL & Reset Viewport
            await page.setViewportSize({ width: 1920, height: 1080 }); // Reset to desktop
            await page.goto(widgetUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });

            // Step 2: Determine expected type
            const typeId = entry.type || entry.widget_type;
            // Normalize type string (e.g., 'avatar_group' -> 'avatargroup')
            const expectedType = (WidgetTypeConstants[typeId] || (typeof typeId === 'string' ? typeId.replace(/_/g, '') : 'Unknown')).toLowerCase();

            // Step 3: Detect Valid Widgets on Page
            // Passing the full config allows WidgetFactory to match config if needed, though we rely mainly on detection
            const detectedInstances = await WidgetFactory.detectAndCreate(page, expectedType, { widgets: [entry] });

            if (detectedInstances.length === 0) {
                console.warn(`[Warning] No widgets of type '${expectedType}' detected on ${widgetUrl}`);
                reports.push({
                    url: widgetUrl,
                    type: expectedType,
                    status: 'Failed',
                    error: `No widgets detected for type: ${expectedType}`
                });
                continue;
            }

            console.log(`[Info] Detected ${detectedInstances.length} instance(s) of type '${expectedType}'. Validating each...`);

            // Step 4: Validate EACH detected instance
            for (let i = 0; i < detectedInstances.length; i++) {
                const widgetInstance = detectedInstances[i];
                const instanceId = `Instance ${i + 1}`;

                // Construct config wrapper for this instance
                const widgetConfigData = {
                    type: expectedType,
                    uiRules: {},
                    ...entry,
                    ...(entry.configurations || {})
                };

                // Create Validator & Config Checker
                const { validator, configChecker } = createValidatorAndConfig(expectedType, page, widgetConfigData);

                // Inject the specific widget instance into the validator if possible, 
                // BUT validator usually creates its own widget new instance.
                // To support targeting the SPECIFIC detected instance, we'd need to pass the instance's context/selector
                // to the validator.
                // Current implementation of Validator classes: new Validator(page, config) -> new Widget(page, config)
                // We need to inject the *already created* widgetInstance or pass its selector.

                // Workaround: Pass the context/selector from the detected instance to the config
                if (widgetInstance.context) validator.widget.context = widgetInstance.context;
                if (widgetInstance.containerSelector) validator.widget.containerSelector = widgetInstance.containerSelector;

                // Run full audit
                await validator.runFullAudit();

                // API vs UI Comparison
                const apiUiReport = await configChecker.generateFeatureReport();

                // Collect Report
                const widgetReport = {
                    url: `${widgetUrl} (${instanceId})`, // Distinguish instances in report
                    type: expectedType,
                    status: 'Processed',
                    timestamp: new Date().toISOString(),
                    auditData: validator.getReportData ? validator.getReportData() : {},
                    apiUiComparison: apiUiReport
                };

                reports.push(widgetReport);
            }

            // Save incremental report
            fs.writeFileSync(`${reportPathPart}.json`, JSON.stringify(reports, null, 2));

        } catch (err) {
            console.error(`[Error] Failed processing ${widgetUrl}:`, err.message);
            reports.push({
                url: widgetUrl,
                status: 'Failed',
                error: err.message
            });
            fs.writeFileSync(`${reportPathPart}.json`, JSON.stringify(reports, null, 2));
        }
    }

    // Generate final HTML report
    generateHtmlReport(reports, `${reportPathPart}.html`);
    console.log(`Validation complete. Reports saved to:\nJSON: ${reportPathPart}.json\nHTML: ${reportPathPart}.html`);

    if (browser) await browser.close();
});

function createValidatorAndConfig(type, page, config) {
    let validator, configChecker;
    const t = type.toLowerCase();

    switch (t) {
        case 'avatargroup':
        case 'avatar_group':
            validator = new AvatarGroupValidator(page, config);
            configChecker = new AvatarGroupConfig(page, config);
            break;
        case 'horizontalscroll':
        case 'horizontal_scroll':
            validator = new HorizontalScrollValidator(page, config);
            configChecker = new HorizontalScrollConfig(page, config);
            break;
        case 'avatarslider':
        case 'avatar_slider':
            validator = new AvatarSliderValidator(page, config);
            configChecker = new AvatarSliderConfig(page, config);
            break;
        case 'carousel':
        case 'carouselslider':
        case 'carousel_slider':
            validator = new CarouselValidator(page, config);
            configChecker = new CarouselConfig(page, config);
            break;
        case 'floatingcards':
        case 'floating_cards':
            validator = new FloatingCardsValidator(page, config);
            configChecker = new FloatingCardsConfig(page, config);
            break;
        case 'masonry':
            validator = new MasonryValidator(page, config);
            configChecker = new MasonryConfig(page, config);
            break;
        case 'stripslider':
        case 'strip_slider':
            validator = new StripSliderValidator(page, config);
            configChecker = new StripSliderConfig(page, config);
            break;
        case 'verticalscroll':
        case 'vertical_scroll':
            validator = new VerticalScrollValidator(page, config);
            configChecker = new VerticalScrollConfig(page, config);
            break;
        default:
            console.warn(`Unknown widget type '${type}', defaulting to HorizontalScroll fallback.`);
            validator = new HorizontalScrollValidator(page, config);
            configChecker = new HorizontalScrollConfig(page, config);
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
                        <span class="status-badge status-${r.status}">${r.status}</span>
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

