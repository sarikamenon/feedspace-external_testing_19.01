const { Given, When, Then } = require('@cucumber/cucumber');
const { TextReviewPage } = require('../pages/TextReviewPage');
const fs = require('fs');
const path = require('path');

let testData = [];
let currentScenario;
let reviewPage;

Given('user loads test data from JSON file', async function () {
    const filePath = path.resolve(process.cwd(), 'testData/reviewForms.json');
    const data = fs.readFileSync(filePath, 'utf8');
    const jsonData = JSON.parse(data);
    if (!jsonData.textReviewScenarios) throw new Error('JSON must contain textReviewScenarios array');
    testData = jsonData.textReviewScenarios;
    console.log(`Loaded ${testData.length} scenarios from JSON file`);
});

Given('user opens public review form for scenario {string}', async function (scenarioId) {
    currentScenario = testData.find(s => s.scenarioId === scenarioId);
    if (!currentScenario) throw new Error(`Scenario ${scenarioId} not found in JSON`);

    reviewPage = new TextReviewPage(this.page);
    await reviewPage.navigateTo(currentScenario.url);
    console.log(`Opened URL: ${currentScenario.url}`);
});

When('user clicks on the Write Your Experience button', async function () {
    await reviewPage.clickWriteExperience();
});

When('user clicks on the Write Your Feedback button', async function () {
    await reviewPage.clickWriteExperience();
});

When('user enters the feedback in the submit feedback field', async function () {
    await reviewPage.enterReviewText(currentScenario.reviewText);
});

When('user clicks on the Submit Feedback button', async function () {
    await reviewPage.clickSubmitFeedback();
});

When('user uploading the media file', async function () {
    const photoPath = currentScenario.mediaPhoto || (currentScenario.user && currentScenario.user.photo);
    if (!photoPath) throw new Error('No photo path found in scenario data for upload step');
    await reviewPage.uploadMedia(photoPath);
});

When('user uploads the media file', async function () {
    const photoPath = currentScenario.mediaPhoto || (currentScenario.user && currentScenario.user.photo);
    if (!photoPath) throw new Error('No photo path found in scenario data for upload step');
    await reviewPage.uploadMedia(photoPath);
});

When('user enters the user details', async function () {
    // For SCN004 (media scenario), photo is already uploaded in the previous step.
    // We should create a copy of the user object WITHOUT the photo to prevent double-upload attempt in enterUserDetails.
    if (currentScenario.scenarioId === 'SCN004' || currentScenario.type === 'media upload validation') {
        console.log('SCN004 detected: Skipping photo in enterUserDetails (upload handled separately)');
        const userDetails = { ...currentScenario.user };
        delete userDetails.photo;
        await reviewPage.enterUserDetails(userDetails);
    } else {
        await reviewPage.enterUserDetails(currentScenario.user);
    }
});

When('user clicks on the Final Submit button', async function () {
    await reviewPage.clickFinalSubmit();
});

Then('user should see success confirmation message', async function () {
    const expectedMessage = currentScenario.expected.successMessage;
    await reviewPage.verifySuccessMessage(expectedMessage);
});

Then('user should see mandatory field validation messages', async function () {
    const expectedErrors = currentScenario.expected.validationErrors;
    await reviewPage.verifyValidationErrors(expectedErrors);
});

Then('user should see inactive form message', async function () {
    const expectedMessage = currentScenario.expected.inactiveMessage;
    await reviewPage.verifyInactiveMessage(expectedMessage);
});

Then('user should see thank you page details', async function () {
    const expectedDetails = currentScenario.expected.thankYouPage;
    if (!expectedDetails) throw new Error('No thankYouPage expectation found in scenario');
    await reviewPage.verifyThankYouPage(expectedDetails);
});

Then('user closes the browser', async function () {
    await reviewPage.clickClose();
});



When('user enters the review text', async function () {
    console.log(`DEBUG: Current Scenario ID: ${currentScenario.scenarioId}`);
    console.log(`DEBUG: Full Scenario: ${JSON.stringify(currentScenario, null, 2)}`);

    // Check root level 'reviewText', 'reviewuserText', 'thankYouReviewText', 'userReviewText', 'mediaReviewText' OR 'user.userReviewText'
    let text = currentScenario.reviewText || currentScenario.reviewuserText || currentScenario.thankYouReviewText || currentScenario.userReviewText || currentScenario.mediaReviewText;

    if (!text && currentScenario.user) {
        text = currentScenario.user.userReviewText || currentScenario.user.reviewText;
    }

    if (!text) throw new Error(`No review text found in currentScenario. Checked root reviewText, reviewuserText, user.userReviewText, and user.reviewText. Scenario content: ${JSON.stringify(currentScenario)}`);
    await reviewPage.enterReviewText(text);
});

// SCN005: Thank You Page Steps
Given('user submits the review successfully', async function () {
    // Reusing existing flow for submission
    await reviewPage.clickWriteExperience();

    // Check if review text is needed
    let text = currentScenario.reviewText || (currentScenario.user && currentScenario.user.reviewText) || "Great experience!";
    await reviewPage.enterReviewText(text);

    if (currentScenario.user && currentScenario.user.photo) {
        try {
            await reviewPage.uploadMedia(currentScenario.user.photo);
        } catch (e) {
            console.log("Upload failed or skipped: " + e.message);
        }
    }

    await reviewPage.clickSubmitFeedback();

    // Create copy of user without photo for the details step
    const userWithoutPhoto = { ...currentScenario.user };
    delete userWithoutPhoto.photo;

    // Wait short time for transition
    await reviewPage.page.waitForTimeout(1000);

    await reviewPage.enterUserDetails(userWithoutPhoto);
    await reviewPage.clickFinalSubmit();
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


When('user clicks on the Upload button', async function () {
    // Rely on uploadMedia functionality which handles finding the trigger button
});

Then('signup button text should be {string}', async function (btnText) {
    await reviewPage.verifyThankYouPage({ signupButtonText: btnText });
});
