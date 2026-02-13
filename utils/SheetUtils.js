const https = require('https');

class SheetUtils {
    /**
     * Fetches a Google Sheet as CSV and returns it as an array of objects.
     * Uses the /export?format=csv endpoint for auth-less access to public/shared sheets.
     * @param {string} sheetUrl The full Google Sheet URL
     * @returns {Promise<Array<Object>>}
     */
    static async fetchGoogleSheet(sheetUrl) {
        // Convert edit URL to export URL if it looks like a standard edit URL
        let exportUrl = sheetUrl;
        if (sheetUrl.includes('/edit')) {
            exportUrl = sheetUrl.replace(/\/edit.*$/, '/export?format=csv');
            if (sheetUrl.includes('gid=')) {
                const gid = sheetUrl.split('gid=')[1].split('&')[0];
                exportUrl += `&gid=${gid}`;
            }
        }

        console.log(`[SheetUtils] Fetching data from: ${exportUrl}`);

        return new Promise((resolve, reject) => {
            https.get(exportUrl, (res) => {
                // Handle Redirects
                if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                    console.log(`[SheetUtils] Redirecting (Status ${res.statusCode}) to: ${res.headers.location}`);
                    // Recursive call for redirect
                    return this.fetchGoogleSheet(res.headers.location)
                        .then(resolve)
                        .catch(reject);
                }

                if (res.statusCode !== 200) {
                    reject(new Error(`Failed to fetch sheet: Status ${res.statusCode}`));
                    return;
                }

                let data = '';
                res.on('data', (chunk) => data += chunk);
                res.on('end', () => {
                    const rows = this.parseCsv(data);
                    resolve(rows);
                });
            }).on('error', (err) => reject(err));
        });
    }

    /**
     * Minimal CSV parser to convert CSV string to Array of Objects.
     * Handles basic quoted strings.
     */
    static parseCsv(csvText) {
        const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) return [];

        const headers = this.splitCsvLine(lines[0]);
        const results = [];

        for (let i = 1; i < lines.length; i++) {
            const values = this.splitCsvLine(lines[i]);
            const obj = {};
            headers.forEach((header, index) => {
                obj[header.trim()] = values[index] ? values[index].trim() : '';
            });
            results.push(obj);
        }
        return results;
    }

    static splitCsvLine(line) {
        const result = [];
        let cur = '';
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
            const char = line[i];
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(cur);
                cur = '';
            } else {
                cur += char;
            }
        }
        result.push(cur);
        return result.map(s => s.replace(/^"|"$/g, ''));
    }
}

module.exports = { SheetUtils };
