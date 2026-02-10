const XLSX = require('xlsx');
const path = require('path');

const data = [
    { Url: "https://www.needingadvice.co.uk/", WebsiteName: "needingadvice_co_uk" },
    { Url: "https://plurality.network/", WebsiteName: "plurality_network" },
    { Url: "https://rateswitchrewards.co.uk/", WebsiteName: "rateswitchrewards_co_uk" },
    { Url: "http://samantus.com/", WebsiteName: "samantus_com" },
    { Url: "https://www.schoolofpodcasting.com/", WebsiteName: "schoolofpodcasting_com" }
];

const ws = XLSX.utils.json_to_sheet(data);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, "URLs");

const filePath = path.join(__dirname, 'widgetUrls.xlsx');
XLSX.writeFile(wb, filePath);
console.log(`Excel file created at: ${filePath}`);
