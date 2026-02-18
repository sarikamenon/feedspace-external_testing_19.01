const NetworkInterceptor = require('../core/NetworkInterceptor');
const { WidgetDetector } = require('../core/WidgetDetector');
const UIEngine = require('../core/UIEngine');
const ReportEngine = require('../core/ReportEngine');
const AIEngine = require('../core/AIEngine');

class WidgetPage {
    constructor(page) {
        this.page = page;
        this.networkInterceptor = new NetworkInterceptor(page);
        this.uiEngine = new UIEngine(page);
        this.reportEngine = new ReportEngine();
        this.aiEngine = new AIEngine();
        this.config = null;
        this.widgetType = 'Unknown';
        this.validationResults = [];
        this.aiResults = null;
    }

    async navigate(url) {
        console.log(`[WidgetPage] Navigating to ${url}`);

        // Start intercepting BEFORE navigation
        // pattern matches 'getwidgetconfig' or similar
        const configPromise = this.networkInterceptor.captureConfig('getwidgetconfig');

        await this.page.goto(url, { waitUntil: 'domcontentloaded' });

        this.config = await configPromise;
        if (!this.config) {
            console.log('[WidgetPage] Network intercept failed, trying window object...');
            this.config = await this.networkInterceptor.getWindowConfig();
        }

        if (this.config) {
            this.widgetType = WidgetDetector.identifyWidgetType(this.config);
            console.log(`[WidgetPage] Identified Widget: ${this.widgetType}`);
        } else {
            console.warn('[WidgetPage] No configuration found. Proceeding with visual check only.');
        }
    }

    async validateConfiguration() {
        if (!this.config) return;

        // Use UIEngine to route to specific validator
        const results = await this.uiEngine.validateFullConfig(this.widgetType, this.config);

        this.validationResults.push(...results);
    }

    async validateVisual() {
        const name = `${this.widgetType}_${Date.now()}`;
        const result = await this.uiEngine.validateVisual(name);
        this.validationResults.push({
            key: 'visual_snapshot',
            expected: 'match_baseline',
            result: result
        });
    }

    async validateWithAI() {
        if (!this.config) {
            console.warn('[WidgetPage] No config to validate against.');
            return;
        }

        console.log(`[WidgetPage] capturing screenshot for AI analysis...`);
        // Capture screenshot of the specific widget container if possible
        // For now, we'll try a generic locator based on common classes, or fall back to full page
        let screenshotBuffer;
        try {
            const locator = this.page.locator('.feedspace-embed-main, .feedspace-widget-container, iframe[src*="feedspace"]').first();
            if (await locator.isVisible()) {
                screenshotBuffer = await locator.screenshot();
            } else {
                screenshotBuffer = await this.page.screenshot({ fullPage: true });
            }
        } catch (e) {
            console.warn('[WidgetPage] Specific locator failed, taking full page.');
            screenshotBuffer = await this.page.screenshot({ fullPage: true });
        }

        this.aiResults = await this.aiEngine.analyzeScreenshot(screenshotBuffer, this.config, this.widgetType);
        console.log('[WidgetPage] AI Analysis Complete:', this.aiResults.overall_status);

        // Add to validation results for standard reporting
        this.validationResults.push({
            key: 'AI_Visual_Validation',
            expected: 'PASS',
            result: {
                success: this.aiResults.overall_status === 'PASS',
                message: `AI Status: ${this.aiResults.overall_status}`,
                details: this.aiResults
            }
        });
    }

    async generateReport() {
        const report = {
            url: this.page.url(),
            widgetType: this.widgetType,
            capturedConfig: this.config,
            validations: this.validationResults,
            aiAnalysis: this.aiResults, // Explicit AI section
            timestamp: new Date().toISOString()
        };

        await this.reportEngine.saveReport(report);
    }
}

module.exports = WidgetPage;
