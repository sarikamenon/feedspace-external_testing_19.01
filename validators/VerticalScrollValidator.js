const { VerticalScrollWidget } = require('../pages/widgets/VerticalScrollWidget');

class VerticalScrollValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new VerticalScrollWidget(page, config);

        // Consolidated report
        this.reportData = {
            widget: 'VerticalScroll',
            url: page.url(),
            auditLog: [],
            featureResults: [],
            reviewStats: {},
            summary: { total: 0, pass: 0, fail: 0 }
        };
    }

    logAudit(message, status = 'info') {
        this.reportData.auditLog.push({ message, status });
        console.log(`[VerticalScrollValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Vertical Scroll audit...');

            await this.widget.initContext();

            // 0️⃣ Validate Visibility (Counts reviews & populates stats)
            await this.widget.validateVisibility();

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI();

            // 2️⃣ Unique behaviors & interactions
            await this.widget.validateUniqueBehaviors();

            this.logAudit('Vertical Scroll audit complete.');
        } catch (e) {
            this.logAudit(`Audit failed due to exception: ${e.message}`, 'fail');
        }
    }

    async validateConfigAgainstUI() {
        const configKeys = [
            'is_show_ratings', 'show_full_review', 'allow_to_display_feed_date',
            'allow_social_redirection', 'cta_enabled', 'allow_to_remove_branding', 'show_platform_icon',
            'audio_play_button', 'video_play_button'
        ];

        for (const key of configKeys) {
            const apiValue = this.config[key] ?? 'N/A';
            let uiValue = 'N/A';

            try {
                let locator;
                switch (key) {
                    case 'is_show_ratings':
                        locator = this.widget.context.locator('.feedspace-stars, .star-rating');
                        break;
                    case 'show_full_review':
                        locator = this.widget.context.locator('.feedspace-element-read-more, .read-more');
                        break;
                    case 'allow_to_display_feed_date':
                        locator = this.widget.context.locator('.feedspace-element-date');
                        break;
                    case 'allow_social_redirection':
                        locator = this.widget.context.locator('.social-redirection-button');
                        break;
                    case 'cta_enabled':
                        locator = this.widget.context.locator('.feedspace-cta-content');
                        break;
                    case 'allow_to_remove_branding':
                        locator = this.widget.context.locator('a[href*="utm_source=powered-by-feedspace"]');
                        break;
                    case 'show_platform_icon':
                        locator = this.widget.context.locator('div.feedspace-element-header-icon > a > img');
                        break;
                    case 'audio_play_button':
                        locator = this.widget.context.locator('.feedspace-media-play-icon');
                        break;
                    case 'video_play_button':
                        locator = this.widget.context.locator('.play-btn');
                        break;
                }

                if (locator) {
                    uiValue = await locator.first().isVisible().catch(() => false) ? "1" : "0";
                }
            } catch (e) {
                uiValue = 'error';
            }

            const status = apiValue.toString() === uiValue.toString() ? 'PASS' : 'FAIL';
            this.reportData.featureResults.push({
                feature: key,
                api_value: apiValue,
                ui_value: uiValue,
                status
            });

            if (status === 'FAIL') {
                this.logAudit(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: FAIL`, 'fail');
            } else {
                this.logAudit(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: PASS`, 'info');
            }
        }
    }

    getReportData() {
        return this.reportData;
    }
}

module.exports = { VerticalScrollValidator };
