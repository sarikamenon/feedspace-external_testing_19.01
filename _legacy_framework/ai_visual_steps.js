const { Given, Then } = require('@cucumber/cucumber');
const path = require('path');

Given('I load the widget URL {string}', async function (url) {
    const WidgetPage = require(path.join(process.cwd(), 'pages', 'WidgetPage.js'));
    this.widgetPage = new WidgetPage(this.page);
    await this.widgetPage.navigate(url);
});

Then('I validate the widget visually using AI analysis', async function () {
    if (this.widgetPage) {
        await this.widgetPage.validateWithAI();
        await this.widgetPage.generateReport();
    }
});
