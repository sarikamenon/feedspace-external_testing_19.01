const { expect } = require('@playwright/test');

class TextReviewPage {
    constructor(page) {
        this.page = page;

        // Buttons
        this.writeExperienceBtn = this.page.locator('#text-review'); // "Write Your Experience"
        this.submitFeedbackBtn = this.page.locator('#submit-text-review, .feedspace-button-inner:has-text("Submit Testimonial"), span:has-text("Submit Testimonial"), button:has-text("Submit Testimonial"), button:has-text("Submit Feedback"), span:has-text("Submit Feedback")').first();
        this.finalSubmitBtn = this.page.locator('#submit-btn');
        this.closeBtn = this.page.locator('#feed-form-close-btn, button[id="feed-form-close-btn"]');

        // Inputs
        // Targeted visible text area to avoid hidden duplicates
        this.feedbackTextField = this.page.locator('#text-review-comment:visible, textarea[name="comment"]:visible').first();
        this.nameInput = this.page.locator('#user-name');
        this.contactInput = this.page.locator('#user-contact_number');

        // File Upload
        // User specific locator for SCN004: span:has-text("Drop your file here or")
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

    // Navigate to URL
    async navigateTo(url) {
        await this.page.goto(url);
    }

    // Click "Write Your Experience" with retries
    async clickWriteExperience() {
        console.log('Looking for Write Your Experience button...');
        // Robust locator from user snippet
        const writeBtn = this.page.locator('#preview-write-text, button:has(#preview-write-text), button:has-text("Write Your Experience"), button:has-text("Write Your Feedback")').first();

        // Retry loop to click 'Write Your Feedback' and wait for field to be visible
        const maxRetries = 5;
        let attempt = 0;

        while (attempt < maxRetries) {
            console.log(`Attempting click ${attempt + 1}/${maxRetries}...`);

            try {
                // Try force click even if checking visibility fails (matches user snippet logic)
                await writeBtn.click({ force: true });
            } catch (e) {
                console.warn('Error clicking write button:', e.message);
            }

            try {
                // Wait briefly for the field to appear
                await this.feedbackTextField.waitFor({ state: 'visible', timeout: 5000 });
                console.log('Feedback field appeared.');
                return;
            } catch (e) {
                console.warn('Feedback field did not appear yet.');
            }

            attempt++;
            await this.page.waitForTimeout(1000); // Wait before retry
        }

        // Final check if already visible
        if (await this.feedbackTextField.isVisible()) {
            console.log('Feedback field is visible (final check).');
            return;
        }

        throw new Error('Feedback field did not become visible after multiple attempts.');
    }

    // Fill feedback form
    // Fill feedback form
    // Fill review text
    async enterReviewText(reviewText) {
        console.log(`ENTERING REVIEW TEXT: "${reviewText}"`);
        await this.feedbackTextField.waitFor({ state: 'visible', timeout: 5000 });

        if (reviewText) {
            console.log('Filling feedback text field...');
            await this.feedbackTextField.click();
            await this.feedbackTextField.fill(reviewText);
            // Verify text stuck
            await expect(this.feedbackTextField).toHaveValue(reviewText, { timeout: 3000 });
        }
    }

    // Fill user details (Name, Contact, Photo)
    async enterUserDetails(user) {
        console.log('ENTERING USER DETAILS:', JSON.stringify(user));

        if (user.name) {
            await this.nameInput.waitFor({ state: 'visible', timeout: 5000 });
            await this.nameInput.fill(user.name);
        }

        if (user.contact) {
            await this.contactInput.fill(user.contact);
        }

        if (user.photo) {
            console.log(`Starting file upload for: ${user.photo}`);
            const absolutePath = require('path').resolve(user.photo);
            console.log(`Resolved absolute path for user photo: ${absolutePath}`);

            try {
                // Force User-Interaction Strategy: Click trigger and wait for file chooser
                // This ensures the UI events are fired correctly.
                console.log('Initiating file chooser flow...');

                // Ensure trigger is visible before clicking
                await this.uploadTrigger.waitFor({ state: 'visible', timeout: 5000 });

                const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 10000 });
                await this.uploadTrigger.click();

                const fileChooser = await fileChooserPromise;
                await fileChooser.setFiles(absolutePath);

                console.log('File chooser handled and files set.');
            } catch (e) {
                console.error(`FATAL ERROR uploading file: ${e.message}`);
                throw e;
            }
        }
    }



    // Explicit media upload for SCN004
    async uploadMedia(filePath) {
        console.log(`Explicitly uploading media: ${filePath}`);
        // Ensure absolute path
        const absolutePath = require('path').resolve(filePath);
        console.log(`Resolved absolute path: ${absolutePath}`);

        try {
            // Ensure trigger is visible before clicking
            // SCN004 uses the 'span' locator specifically
            const trigger = this.page.locator('span:has-text("Drop your file here or")').first();
            await trigger.waitFor({ state: 'visible', timeout: 5000 });

            const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 10000 });
            await trigger.click();

            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(absolutePath);

            console.log('Media file uploaded successfully.');
        } catch (e) {
            console.error(`Error in uploadMedia: ${e.message}`);
            throw e;
        }
    }

    // Click Submit Feedback button
    async clickSubmitFeedback() {
        if (await this.submitFeedbackBtn.isVisible({ timeout: 5000 })) {
            await this.submitFeedbackBtn.click({ force: true });
        } else {
            console.warn('Submit Feedback button not visible.');
        }
    }

    // Click Final Submit button (for mandatory validation)
    async clickFinalSubmit() {
        if (await this.finalSubmitBtn.isVisible({ timeout: 5000 })) {
            await this.finalSubmitBtn.click({ force: true });
        } else {
            console.warn('Final Submit button not visible.');
        }
    }

    // Legacy fillForm using the above steps
    async fillForm(user) {
        await this.clickWriteExperience();
        await this.enterFeedback(user);
    }

    // Legacy submit using the above steps
    async submit() {
        console.log('Submitting feedback...');
        await this.clickSubmitFeedback();
        await this.clickFinalSubmit();
    }

    // Verify mandatory field validation errors
    async verifyValidationErrors(expectedErrors) {
        console.log('Verifying validation errors:', expectedErrors);

        if (expectedErrors.includes("Please upload a photo.")) {
            await expect(this.logoError).toHaveText("Please upload a photo.", { timeout: 5000 });
        }

        const requiredCount = expectedErrors.filter(e => e === "This field is required.").length;
        if (requiredCount > 0) await expect(this.nameError).toHaveText("This field is required.", { timeout: 5000 });
        if (requiredCount > 1) await expect(this.emailError).toHaveText("This field is required.", { timeout: 5000 });
        if (requiredCount > 2) await expect(this.contactError).toHaveText("This field is required.", { timeout: 5000 });
    }

    // Verify success message
    async verifySuccessMessage(message) {
        await expect(this.successMessage).toBeVisible({ timeout: 10000 });
        if (message) await expect(this.successMessage).toContainText(message);
    }

    // Verify Thank You page
    async verifyThankYouPage(details) {
        console.log('Verifying Thank You page details:', JSON.stringify(details));
        if (details.headerText) await expect(this.page.getByText(details.headerText)).toBeVisible();
        if (details.descriptionText) await expect(this.page.getByText(details.descriptionText)).toBeVisible();

        if (details.shareLink && details.shareLink.shouldHaveValue) {
            await expect(this.shareLink).toBeVisible();
            await expect(this.shareLink).not.toBeEmpty();
        }

        if (details.platformButtons && details.platformButtons.shouldHaveValue) {
            await expect(this.platformButtons).toBeVisible();
        }

        if (details.socialIcons && Array.isArray(details.socialIcons)) {
            for (const icon of details.socialIcons) {
                let iconLocator;
                if (icon === 'WhatsApp') iconLocator = this.page.locator('#feed-share-whatsapp');
                else if (icon === 'X') iconLocator = this.page.locator('#feed-share-twitter');
                else if (icon === 'LinkedIn') iconLocator = this.page.locator('#feed-share-linkedin');
                else if (icon === 'Facebook') iconLocator = this.page.locator('#feed-share-facebook');
                else iconLocator = this.page.locator(`[aria-label="${icon}"], img[alt="${icon}"]`); // Fallback

                await expect(iconLocator).toBeVisible();
            }
        }

        if (details.signupButtonText) {
            // Use specific locator if text matches user request
            if (details.signupButtonText === "Got it, let's signup") {
                await expect(this.signupButton).toBeVisible();
            } else {
                await expect(this.page.getByRole('button', { name: details.signupButtonText })).toBeVisible();
            }
        }
    }

    // Verify inactive form message
    async verifyInactiveMessage(expectedMessage) {
        console.log(`Verifying inactive message: "${expectedMessage}"`);
        await expect(this.inactiveMessage).toBeVisible({ timeout: 10000 });
        if (expectedMessage) {
            await expect(this.inactiveMessage).toHaveText(expectedMessage);
        }
    }

    // Close form
    async clickClose() {
        if (await this.closeBtn.count() > 0) {
            await this.closeBtn.first().click();
        }
    }
}

module.exports = { TextReviewPage };
