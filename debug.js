const { WallOfLovePage } = require('./pages/WallOfLovePage');

// Mock content
const mockPage = {
    locator: () => ({ first: () => ({}), count: async () => 0 }),
    viewportSize: () => ({ width: 1280, height: 720 }),
};

async function test() {
    console.log("Starting debug test...");
    try {
        const wol = new WallOfLovePage(mockPage);
        // Set some dummy data
        wol.reviewCounts = { total: 10, text: 5, video: 5 };
        wol.passedChecks = ['Test Check 1', 'Test Check 2'];
        wol.findings = [];

        console.log("Generating report...");
        await wol.generateHTMLAuditReport();
        console.log("Done.");
    } catch (e) {
        console.error("ERROR:", e);
    }
}

test();
