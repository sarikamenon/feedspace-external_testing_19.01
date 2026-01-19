# Feedspace External Testing Automation

This repository contains the BDD automation framework for Feedspace, built using **Playwright**, **Cucumber**, and the **Page Object Model (POM)** pattern.

## 🚀 Features

- **Text Reviews**: Automated verification of text review submissions.
- **Media Uploads**: Testing capabilities for image, video, and audio uploads.
- **Wall of Love**: Validation of the "Wall of Love" display and functionality.
- **Data-Driven**: Uses external JSON files (e.g., `testData/reviewForms.json`) for flexible test configuration.

## 📋 Prerequisites

- **Node.js**: Version 20 or higher recommended.
- **npm**: Comes with Node.js.

## 🛠️ Installation

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/sarikamenon/feedspace-external_testing_19.01.git
    cd feedspace-external_testing_19.01
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Install Playwright Browsers:**
    ```bash
    npx playwright install --with-deps
    ```

## ▶️ Running Tests

### Run All Tests (Windows Batch Script)
To run all feature files sequentially:
```bash
./run_all_features.bat
```

### Run Individual Features
You can run specific features using Cucumber-JS:

**Text Review:**
```bash
npx cucumber-js features/text_review.feature
```

**Media Upload:**
```bash
npx cucumber-js features/media_upload.feature
```

**Wall of Love:**
```bash
npx cucumber-js features/wol.feature
```

## 🤖 GitHub Actions Workflow

This project includes a continuous integration workflow:

- **File**: `.github/workflows/daily_tests.yml`
- **Schedule**: Runs automatically every day at **09:00 AM (UTC+4)**.
- **Manual Trigger**: Can be triggered manually from the "Actions" tab in GitHub.
- **Environment**: Runs on `windows-latest`.

## 📁 Project Structure

- `features/`: Gherkin feature files (.feature).
- `pages/`: Page Object Model classes.
- `step-definitions/`: Cucumber step definitions.
- `testData/`: JSON files for test data.
- `support/`: Helper functions and hooks.
- `reports/`: Test execution reports.
