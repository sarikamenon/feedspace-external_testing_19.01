const { Given, When, Then } = require('@cucumber/cucumber');
const { TextReviewPage } = require('../pages/TextReviewPage');
const fs = require('fs');
const path = require('path');

let testData = [];
let currentScenario;
let reviewPage;

// -----------------------------
// Load JSON Test Data
// -----------------------------
Given('user loads test data from JSON file', async function () {
    const filePath = path.resolve(process.cwd(), 'testData/reviewForms.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    if (!jsonData.textReviewScenarios) throw new Error('JSON must contain textReviewScenarios array');
    testData = jsonData.textReviewScenarios;
    console.log(`Loaded ${testData.length} scenarios from JSON file`);
});

// -----------------------------
// Open Public Review Form
// -----------------------------
Given('user opens public review form for scenario {string}', async function (scenarioId) {
    currentScenario = testData.find(s => s.scenarioId === scenarioId);
    if (!currentScenario) throw new Error(`Scenario ${scenarioId} not found in JSON`);

    reviewPage = new TextReviewPage(this.page);
    await reviewPage.navigateTo(currentScenario.url);
    console.log(`Opened URL: ${currentScenario.url}`);
});

// -----------------------------
// Click Buttons
// -----------------------------
When('user clicks on the Write Your Experience button', async function () {
    await reviewPage.clickWriteExperience();
});

When('user clicks on the Write Your Feedback button', async function () {
    await reviewPage.clickWriteExperience(); // Same method works for both buttons
});

When('user clicks on the Submit Feedback button', async function () {
    await reviewPage.clickSubmitFeedback();
});

When('user clicks on the Final Submit button', async function () {
    await reviewPage.clickFinalSubmit();
});

// -----------------------------
// Enter Text
// -----------------------------
When('user enters the feedback in the submit feedback field', async function () {
    const text = currentScenario.reviewText || (currentScenario.user && currentScenario.user.reviewText);
    await reviewPage.enterReviewText(text);
});

When('user enters the review text', async function () {
    const text = currentScenario.reviewText
        || (currentScenario.user && currentScenario.user.reviewText)
        || "Default review text";
    await reviewPage.enterReviewText(text);
});

// -----------------------------
// Upload Media
// -----------------------------
When('user uploads the media file', async function () {
    const photoPath = currentScenario.mediaPhoto || (currentScenario.user && currentScenario.user.photo);
    if (!photoPath) throw new Error('No photo path found in scenario data for upload step');
    await reviewPage.uploadMedia(photoPath);
});

// -----------------------------
// Enter User Details
// -----------------------------
When('user enters the user details', async function () {
    if (currentScenario.scenarioId === 'SCN004' || currentScenario.type === 'mediaUploadValidation') {
        // Skip photo for SCN004, already uploaded separately
        const userDetails = { ...currentScenario.user };
        delete userDetails.photo;
        await reviewPage.enterUserDetails(userDetails);
    } else {
        await reviewPage.enterUserDetails(currentScenario.user);
    }
});

// -----------------------------
// Success / Validation / Thank You
// -----------------------------
Then('user should see success confirmation message', async function () {
    const message = currentScenario.expected.successMessage;
    await reviewPage.verifySuccessMessage(message);
});

Then('user should see mandatory field validation messages', async function () {
    const expectedErrors = currentScenario.expected.validationErrors;
    await reviewPage.verifyValidationErrors(expectedErrors);
});

Then('user should see inactive form message', async function () {
    const message = currentScenario.expected.inactiveMessage;
    await reviewPage.verifyInactiveMessage(message);
});

Then('user should be navigated to the Thank You page', async function () {
    await reviewPage.verifySuccessMessage(null);
});

Then('share link text should have a non-empty value', async function () {
    await reviewPage.verifyThankYouPage({ shareLink: { shouldHaveValue: true } });
});

Then('platform buttons section should be visible and contain values', async function () {
    await reviewPage.verifyThankYouPage({ platformButtons: { shouldHaveValue: true } });
});

Then('the following social icons should be displayed:', async function (dataTable) {
    const icons = dataTable.raw().flat();
    await reviewPage.verifyThankYouPage({ socialIcons: icons });
});

Then('Thank You page header text should be {string}', async function (headerText) {
    await reviewPage.verifyThankYouPage({ headerText: headerText });
});

Then('Thank You page description text should be {string}', async function (descriptionText) {
    await reviewPage.verifyThankYouPage({ descriptionText: descriptionText });
});

Then('signup button text should be {string}', async function (btnText) {
    await reviewPage.verifyThankYouPage({ signupButtonText: btnText });
});

// -----------------------------
// Close Browser
// -----------------------------
Then('user closes the browser', async function () {
    await reviewPage.clickClose();
});
