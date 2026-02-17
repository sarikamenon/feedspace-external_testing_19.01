const { CarouselWidget } = require('../pages/widgets/CarouselWidget');

class CarouselValidator {
    constructor(page, config = {}) {
        this.page = page;
        this.config = config;
        this.widget = new CarouselWidget(page, config);

        // Consolidated report
        this.reportData = {
            widget: 'Carousel',
            url: page.url(),
            auditLog: [],
            featureResults: [],
            reviewStats: {},
            summary: { total: 0, pass: 0, fail: 0 }
        };
    }

    logAudit(message, status = 'info') {
        this.reportData.auditLog.push({ message, status });
        console.log(`[CarouselValidator] ${status.toUpperCase()}: ${message}`);
    }

    async runFullAudit() {
        try {
            this.logAudit('Starting full Carousel audit...');

            await this.widget.initContext();
            this.reportData.url = this.page.url(); // Update URL after navigation

            // 0️⃣ Validate Visibility (Counts reviews & populates stats)
            await this.widget.validateVisibility().catch(e => this.logAudit(`Visibility check failed: ${e.message}`, 'fail'));

            // 1️⃣ API JSON → UI mapping
            await this.validateConfigAgainstUI().catch(e => this.logAudit(`Config mapping failed: ${e.message}`, 'fail'));

            // 2️⃣ Unique behaviors & interactions
            await this.widget.validateUniqueBehaviors().catch(e => this.logAudit(`Unique behaviors failed: ${e.message}`, 'fail'));

            // 3️⃣ Media integrity checks
            await this.widget.validateMediaIntegrity().catch(e => this.logAudit(`Media integrity failed: ${e.message}`, 'fail'));

            // 4️⃣ Layout checks
            await this.widget.validateLayoutIntegrity().catch(e => this.logAudit(`Layout checks failed: ${e.message}`, 'fail'));

            // 5️⃣ Accessibility
            await this.widget.runAccessibilityAudit().catch(e => this.logAudit(`Accessibility audit failed: ${e.message}`, 'fail'));

            this.logAudit('Carousel audit complete.');
        } catch (e) {
            this.logAudit(`Critical audit exception: ${e.message}`, 'fail');
        } finally {
            // ALWAYS merge data, even on partial completion
            this.reportData.reviewStats = this.widget.reviewStats || {};
            this.reportData.detailedFailures = this.widget.detailedFailures || [];
            this.reportData.accessibilityResults = this.widget.accessibilityResults || [];

            if (this.widget.auditLog && this.widget.auditLog.length > 0) {
                const mappedLogs = this.widget.auditLog.map(log => ({
                    message: log.message,
                    status: log.type || (log.status ? log.status : 'info'),
                    isLimitation: log.isLimitation || false
                }));
                this.reportData.auditLog.push(...mappedLogs);
            }
        }
    }

    async validateConfigAgainstUI() {
        const configKeys = [
            'is_show_ratings', 'show_full_review', 'allow_to_display_feed_date',
            'allow_social_redirection', 'cta_enabled', 'hideBranding',
            'allow_to_remove_branding', 'show_platform_icon',
            'is_show_arrows_buttons', 'is_show_indicators'
        ];

        for (const key of configKeys) {
            let apiValue = 'undefined';
            let uiValue = 'undefined';
            let status = 'undefined';
            let locator;

            // 1. Handle Missing Keys (undefined)
            if (this.config[key] === undefined || this.config[key] === null) {
                this.reportData.featureResults.push({
                    feature: key,
                    api_value: 'absent',
                    ui_value: 'absent',
                    status: 'absent'
                });
                this.logAudit(`Feature: ${key}, API: absent, UI: absent, Status: absent`, 'info');
                continue;
            }

            apiValue = (this.config[key] === true || this.config[key] === 1 || this.config[key] === "1") ? "1" : "0";

            try {
                switch (key) {
                    case 'is_show_ratings':
                        locator = this.widget.context.locator('.feedspace-video-review-header-star, .feedspace-stars, .star-rating, div.feedspace-element-review-box > svg, .feedspace-star-fill-color');
                        break;
                    case 'show_full_review':
                        locator = this.widget.context.locator('.feedspace-element-read-more, .read-more, i:has-text("Read More")');
                        break;
                    case 'allow_to_display_feed_date':
                        locator = this.widget.context.locator('.feedspace-element-date, .feedspace-wol-date, .feedspace-element-bio-top span');
                        break;
                    case 'allow_social_redirection':
                        locator = this.widget.context.locator('.social-redirection-button, .feedspace-element-header-icon img, .fe-social-icon');
                        break;
                    case 'cta_enabled':
                        locator = this.widget.context.locator('.feedspace-cta-button-container-d9, .feedspace-cta-content, .fe-cta-container');
                        break;
                    case 'hideBranding':
                    case 'allow_to_remove_branding':
                        locator = this.widget.context.locator('a[href*="utm_source=powered-by-feedspace"][title="Capture reviews with Feedspace"]');
                        break;
                    case 'show_platform_icon':
                        locator = this.widget.context.locator('img[alt$="logo"], .feedspace-element-header-icon img, .feedspace-element-header-icon, i.social-redirection-button, .fe-social-icon, .fe-social-link img, img[src*="social-icons"], img[src*="logo"], div[class*="social-icon"]');
                        break;
                    case 'is_show_arrows_buttons':
                        locator = this.widget.context.locator('.slick-prev, .carousel-control-prev, .prev-btn, .feedspace-element-carousel-arrow.left, button[aria-label="Previous item"], .slick-next, .carousel-control-next, .next-btn, .feedspace-element-carousel-arrow.right, button[aria-label="Next item"]');
                        break;
                    case 'is_show_indicators':
                        locator = this.widget.context.locator('.feedspace-element-carousel-indicators, .slick-dots');
                        break;
                }

                if (locator) {
                    const visibleCount = await locator.first().isVisible().catch(() => false);
                    const isVisible = visibleCount;

                    if (key === 'hideBranding' || key === 'allow_to_remove_branding') {
                        // Branding: 0 = Visible, 1 = Hidden (Inverted)
                        uiValue = isVisible ? "0" : "1";
                    } else if (key === 'allow_to_display_feed_date' && isVisible) {
                        const text = await locator.first().innerText();
                        uiValue = text.trim().length > 0 ? '1' : '0';
                    } else {
                        uiValue = isVisible ? "1" : "0";
                    }
                }
            } catch (e) {
                uiValue = 'error';
            }

            status = apiValue.toString() === uiValue.toString() ? 'PASS' : 'FAIL';

            this.reportData.featureResults.push({
                feature: key,
                api_value: apiValue,
                ui_value: uiValue,
                status
            });

            this.logAudit(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: ${status}`, status === 'FAIL' ? 'fail' : 'info');
        }
    }

    getReportData() {
        return this.reportData;
    }
}

module.exports = { CarouselValidator };
