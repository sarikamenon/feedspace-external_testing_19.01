const fs = require('fs');
const path = require('path');
const AIEngine = require('./aiEngine');
const ReportHelper = require('./reportHelper');
const { WidgetDetector } = require('./widgetDetector');

class PlaywrightHelper {
    constructor(page) {
        this.page = page;
        this.aiEngine = new AIEngine();
        this.reportHelper = new ReportHelper();
        this.config = null;
        this.widgetType = 'Unknown';
        this.aiResults = null;
    }

    async init(url, widgetTypeId, config) {
        this.config = config || {};
        this.widgetType = WidgetDetector.identify({ widget_type_id: widgetTypeId }) || 'Unknown';

        console.log(`[PlaywrightHelper] Initializing for ${this.widgetType} (ID: ${widgetTypeId})...`);

        try {
            console.log(`[PlaywrightHelper] Navigating to ${url} (90s timeout)`);
            await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 90000 });

            // Allow a bit more time for 3rd party scripts (widgets) to start appearing
            await this.page.waitForLoadState('load', { timeout: 30000 }).catch(() => {
                console.log('[PlaywrightHelper] "load" event timed out, proceeding with DOMContentLoaded state.');
            });
        } catch (error) {
            console.error(`[PlaywrightHelper] Navigation Error: ${error.message}`);
            // If it's just a timeout but we are on the page, we might still succeed
            if (error.message.includes('timeout')) {
                console.log('[PlaywrightHelper] Navigation timed out but attempting to proceed anyway.');
            } else {
                throw error;
            }
        }
    }

    async validateWithAI(staticFeatures) {
        console.log('[PlaywrightHelper] Detecting and capturing widget for AI...');

        // Feedspace generic selectors
        const selectors = [
            '#feedspace-widget-container',
            '.feedspace-widget',
            'iframe[src*="feedspace.io"]',
            'div[id*="feedspace"]',
            '.carousel_slider',
            '.testimonial-slider',
            'section:has-text("Le Loro Parole")' // Specific for MAT Academy fallback
        ];
        const locator = this.page.locator(selectors.join(', ')).first();

        let screenshotBuffer;

        try {
            await this.page.setViewportSize({ width: 1920, height: 1080 });

            console.log('[PlaywrightHelper] Hiding distracting elements and overlays...');
            await this.page.evaluate(() => {
                const distractions = [
                    '.trustpilot-widget',
                    '[id*="trustpilot"]',
                    '.chat-bubble',
                    '.iubenda-cs-container',
                    '#iubenda-cs-banner',
                    '[id*="cookie"]',
                    '[class*="cookie"]',
                    '[id*="virtual-tour"]',
                    '[class*="virtual-tour"]',
                    '.modal-active',
                    '.popup-overlay',
                    'iframe[src*="iubenda.com"]',
                    'div[style*="z-index: 9999999"]', // Common for high-priority popups
                    'button:has-text("Accetta")',
                    'button:has-text("Accept")'
                ];

                distractions.forEach(sel => {
                    try {
                        if (sel.includes(':has-text')) {
                            const text = sel.match(/"([^"]+)"/)[1];
                            const btns = Array.from(document.querySelectorAll('button'));
                            btns.filter(b => b.innerText.includes(text)).forEach(b => {
                                const parent = b.closest('div[style*="position: fixed"]') || b.closest('div');
                                if (parent) parent.style.display = 'none';
                            });
                        } else {
                            document.querySelectorAll(sel).forEach(el => el.style.display = 'none');
                        }
                    } catch (e) { }
                });
            });

            console.log('[PlaywrightHelper] Initiating slow scroll to ensure widget is loaded...');
            await this.slowScrollToFind();

            if (await locator.isVisible()) {
                console.log('[PlaywrightHelper] Widget identified. Focusing...');
                await locator.scrollIntoViewIfNeeded();

                // Interaction: Click Next Slider multiple times to discover cards/Read More
                try {
                    const nextBtn = this.page.locator('.feedspace-widget >> .next-btn, .carousel_slider >> button:has-text(">"), .feedspace-widget >> .swiper-button-next, .feedspace-widget >> .carousel-control-next').first();
                    if (await nextBtn.isVisible()) {
                        console.log('[PlaywrightHelper] Clicking "Next" (3 times) to discover hidden features like Read More...');
                        for (let i = 0; i < 3; i++) {
                            await nextBtn.click();
                            await this.page.waitForTimeout(1000);
                        }
                    }
                } catch (e) { }

                // Fine-tune scroll to center the widget
                await this.page.evaluate((sel) => {
                    const el = document.querySelector(sel);
                    if (el) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, selectors[0]);

                // Wait for animations/lazy loading to settle
                console.log('[PlaywrightHelper] Waiting for UI to stabilize...');
                await this.page.waitForTimeout(5000);

                screenshotBuffer = await locator.screenshot({
                    animations: 'disabled',
                    scale: 'device'
                });
            } else {
                console.log('[PlaywrightHelper] Widget not found. Capturing Full Page as fallback.');
                screenshotBuffer = await this.page.screenshot({ fullPage: true });
            }
        } catch (e) {
            console.log('[PlaywrightHelper] Capture Error:', e.message);
            screenshotBuffer = await this.page.screenshot({ fullPage: true });
        }

        // Save screenshot
        const timestamp = Date.now();
        const screenshotDir = path.join(process.cwd(), 'screenshots');
        if (!fs.existsSync(screenshotDir)) fs.mkdirSync(screenshotDir);

        const screenshotPath = path.join(screenshotDir, `${this.widgetType}_${timestamp}.png`);
        fs.writeFileSync(screenshotPath, screenshotBuffer);
        console.log(`[PlaywrightHelper] Screenshot saved: ${screenshotPath}`);

        // Analyze
        this.aiResults = await this.aiEngine.analyzeScreenshot(screenshotBuffer, this.config, this.widgetType, staticFeatures);
        return {
            widgetType: this.widgetType,
            capturedConfig: this.config,
            aiAnalysis: this.aiResults,
            screenshotPath: screenshotPath
        };
    }

    async slowScrollToFind() {
        console.log('[PlaywrightHelper] Performing human-like smooth scrolling to bottom...');
        await this.page.evaluate(async () => {
            const delay = 100;
            const steps = 20;
            const height = document.body.scrollHeight;
            const stepHeight = height / steps;

            for (let i = 0; i <= steps; i++) {
                window.scrollTo({ top: i * stepHeight, behavior: 'smooth' });
                await new Promise(r => setTimeout(r, delay));
            }
            // Stay at the bottom for a moment to trigger lazy loads
            await new Promise(r => setTimeout(r, 1000));
        });
    }
}

module.exports = PlaywrightHelper;
