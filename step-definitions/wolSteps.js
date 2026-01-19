const { Given, Then } = require('@cucumber/cucumber');
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
