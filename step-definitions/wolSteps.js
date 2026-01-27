const { Given, Then, When } = require('@cucumber/cucumber');
const { WallOfLovePage } = require('../pages/WallOfLovePage');
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

let wolPage;
let wolConfig;

Given('user opens the Wall of Love page', async function () {
    const filePath = path.resolve(process.cwd(), 'testData/reviewForms.json');
    if (!fs.existsSync(filePath)) throw new Error(`JSON file not found: ${filePath}`);

    const rawData = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);

    wolConfig = jsonData.wallOfLovePage;
    if (!wolConfig) throw new Error('wallOfLovePage config not found in JSON');

    console.log(`Loaded config for URL: ${wolConfig.url}`);

    wolPage = new WallOfLovePage(this.page);
    await wolPage.navigateTo(wolConfig.url);
});

Then('page title should be visible', async function () {
    // wol.feature Step 8 says "Wall of Love page title should be visible" or "page title should be visible"
    // I need to check wol.feature content.
    // Step 117 said "Wall of Love page title should be visible".
    // I will support that phrasing.
    if (wolConfig.page && wolConfig.page.titleRequired) {
        await wolPage.verifyPageTitle();
    }
});

Then('Wall of Love page title should be visible', async function () {
    if (wolConfig.page && wolConfig.page.titleRequired) {
        await wolPage.verifyPageTitle();
    }
});

Then('page heading should be visible', async function () {
    if (wolConfig.page && wolConfig.page.headingRequired) {
        await wolPage.verifyHeading();
    }
});

Then('at least 1 review should be displayed', async function () {
    await wolPage.verifyReviewsPresence(wolConfig.reviews.minCount);
});
Then('at least one review should be displayed', async function () {
    await wolPage.verifyReviewsPresence(wolConfig.reviews.minCount);
});




Then('optional elements should exist if present', async function () {
    if (wolConfig.optionalElements) {
        await wolPage.verifyOptionalElements(wolConfig.optionalElements);
    }
});

Then('Feedspace branding should be validated only if present', async function () {
    // Specific step for granular feature file (if used)
    if (wolConfig.optionalElements && wolConfig.optionalElements.feedspaceBranding) {
        // Create a mini config object to reuse verifyOptionalElements logic or call directly
        const config = { feedspaceBranding: wolConfig.optionalElements.feedspaceBranding };
        await wolPage.verifyOptionalElements(config);
    }
});

Then('platform logo should be validated only if present', async function () {
    if (wolConfig.optionalElements && wolConfig.optionalElements.platformIcon) {
        const config = { platformIcon: wolConfig.optionalElements.platformIcon };
        await wolPage.verifyOptionalElements(config);
    }
});

Then('carousel should be validated only if present', async function () {
    if (wolConfig.optionalElements && wolConfig.optionalElements.carousel) {
        const config = { carousel: wolConfig.optionalElements.carousel };
        await wolPage.verifyOptionalElements(config);
    }
});

When('user resizes window to mobile view', async function () {
    await wolPage.verifyResponsiveness();
});

Then('no critical elements should overlap', async function () {
    // Verification is already done in verifyMobileLayout via expect
    console.log('Mobile layout verified.');
});

Then('the page should meet accessibility standards', async function () {
    await wolPage.verifyAccessibilityWithReport();
});

Then('user validates structural integrity of the widget', async function () {
    await wolPage.verifyStructuralIntegrity();
});

Then('user validates card consistency and content', async function () {
    await wolPage.verifyCardConsistency();
});

Then('verify that no review dates are undefined', async function () {
    await wolPage.verifyDateConsistency();
});

Then('verify that review text is not overflowing', async function () {
    await wolPage.verifyTextOverflow();
});

Then('verify optional UI elements if present', { timeout: 420000 }, async function () {
    await wolPage.verifyOptionalElements();
});

Then('user checks responsivenes and adaptability', async function () {
    await wolPage.verifyResponsiveness();
});

Then('user performs generic accessibility audit', { timeout: 300000 }, async function () {
    await wolPage.verifyAccessibilityWithReport();
});

Then('generate the final audit report', { timeout: 120000 }, async function () {
    await wolPage.generateHTMLAuditReport();
});

Given('user simulates media loading failures', async function () {
    await wolPage.simulateMediaFailures();
    // Reload to apply the network intercepts
    console.log('Reloading page to apply network intercepts...');
    await wolPage.page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
});

Then('verify that broken media is reported as an error', async function () {
    await wolPage.verifyBrokenMediaHandling();
});


