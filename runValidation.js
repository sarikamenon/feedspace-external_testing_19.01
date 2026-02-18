const { chromium } = require('@playwright/test');
const PlaywrightHelper = require('./helpers/playwrightHelper');
const ReportHelper = require('./helpers/reportHelper');
const { WidgetDetector } = require('./helpers/widgetDetector');
const fs = require('fs');
const path = require('path');
const https = require('https');
require('dotenv').config();

/**
 * Fetches the latest test data from the Feedspace API.
 */
async function fetchConfig() {
    const API_URL = 'https://api.feedspace.io/v3/embed-widget-urls';
    console.log(`[Main] Fetching live test data from ${API_URL}...`);

    return new Promise((resolve, reject) => {
        https.get(API_URL, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    // Handle wrapped response { success: true, data: [...] }
                    const dataArray = Array.isArray(json) ? json : (json.data || []);
                    resolve(dataArray);
                } catch (e) {
                    reject(new Error('Failed to parse API response'));
                }
            });
        }).on('error', reject);
    });
}

/**
 * Mapping of Widget Types to their specific Feature Configuration files.
 */
const WIDGET_CONFIG_MAP = {
    'Carousel': 'carouselslider',
    'Masonry': 'masonryFeature',
    'StripSlider': 'stripSliderFeature',
    'AvatarGroup': 'avatarGroupFeature',
    'AvatarSlider': 'avatarSliderFeature',
    'VerticalScroll': 'verticalScrollFeature',
    'HorizontalScroll': 'horizontalScrollFeature',
    'FloatingCards': 'floatingCardsFeature'
};

/**
 * Main Orchestrator for AI Visual Validation.
 */
async function run() {
    console.log('\n--- Starting Dynamic AI Visual Validation Orchestrator ---');

    let testData;
    try {
        testData = await fetchConfig();
        // Skip items without a customer URL
        testData = testData.filter(item => item.customer_url || item.url);

        // LIMIT FOR DISCOVERY: If you want to run only a subset, uncomment below:
        // testData = testData.slice(0, 5); 
    } catch (e) {
        console.warn('[Main] Warning: API fetch failed. Falling back to local testData/testUrls.json...');
        const localPath = path.join(process.cwd(), 'testData', 'testUrls.json');
        if (fs.existsSync(localPath)) {
            testData = JSON.parse(fs.readFileSync(localPath, 'utf8'));
        } else {
            throw new Error('[Main] Critical: No test data source found (API Unavailable and local JSON missing).');
        }
    }

    console.log(`[Main] Loaded ${testData.length} records for validation.`);

    const browser = await chromium.launch({ headless: false }); // Set to true for CI/CD
    const context = await browser.newContext({
        viewport: { width: 1920, height: 1080 },
        deviceScaleFactor: 1
    });

    const reportHelper = new ReportHelper();
    const results = [];

    for (let i = 0; i < testData.length; i++) {
        const entry = testData[i];
        const url = entry.customer_url || entry.url;
        const typeId = entry.widget_type || entry.type;
        const configuration = entry.configuration || entry.configurations;

        console.log(`\n[${i + 1}/${testData.length}] Processing: ${url}`);

        const page = await context.newPage();
        const helper = new PlaywrightHelper(page);

        try {
            // 1. Identify Widget Type
            const typeName = WidgetDetector.identify({ type: typeId });
            console.log(`   > Type Identified: ${typeName} (ID: ${typeId})`);

            // 2. Map to Config File
            const configFileName = WIDGET_CONFIG_MAP[typeName] || typeName.toLowerCase();
            const configPath = path.join(process.cwd(), 'Configs', `${configFileName}.json`);

            let staticFeatures = null;
            if (fs.existsSync(configPath)) {
                const configContent = JSON.parse(fs.readFileSync(configPath, 'utf8'));
                staticFeatures = configContent.features;
                console.log(`   > Features Loaded: ${configFileName}.json (${staticFeatures.length} markers)`);
            } else {
                console.warn(`   > Warning: No feature config found for ${typeName}. Using default AI vision.`);
            }

            // 3. Initialize & Navigate (Handling Hiding, Scrolling, etc.)
            await helper.init(url, typeId, configuration);

            // 4. Run AI Analysis
            const validationResult = await helper.validateWithAI(staticFeatures);

            results.push({
                url: url,
                ...validationResult,
                status: validationResult.aiAnalysis.overall_status || 'UNKNOWN',
                timestamp: new Date().toISOString()
            });

            console.log(`   > Overall Status: ${validationResult.aiAnalysis.overall_status}`);
        } catch (error) {
            console.error(`   > Critical Error: ${error.message}`);
            results.push({
                url: url,
                widgetType: typeId,
                status: 'ERROR',
                error: error.message,
                timestamp: new Date().toISOString()
            });
        } finally {
            await page.close();
            // Optional: Pause to respect API rate limits and allow system cooling
            if (i < testData.length - 1) await new Promise(r => setTimeout(r, 2000));
        }
    }

    // --- Final Reporting ---
    console.log('\n--- Validation Sequence Complete. Generating Reports... ---');
    const consolidatedReport = {
        summary: {
            total: results.length,
            passed: results.filter(r => r.status === 'PASS').length,
            failed: results.filter(r => r.status === 'FAIL').length,
            errors: results.filter(r => r.status === 'ERROR').length
        },
        runs: results
    };

    const reportPath = await reportHelper.saveReport(consolidatedReport);
    console.log(`[Main] SUCCESS: Dashboard available at: ${reportPath}`);

    await browser.close();
}

// Global Error Handler
run().catch(err => {
    console.error('[Main] Orchestrator Failed:', err);
    process.exit(1);
});
