const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const url = 'https://www.feedspace.io/widget/550b3106-588f-4e0e-be8b-c81e456a06d3?info=1';

    console.log(`Navigating to ${url}...`);

    page.on('response', async response => {
        const u = response.url();
        if (response.headers()['content-type']?.includes('json')) {
            try {
                const json = await response.json();
                console.log(`\nResponse: ${u}`);
                console.log('Keys:', Object.keys(json).slice(0, 5));
                if (json.data) console.log('Data Keys:', Object.keys(json.data).slice(0, 5));
            } catch (e) { }
        }
    });

    await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
    console.log('Done.');
    await browser.close();
})();
