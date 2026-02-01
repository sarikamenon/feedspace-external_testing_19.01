const { Before, After, BeforeAll, AfterAll, setDefaultTimeout } = require('@cucumber/cucumber');
const { chromium } = require('@playwright/test');

setDefaultTimeout(60000);

let browser;
let context;
let page;

BeforeAll(async function () {
    browser = await chromium.launch({ headless: false });
});

AfterAll(async function () {
    await browser.close();
});

Before(async function () {
    // Close any existing page/context from previous scenario (defensive cleanup)
    if (page && !page.isClosed()) {
        await page.close().catch(() => { });
    }
    if (context) {
        await context.close().catch(() => { });
    }

    // Create fresh context and page for this scenario
    context = await browser.newContext();
    page = await context.newPage();
    this.page = page; // Attach page to the World instance so steps can access it
});

After(async function (scenario) {
    if (this.currentWidget) {
        const widgetType = this.currentWidget.constructor.name.replace('Widget', '');
        console.log(`[HOOK] Generating auto-report for ${widgetType} after scenario: ${scenario.pickle.name}`);
        await this.currentWidget.generateReport(widgetType);
    }
    await page.close();
    await context.close();
});
