const { expect } = require('@playwright/test');
const fs = require('fs');

class MediaPage {
    constructor(page) {
        this.page = page;

        // key: Using role-based locators as per codegen
        this.uploadVideoAudioBtn = this.page.getByRole('button', { name: 'Upload Video/Audio' });
        this.submitBtn = this.page.getByRole('button', { name: 'Submit' });
        this.closeBtn = this.page.locator('#feed-form-close-btn, button[id="feed-form-close-btn"]');
        this.uploadAudioBtn = this.page.locator('#upload-file');

        // Note: Codegen suggests setting input files directly on the button/associated input
        this.fileUploadInput = this.page.locator('input[type="file"]').first();

        // User Details Inputs
        this.nameInput = this.page.getByRole('textbox', { name: 'Eg. Henry Ford' });
        this.contactInput = this.page.getByRole('textbox', { name: 'Eg. +' });

        //Success message
        this.successMessage = this.page.locator('#preview-thankyou-description > p').or(this.page.locator('text="Thank You"'));
        this.durationErrorMessage = this.page.locator('.feedspace-error-message');
        this.fileFormatErrorMessage = this.page.getByRole('heading', { name: 'File format not supported!' });
    }

    async navigateTo(url) {
        console.log(`Navigating to ${url}...`);
        const maxRetries = 3;
        for (let i = 0; i < maxRetries; i++) {
            try {
                console.log(`Navigating to ${url} (Attempt ${i + 1}/${maxRetries})...`);
                await this.page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
                console.log('Navigation completed.');
                return;
            } catch (e) {
                console.warn(`Navigation failed (Attempt ${i + 1}): ${e.message}`);
                if (i === maxRetries - 1) throw e;
                await this.page.waitForTimeout(1000); // Wait before retry
            }
        }
    }

    // Step 1: Click the main "Upload Video/Audio" button to open the popup
    // Step 1: Click the main "Upload Video/Audio" button
    // Updated: Since uploadMedia() handles the click + file chooser events atomically,
    // this method just ensures the button is in view/ready.
    async clickUploadVideoAudioButton() {
        console.log('Preparing Upload Video/Audio button...');
        await this.uploadVideoAudioBtn.scrollIntoViewIfNeeded();
        // We do NOT click here anymore because the 'When user uploads...' step calls uploadMedia()
        // which performs the click AND handles the file chooser.
        // If we click here, the file chooser might open and hang without a listener.
        console.log('Upload button ready for interaction.');
    }

    async clickUploadAudioButton() {
        console.log('Preparing Upload Audio button...');
        await this.uploadAudioBtn.scrollIntoViewIfNeeded();
        console.log('Upload Audio button ready for interaction.');
    }

    // Step 2: Upload the media file (interacting with the popup)
    async uploadMedia(filePath) {
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        console.log(`Uploading media: ${filePath}`);

        try {
            // Logic adapted from SCN004 (TextReviewPage) but using 'Upload Video/Audio' button
            console.log('Initiating file chooser flow on Upload Video/Audio button...');

            // Ensure button is visible before clicking
            await this.uploadVideoAudioBtn.waitFor({ state: 'visible', timeout: 5000 });

            const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 15000 });
            await this.uploadVideoAudioBtn.click(); // Click the main upload button directly

            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(filePath);

            console.log('Media file set via file chooser.');

            // Wait for processing
            await this.page.waitForTimeout(5000);
        } catch (e) {
            console.warn(`[Expected behavior if using custom button] File chooser did not open via button click (Timeout). 
            Message: ${e.message}. 
            Proceeding to fallback (hidden input)...`);

            // Fallback: Setting on file input directly if button interaction fails
            if (await this.fileUploadInput.count() > 0) {
                console.log('Fallback: Setting files on hidden input...');
                await this.fileUploadInput.setInputFiles(filePath);
            } else {
                throw e;
            }
        }
    }

    async uploadAudio(filePath) {
        if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);
        console.log(`Uploading audio: ${filePath}`);

        try {
            const fileChooserPromise = this.page.waitForEvent('filechooser', { timeout: 15000 });
            // Click #upload-file directly as per user requirement
            await this.uploadAudioBtn.click();
            const fileChooser = await fileChooserPromise;
            await fileChooser.setFiles(filePath);
            console.log('Audio file set via file chooser.');
            await this.page.waitForTimeout(5000);
        } catch (e) {
            console.warn(`[Expected behavior if using custom button] Audio file chooser did not open via button click (Timeout).
            Message: ${e.message}.
            Proceeding to fallback (hidden input)...`);
            // Fallback
            if (await this.fileUploadInput.count() > 0) {
                console.log('Fallback: Setting files on hidden input...');
                await this.fileUploadInput.setInputFiles(filePath);
            } else {
                throw e;
            }
        }
    }

    async enterUserDetails(user) {
        console.log('Entering user details:', user);
        // Wait for fields to become visible after upload
        await this.nameInput.waitFor({ state: 'visible', timeout: 10000 });

        if (user.name) await this.nameInput.fill(user.name);
        if (user.contact) await this.contactInput.fill(user.contact);
    }

    async clickSubmit() {
        console.log('Clicking Submit button...');
        await this.submitBtn.scrollIntoViewIfNeeded();
        await this.submitBtn.click({ force: true });
        console.log('Submit clicked.');
    }

    async clickClose() {
        if (await this.closeBtn.count() > 0) {
            await this.closeBtn.first().click();
            console.log('Closed form.');
        }
    }

    async verifySuccessMessage(expectedMessage) {
        const successLoc = this.successMessage.first();
        console.log('Verifying success message...');

        // Robustness: Wait for element to be attached first
        await successLoc.waitFor({ state: 'attached', timeout: 30000 });

        // Ensure it is scrolled into view (sometimes it's below the fold or behind headers)
        await successLoc.scrollIntoViewIfNeeded();

        // Check visibility
        await expect(successLoc).toBeVisible({ timeout: 15000 });

        if (expectedMessage) {
            await expect(successLoc).toContainText(expectedMessage);
        }
        console.log('Success message verified.');
    }

    async verifyErrorMessage(type, expectedMessage) {
        if (type === 'fileType') {
            await expect(this.fileFormatErrorMessage).toBeVisible({ timeout: 10000 });
            if (expectedMessage) await expect(this.fileFormatErrorMessage).toContainText(expectedMessage);
        } else {
            // Default/Duration error
            await expect(this.durationErrorMessage).toBeVisible({ timeout: 10000 });
            if (expectedMessage) await expect(this.durationErrorMessage).toContainText(expectedMessage);
        }
        console.log(`${type} error message verified.`);
    }
}

module.exports = { MediaPage };
