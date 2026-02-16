const { MasonryWidget } = require('../pages/widgets/MasonryWidget');

class MasonryValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new MasonryWidget(page, config);

        // Consolidated report
        this.reportData = {
            widget: 'Masonry',
            url: page.url(),
            auditLog: [],
            featureResults: [],
            reviewStats: {},
            summary: { total: 0, pass: 0, fail: 0 }
        };
    }

    logAudit(message, status = 'info') {
        this.reportData.auditLog.push({ message, status });
        console.log(`[MasonryValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Masonry audit...');

            await this.widget.initContext();

            // 0️⃣ Validate Visibility (Counts reviews & populates stats)
            await this.widget.validateVisibility();

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI();

            // 2️⃣ Unique behaviors & interactions
            await this.widget.validateUniqueBehaviors();

            // 3️⃣ Media integrity checks
            await this.widget.validateMediaIntegrity();

            // 4️⃣ Layout checks
            await this.widget.validateLayoutIntegrity();

            // 5️⃣ Date Consistency Audit
            await this.widget.validateDateConsistency();

            // 6️⃣ Accessibility
            await this.widget.runAccessibilityAudit();

            // Include review stats from widget
            this.reportData.reviewStats = this.widget.reviewStats || {};

            // Merge widget's internal audit logs into the main report
            if (this.widget.auditLog && this.widget.auditLog.length > 0) {
                const mappedLogs = this.widget.auditLog.map(log => ({
                    message: log.message,
                    status: log.type || (log.status ? log.status : 'info'),
                    isLimitation: log.isLimitation || false
                }));
                this.reportData.auditLog.push(...mappedLogs);
            }

            // Include detailed failures (e.g. broken media, date inconsistencies)
            this.reportData.detailedFailures = this.widget.detailedFailures || [];

            // Include accessibility violations
            this.reportData.accessibilityResults = this.widget.accessibilityResults || [];

            this.logAudit('Masonry audit complete.');
        } catch (e) {
            this.logAudit(`Audit failed due to exception: ${e.message}`, 'fail');
        }
    }

    async validateConfigAgainstUI() {
        const configKeys = [
            'is_show_ratings', 'show_full_review', 'allow_to_display_feed_date',
            'allow_social_redirection', 'cta_enabled', 'hideBranding',
            'allow_to_remove_branding', 'show_platform_icon',
            'is_show_arrows_buttons', 'is_show_indicators', 'enable_load_more'
        ];

        for (const key of configKeys) {
            // Default to "0" if API value is missing/null
            const rawApi = this.config[key];
            const apiValue = (rawApi === undefined || rawApi === null || rawApi === '') ? '0' : rawApi.toString();
            let uiValue = 'N/A';

            try {
                let locator;
                switch (key) {
                    case 'is_show_ratings':
                        locator = this.widget.context.locator('.feedspace-video-review-header-star, .feedspace-stars, .star-rating, .feedspace-element-review-box .feedspace-icon, .feedspace-star-fill-color');
                        break;
                    case 'show_full_review':
                        locator = this.widget.context.locator('.feedspace-element-read-more, .read-more, button:has-text("Read more")');
                        break;
                    case 'allow_to_display_feed_date':
                        locator = this.widget.context.locator('.feedspace-element-date, .feedspace-wol-date');
                        break;
                    case 'allow_social_redirection':
                        locator = this.widget.context.locator('div.flex > div.flex > a.feedspace-d6-header-icon, .social-redirection-button, .feedspace-element-header-icon > a > img');
                        break;
                    case 'cta_enabled':
                        locator = this.widget.context.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content');
                        break;
                    case 'hideBranding':
                    case 'allow_to_remove_branding':
                        locator = this.widget.context.locator('a[href*="utm_source=powered-by-feedspace"]');
                        break;
                    case 'show_platform_icon':
                        locator = this.widget.context.locator('div.feedspace-element-header-icon > a > img');
                        break;
                    case 'is_show_arrows_buttons':
                        locator = this.widget.context.locator('.feedspace-element-carousel-arrow.left, .feedspace-element-carousel-arrow.right');
                        break;
                    case 'is_show_indicators':
                        locator = this.widget.context.locator('.feedspace-element-carousel-indicators, .slick-dots');
                        break;
                    case 'enable_load_more':
                        locator = this.widget.context.locator('.load-more-btn, button:has-text("Load More"), span:has-text("Load More")');
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

module.exports = { MasonryValidator };
