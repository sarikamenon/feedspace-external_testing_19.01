const { request } = require('playwright');

(async () => {
    const context = await request.newContext();
    const url = 'https://keywords.am/';
    try {
        console.log(`Fetching ${url}...`);
        const response = await context.get(url);
        console.log(`Status: ${response.status()}`);
        console.log(`Content-Type: ${response.headers()['content-type']}`);
        const text = await response.text();
        console.log(`Body (first 100 chars): ${text.substring(0, 100)}`);
        try {
            JSON.parse(text);
            console.log('Valid JSON.');
        } catch (e) {
            console.log('Invalid JSON.');
        }
    } catch (e) {
        console.error(e);
    }
})();
