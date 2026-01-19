const { Given, When, Then } = require('@cucumber/cucumber');
const { MediaPage } = require('../pages/MediaPage');
const fs = require('fs');
const path = require('path');
const { expect } = require('@playwright/test');

let mediaPage;
let currentScenario;
let testData = [];

// ----------------------
// Load media scenarios from JSON
// ----------------------
Given('media user loads media scenarios from JSON', async function () {
    const filePath = path.resolve(process.cwd(), 'testData/reviewForms.json');
    if (!fs.existsSync(filePath)) throw new Error(`JSON file not found: ${filePath}`);

    const rawData = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(rawData);

    if (!jsonData.textReviewScenarios || !Array.isArray(jsonData.textReviewScenarios)) {
        throw new Error('JSON does not contain "textReviewScenarios" array');
    }

    testData = jsonData.textReviewScenarios;
    console.log('Loaded media scenarios:', testData.map(s => s.scenarioId));
});

// ----------------------
// Open media form for scenario
// ----------------------
Given('media user opens media review form for scenario {string}', async function (scenarioId) {
    currentScenario = testData.find(s => s.scenarioId?.trim() === scenarioId.trim());
    if (!currentScenario) {
        console.error('Available scenario IDs:', testData.map(s => s.scenarioId));
        throw new Error(`Scenario ${scenarioId} not found`);
    }

    // Attach to World context if possible, otherwise use local variable
    mediaPage = new MediaPage(this.page);
    await mediaPage.navigateTo(currentScenario.url);
    console.log(`Opened URL for scenario ${scenarioId}: ${currentScenario.url}`);
});

// ----------------------
// Click Upload Video/Audio
// ----------------------
// Using Regex to safely handle the forward slash
When(/^media user clicks on the Upload Video\/Audio button$/, async function () {
    await mediaPage.clickUploadVideoAudioButton();
});

When(/^media user clicks on the Upload Audio button$/, async function () {
    await mediaPage.clickUploadAudioButton();
});

// ----------------------
// Upload media file
// ----------------------
When('media user uploads the media file', async function () {
    const filePath = currentScenario.media?.filePath;
    if (!filePath) throw new Error(`No media file path for scenario ${currentScenario.scenarioId}`);

    console.log(`[mediaSteps] Uploading file from path: ${filePath}`);

    if (currentScenario.media?.fileType === 'audio') {
        await mediaPage.uploadAudio(filePath);
    } else {
        await mediaPage.uploadMedia(filePath);
    }
});

// ----------------------
// Enter user details
// ----------------------
When('media user enters user details', async function () {
    const user = currentScenario.user || {};
    await mediaPage.enterUserDetails(user);
});

// ----------------------
// Click final submit
// ----------------------
When('media user clicks the Submit button', async function () {
    await mediaPage.clickSubmit();
});

// ----------------------
// Verify success message
// ----------------------
Then('media user should see success message', async function () {
    const expectedMessage = currentScenario.expected.successMessage;
    // Don't error if not present, but useful for debugging
    if (!expectedMessage) console.log("No explicit success message in JSON to verify text, checking visibility only.");
    await mediaPage.verifySuccessMessage(expectedMessage);
});

Then('media user should see error message', async function () {
    if (currentScenario.expected.errorMessage) {
        await mediaPage.verifyErrorMessage('duration', currentScenario.expected.errorMessage);
    } else if (currentScenario.expected.fileTypeErrorMessage) {
        await mediaPage.verifyErrorMessage('fileType', currentScenario.expected.fileTypeErrorMessage);
    } else {
        throw new Error('No expected errorMessage or fileTypeErrorMessage in scenario JSON');
    }
});

// ----------------------
// Close browser / form
// ----------------------
Then('media user closes the browser', async function () {
    await mediaPage.clickClose();
});
