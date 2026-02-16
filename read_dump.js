const fs = require('fs');
const filePath = process.argv[2] || 'debug_output_verification_final.txt';
try {
    const content = fs.readFileSync(filePath, 'utf16le');
    console.log(content);
} catch (e) {
    console.error(`Error reading file ${filePath}: ${e.message}`);
}
