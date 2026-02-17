class VerticalScrollConfig {
    constructor(page, configJson) {
        this.page = page;
        this.configJson = configJson || {}; // API JSON

        // Synchronized with VerticalScrollValidator
        this.locators = {
            is_show_ratings: page.locator('div.feedspace-element-feed-box-inner > div.feedspace-element-review-box > svg, .feedspace-stars, .star-rating, .feedspace-star-fill-color'),
            allow_to_display_feed_date: page.locator('.feedspace-element-date, .feedspace-element-feed-date, .feedspace-wol-date, .feedspace-element-bio-top span'),
            show_full_review: page.locator('.feedspace-element-read-more, .read-more, i:has-text("Read More"), i:has-text("Read more"), .feedspace-read-more-btn'),
            show_platform_icon: page.locator('div.feedspace-element-header-icon > a > img, div.feedspace-element-bio-info > div.feedspace-element-bio-top > div.feedspace-element-header-icon, .feedspace-element-header-icon'),
            allow_social_redirection: page.locator('.social-redirection-button, .fe-social-link, div.flex > div.flex > a.feedspace-d6-header-icon, .feedspace-google-icon, .feedspace-twitter-icon, .feedspace-facebook-icon, .feedspace-element-header-icon a'),
            cta_enabled: page.locator('.feedspace-cta-content, .feedspace-inline-cta-card, .fe-cta-container, .feedspace-element-feed-box-inner.feedspace-inline-cta-card, .feedspace-element-cta-card'),
            allow_to_remove_branding: page.locator('a[title="Capture reviews with Feedspace"]'),
            audio_play_button: page.locator('.feedspace-media-play-icon, .feedspace-element-audio-icon'),
            video_play_button: page.locator('.play-btn, .feedspace-video-review-header .play-btn')
        };

        this.auditLog = [];
    }

    isEnabled(key) {
        return this.configJson[key] === "1" || this.configJson[key] === 1 || this.configJson[key] === true;
    }

    log(message, status = 'info') {
        this.auditLog.push({ message, status });
        console.log(`[VerticalScrollConfig] ${status.toUpperCase()}: ${message}`);
    }

    async generateFeatureReport() {
        const report = [];

        for (const [key, locator] of Object.entries(this.locators)) {
            const apiValue = this.configJson[key] ?? 'absent';
            let uiValue = '0';
            let info = '';

            try {
                if (key === 'allow_to_remove_branding' || key === 'hideBranding') {
                    // Branding uses Inverse Logic
                    const branding = locator.first();
                    const isVisible = await branding.isVisible().catch(() => false);
                    uiValue = isVisible ? '0' : '1';
                } else if (locator) {
                    // Optimized check: count() is more resilient than filter({visible:true}) for marquees 
                    // where elements might be off-screen loop-duplicates.
                    const count = await locator.count().catch(() => 0);
                    let isVisible = count > 0;

                    // If count > 0 but isVisible is false, check if at least one is truly rendered
                    if (isVisible) {
                        const firstVisible = await locator.filter({ visible: true }).count().catch(() => 0);
                        // For marquees, we accept presence as enough if they aren't all display:none
                        if (firstVisible === 0) {
                            const isHidden = await locator.first().evaluate(el => window.getComputedStyle(el).display === 'none').catch(() => true);
                            if (isHidden) isVisible = false;
                        }
                    }

                    if (key === 'show_full_review') {
                        uiValue = isVisible ? "1" : "0";
                    } else if (isVisible) {
                        if (key === 'allow_to_display_feed_date') {
                            const text = await locator.first().innerText().catch(() => '');
                            uiValue = text.trim().length > 0 ? '1' : '0';
                        } else {
                            uiValue = "1";
                        }
                    } else {
                        uiValue = "0";
                    }
                }
            } catch (e) {
                uiValue = 'error';
            }

            let status = 'FAIL';
            if (apiValue === 'absent') {
                status = 'FAIL';
                info = 'API response not got';
            } else {
                const normApi = (apiValue === '1' || apiValue === 1 || apiValue === true) ? '1' : '0';
                status = (normApi === uiValue) ? 'PASS' : 'FAIL';
            }

            report.push({
                feature: key,
                api_value: apiValue,
                ui_value: uiValue,
                status,
                info
            });
            this.log(`Feature: ${key}, API: ${apiValue}, UI: ${uiValue}, Status: ${status}${info ? ` (${info})` : ''}`, status === 'FAIL' ? 'fail' : 'info');
        }
        return report;
    }
}

module.exports = { VerticalScrollConfig };
