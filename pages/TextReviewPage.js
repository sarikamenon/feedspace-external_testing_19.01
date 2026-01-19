const { expect } = require('@playwright/test');
const path = require('path');

class TextReviewPage {
    constructor(page) {
        this.page = page;

        // Buttons
        this.writeExperienceBtn = this.page.locator('#text-review, button:has-text("Write Your Experience"), button:has-text("Write Your Feedback")');
        this.submitFeedbackBtn = this.page.locator('#submit-text-review, button:has-text("Submit Feedback"), span:has-text("Submit Feedback")').first();
        this.finalSubmitBtn = this.page.locator('#submit-btn');
        this.closeBtn = this.page.locator('#feed-form-close-btn, button[id="feed-form-close-btn"]');

        // Inputs
        this.feedbackTextField = this.page.locator('#text-review-comment:visible, textarea[name="comment"]:visible').first();
        this.nameInput = this.page.locator('#user-name');
        this.contactInput = this.page.locator('#user-contact_number');

        // File Upload
        this.uploadTrigger = this.page.locator('#select-file-button').or(this.page.locator('span:has-text("Drop your file here or")'));
        this.fileUploadInput = this.page.locator('input[type="file"]').first();

        // Validation Errors
        this.logoError = this.page.locator('#logo-input-error');
        this.nameError = this.page.locator('#user-name-error');
        this.emailError = this.page.locator('#user-email-error');
        this.contactError = this.page.locator('#user-contact_number-error');

        // Success / Thank You
        this.successMessage = this.page.locator('#preview-thankyou-description > p').or(this.page.locator('text="Thank You"'));
        this.shareLink = this.page.locator('#share-link-text');
        this.platformButtons = this.page.locator('.feedspace-platform-buttons');
        this.signupButton = this.page.locator('span:has-text("Got it, let\'s signup")');

        // Inactive Form
        this.inactiveMessage = this.page.locator('.feedspace-paused-form-title');
    }

    // Navigate to URL with retry
    async navigateTo(url) {
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`Navigating to ${url} (Attempt ${i + 1}/${maxRetries})...`);
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                return;
            } catch (e) {
                console.warn(`Navigation failed (Attempt ${i + 1}): ${e.message}`);
                if (i === maxRetries - 1) throw e;
                await this.page.waitForTimeout(1000); // Wait before retry
            }
        }
    }

    // Click "Write Your Experience" robustly
    async clickWriteExperience() {
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            try {
                await this.writeExperienceBtn.first().waitFor({ state: 'visible', timeout: 5000 });
                await this.writeExperienceBtn.first().click({ force: true });
                await this.feedbackTextField.waitFor({ state: 'visible', timeout: 5000 });
                return;
            } catch (e) {
                console.warn(`Attempt ${i + 1} failed: ${e.message}`);
                await this.page.waitForTimeout(1000);
            }
        }
        throw new Error('Write Your Experience button / feedback field not visible after retries.');
    }

    // Fill review text
    async enterReviewText(text) {
        if (!text) return;
        await this.feedbackTextField.waitFor({ state: 'visible', timeout: 5000 });
        await this.feedbackTextField.fill(text);
        await expect(this.feedbackTextField).toHaveValue(text, { timeout: 3000 });
    }

    // Fill user details and upload photo if present
    async enterUserDetails(user) {
        if (!user) return;

        if (user.name) await this.nameInput.fill(user.name, { force: true });
        if (user.contact) await this.contactInput.fill(user.contact, { force: true });

        if (user.photo) {
            const absolutePath = path.resolve(user.photo);
            await this.uploadTrigger.waitFor({ state: 'visible', timeout: 5000 });
            const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 10000 });
            await this.uploadTrigger.click();
            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(absolutePath);
        }
    }

    // Explicit media upload (for SCN004 / media scenarios)
    async uploadMedia(filePath) {
        if (!filePath) throw new Error('No file path provided for media upload');
        const absolutePath = path.resolve(filePath);
        await this.uploadTrigger.waitFor({ state: 'visible', timeout: 5000 });
        const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 10000 });
        await this.uploadTrigger.click();
        const fileChooser = await fileChooserPromise;
        await fileChooser.setFiles(absolutePath);
    }

    // Click Submit Feedback button
    async clickSubmitFeedback() {
        if (await this.submitFeedbackBtn.isVisible({ timeout: 5000 })) {
            await this.submitFeedbackBtn.click({ force: true });
        }
    }

    // Click Final Submit button
    async clickFinalSubmit() {
        if (await this.finalSubmitBtn.isVisible({ timeout: 5000 })) {
            await this.finalSubmitBtn.click({ force: true });
        }
    }

    // Verify mandatory field errors
    async verifyValidationErrors(expectedErrors) {
        if (expectedErrors.includes("Please upload a photo.")) await expect(this.logoError).toHaveText("Please upload a photo.");
        const requiredCount = expectedErrors.filter(e => e === "This field is required.").length;
        if (requiredCount > 0) await expect(this.nameError).toHaveText("This field is required.");
        if (requiredCount > 1) await expect(this.emailError).toHaveText("This field is required.");
        if (requiredCount > 2) await expect(this.contactError).toHaveText("This field is required.");
    }

    // Verify success message
    async verifySuccessMessage(message) {
        // Wait briefly for any animation/transition
        await this.page.waitForTimeout(1000);

        console.log('Verifying success message...');
        try {
            // Try explicit visible wait first
            await this.successMessage.first().waitFor({ state: 'visible', timeout: 10000 });
        } catch (e) {
            console.warn('Success message not immediately visible. Checking for issues...');
        }

        // Use a more specific locator if possible, or filter strict
        const visibleSuccess = this.successMessage.locator('visible=true').first();
        if (await visibleSuccess.count() > 0) {
            await expect(visibleSuccess).toBeVisible({ timeout: 5000 });
            if (message) await expect(visibleSuccess).toContainText(message);
        } else {
            // Fallback to original logic if filter fails
            await expect(this.successMessage.first()).toBeVisible({ timeout: 5000 });
            if (message) await expect(this.successMessage.first()).toContainText(message);
        }
    }

    // Verify Thank You page
    async verifyThankYouPage(details) {
        if (details.headerText) await expect(this.page.getByText(details.headerText)).toBeVisible();
        if (details.descriptionText) await expect(this.page.getByText(details.descriptionText)).toBeVisible();
        if (details.shareLink && details.shareLink.shouldHaveValue) await expect(this.shareLink).not.toBeEmpty();
        if (details.platformButtons && details.platformButtons.shouldHaveValue) await expect(this.platformButtons).toBeVisible();
        if (details.socialIcons && Array.isArray(details.socialIcons)) {
            for (const icon of details.socialIcons) {
                const locator = icon === 'WhatsApp' ? '#feed-share-whatsapp' :
                    icon === 'X' ? '#feed-share-twitter' :
                        icon === 'LinkedIn' ? '#feed-share-linkedin' :
                            icon === 'Facebook' ? '#feed-share-facebook' :
                                `[aria-label="${icon}"], img[alt="${icon}"]`;
                await expect(this.page.locator(locator)).toBeVisible();
            }
        }
        if (details.signupButtonText) await expect(this.signupButton).toBeVisible();
    }

    // Verify inactive form
    async verifyInactiveMessage(message) {
        await this.inactiveMessage.waitFor({ state: 'visible', timeout: 10000 });
        if (message) await expect(this.inactiveMessage).toHaveText(message);
    }

    // Close form
    async clickClose() {
        if (await this.closeBtn.count() > 0) await this.closeBtn.first().click();
    }
}

module.exports = { TextReviewPage };
