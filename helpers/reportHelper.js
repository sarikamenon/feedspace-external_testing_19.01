const fs = require('fs');
const path = require('path');

class ReportHelper {
    constructor() {
        this.reportDir = path.join(process.cwd(), 'reports');
        if (!fs.existsSync(this.reportDir)) {
            fs.mkdirSync(this.reportDir);
        }
    }

    async saveReport(data) {
        const timestamp = Date.now();
        const jsonFilename = `consolidated_report_${timestamp}.json`;
        const htmlFilename = `consolidated_report_${timestamp}.html`;

        const jsonPath = path.join(this.reportDir, jsonFilename);
        const htmlPath = path.join(this.reportDir, htmlFilename);

        fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
        console.log(`[ReportHelper] Saved JSON report to ${jsonPath}`);

        const htmlContent = this.generateHtml(data);
        fs.writeFileSync(htmlPath, htmlContent);
        console.log(`[ReportHelper] Saved HTML report to ${htmlPath}`);

        return htmlPath;
    }

    getBadgeClass(status) {
        switch (status) {
            case 'PASS': return 'pass';
            case 'FAIL': return 'fail';
            case 'WARNING': return 'warn';
            case 'ERROR': return 'error';
            default: return 'warn';
        }
    }

    generateHtml(data) {
        const { summary, runs } = data;

        return `
        <!DOCTYPE html>
        <html>
        <head>
            <title>AI Visual Validation Dashboard</title>
            <style>
                body { font-family: 'Segoe UI', sans-serif; padding: 30px; background: #f4f7f6; color: #333; }
                .container { max-width: 1200px; margin: 0 auto; }
                
                .header { background: #fff; padding: 20px; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.05); margin-bottom: 30px; }
                .dashboard { display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; margin-bottom: 30px; }
                .card { background: #fff; padding: 20px; border-radius: 8px; text-align: center; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
                .card h3 { margin: 0; color: #666; font-size: 14px; text-transform: uppercase; }
                .card .val { font-size: 32px; font-weight: bold; margin-top: 10px; }
                
                .total { border-left: 5px solid #2196f3; }
                .passed { border-left: 5px solid #4caf50; color: #2e7d32; }
                .failed { border-left: 5px solid #f44336; color: #c62828; }
                .errors { border-left: 5px solid #ff9800; color: #ef6c00; }

                .run-card { background: #fff; margin-bottom: 20px; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05); border: 1px solid #eee; }
                .run-header { padding: 15px 20px; background: #fafafa; display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; }
                .run-body { padding: 20px; }
                
                .badge { padding: 4px 12px; border-radius: 20px; font-size: 12px; font-weight: bold; text-transform: uppercase; }
                .pass { background: #e8f5e9; color: #2e7d32; }
                .fail { background: #ffebee; color: #c62828; }
                .error { background: #fff3e0; color: #ef6c00; }
                .warn { background: #f5f5f5; color: #616161; }

                table { width: 100%; border-collapse: collapse; margin-top: 15px; border-radius: 8px; overflow: hidden; }
                th, td { text-align: left; padding: 14px; border-bottom: 1px solid #eee; }
                th { background: #f1f5f9; font-weight: 600; color: #475569; text-transform: uppercase; font-size: 12px; letter-spacing: 0.05em; }
                
                .pass-row { background-color: #f0fdf4 !important; }
                .fail-row { background-color: #fef2f2 !important; }
                .warn-row { background-color: #fffbeb !important; }
                .pass-row td { color: #166534; }
                .fail-row td { color: #991b1b; }
                .warn-row td { color: #92400e; }
                
                .screenshot-prev { max-width: 400px; border: 1px solid #ddd; margin-top: 15px; border-radius: 4px; }
                pre { background: #272822; color: #f8f8f2; padding: 15px; border-radius: 4px; overflow-x: auto; font-size: 13px; }
                details { margin-top: 10px; }
                summary { cursor: pointer; color: #2196f3; font-weight: 500; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>AI Visual Validation Dashboard</h1>
                    <p>Generated: ${new Date().toLocaleString()}</p>
                </div>

                <div class="dashboard">
                    <div class="card total"><h3>Total Runs</h3><div class="val">${summary.total}</div></div>
                    <div class="card passed"><h3>Passed</h3><div class="val">${summary.passed}</div></div>
                    <div class="card failed"><h3>Failed</h3><div class="val">${summary.failed}</div></div>
                    <div class="card errors"><h3>Errors</h3><div class="val">${summary.errors}</div></div>
                </div>

                <h2>Detailed Results</h2>
                ${runs.map(run => `
                    <div class="run-card">
                        <div class="run-header">
                            <div>
                                <strong>${run.widgetType}</strong> | 
                                <a href="${run.url}" target="_blank">${run.url}</a>
                            </div>
                            <span class="badge ${this.getBadgeClass(run.status)}">${run.status}</span>
                        </div>
                        <div class="run-body">
                            ${run.error ? `<div style="color:red; padding:10px; background:#fff0f0; border-radius:4px;">Error: ${run.error}</div>` : `
                                <p>${run.aiAnalysis.message || 'No analysis message.'}</p>
                                
                                ${run.aiAnalysis.feature_results && run.aiAnalysis.feature_results.length > 0 ? `
                                    <table>
                                        <thead>
                                            <tr><th>Feature</th><th>Actual</th><th>Status</th><th>Notes / Warnings</th></tr>
                                        </thead>
                                        <tbody>
                                            ${run.aiAnalysis.feature_results.map(f => {
            const rowClass = f.status === 'PASS' ? 'pass-row' : (f.status === 'WARNING' ? 'warn-row' : 'fail-row');
            return `
                                                <tr class="${rowClass}">
                                                    <td>${f.feature}</td>
                                                    <td>${f.actual || 'N/A'}</td>
                                                    <td><span class="badge ${this.getBadgeClass(f.status)}">${f.status}</span></td>
                                                    <td>${f.warning || ''}</td>
                                                </tr>
                                                `;
        }).join('')}
                                        </tbody>
                                    </table>
                                ` : `
                                    <div style="margin-top:20px; color:#666; font-style:italic;">
                                        No visual analysis results available for this run (possibly due to API error).
                                    </div>
                                `}

                                <details>
                                    <summary>View Screenshot & Config</summary>
                                    <div style="margin-top: 15px;">
                                        <h4>Isolated Widget Screenshot</h4>
                                        <div style="max-height: 500px; overflow-y: auto; border: 1px solid #eee; border-radius: 4px; background: #f9f9f9; text-align: center;">
                                            <img src="${run.screenshotPath}" alt="Widget Screenshot" style="max-width: 100%; height: auto;">
                                        </div>
                                        
                                        <h4>Captured Configuration</h4>
                                        <pre>${JSON.stringify(run.capturedConfig, null, 2)}</pre>
                                    </div>
                                </details>
                            `}
                        </div>
                    </div>
                `).join('')}
            </div>
        </body>
        </html>
        `;
    }
}

module.exports = ReportHelper;
