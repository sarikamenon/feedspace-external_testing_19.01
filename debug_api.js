const https = require('https');

const API_URL = 'https://api.feedspace.io/v3/embed-widget-urls';
console.log(`Testing connection to ${API_URL}...`);

const req = https.get(API_URL, (res) => {
    console.log(`Status Code: ${res.statusCode}`);
    console.log(`Headers: ${JSON.stringify(res.headers, null, 2)}`);

    let data = '';
    res.on('data', (chunk) => data += chunk);
    res.on('end', () => {
        console.log('Body length:', data.length);
        try {
            const json = JSON.parse(data);
            console.log('JSON Keys:', Object.keys(json));
            const dataArray = Array.isArray(json) ? json : (json.data || json.results || []);
            console.log('Is Array?', Array.isArray(json));
            console.log('Found array of length:', dataArray.length);
            if (dataArray.length > 0) {
                console.log('First Item Sample:', JSON.stringify(dataArray[0], null, 2).substring(0, 500));
            }
        } catch (e) {
            console.error('Failed to parse JSON:', e.message);
            console.log('Raw data snippet:', data.substring(0, 500));
        }
    });
});

req.on('error', (err) => {
    console.error('Network Error:', err.message);
    console.error('Full Error:', err);
});

req.on('timeout', () => {
    console.error('Request Timed Out');
    req.destroy();
});

// Set a 10s timeout
req.setTimeout(10000);
