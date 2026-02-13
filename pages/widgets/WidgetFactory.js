const { CarouselWidget } = require('./CarouselWidget');
const { MasonryWidget } = require('./MasonryWidget');
const { StripSliderWidget } = require('./StripSliderWidget');
const { AvatarGroupWidget } = require('./AvatarGroupWidget');
const { AvatarSliderWidget } = require('./AvatarSliderWidget');
const { VerticalScrollWidget } = require('./VerticalScrollWidget');
const { HorizontalScrollWidget } = require('./HorizontalScrollWidget');
const { FloatingCardsWidget } = require('./FloatingCardsWidget');
const { BaseWidget } = require('./BaseWidget');

class WidgetFactory {
    static async detectAndCreate(page, widgetTypeHint, config) {
        console.log(`Dynamic Detection: Searching for widget type: ${widgetTypeHint}`);
        // Scroll top to bottom to trigger lazy loading
        await page.evaluate(async () => {
            await new Promise((resolve) => {
                let totalHeight = 0;
                let distance = 300;
                let timer = setInterval(() => {
                    let scrollHeight = document.body.scrollHeight;
                    window.scrollBy(0, distance);
                    totalHeight += distance;
                    if (totalHeight >= scrollHeight) {
                        clearInterval(timer);
                        resolve();
                    }
                }, 100);
            });
        });

        // Wait for potential iframes and content to load
        await page.waitForTimeout(5000); // 5s wait for stability

        const frames = page.frames();
        const detectors = {
            floatingcards: '.feedspace-floating-widget.show-left-bottom.close-active, .feedspace-floating-widget',
            carousel: '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget',
            stripslider: '.feedspace-marque-main-wrap, .feedspace-show-overlay',
            avatargroup: '.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center',
            avatarslider: '.feedspace-single-review-widget',
            verticalscroll: '.feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow',
            horizontalscroll: '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow, .feedspace-element-d12-marquee-row, [class*="horizontal-scroll"]',
            masonry: '.feedspace-element-container:not(.feedspace-carousel-widget):not(.feedspace-element-horizontal-scroll-widget):not(.feedspace-element-feed-top-bottom-marquee)'
        };

        const detectedInfo = []; // Array of { type, frame }

        // 1. Check Main Frame FIRST (Priority)
        console.log('Scanning Main Frame for widgets...');
        const mainFrame = page.mainFrame();
        for (const [type, selector] of Object.entries(detectors)) {
            try {
                const locator = mainFrame.locator(selector).first();
                if (await locator.count() > 0 && await locator.isVisible().catch(() => false)) {
                    console.log(`[Main Frame] Widget detected: ${type}`);
                    detectedInfo.push({ type, frame: mainFrame });
                }
            } catch (e) { /* ignore */ }
        }

        // 2. Check Child Frames if nothing found or to find others
        const childFrames = page.frames().filter(f => f !== mainFrame);
        console.log(`Scanning ${childFrames.length} child frames for widgets...`);

        for (const frame of childFrames) {
            try {
                const frameUrl = frame.url();
                console.log(`Checking frame: ${frameUrl.substring(0, 100)}${frameUrl.length > 100 ? '...' : ''}`);

                // 1. Specific API Key Detection (High Priority)
                if (frameUrl.includes('78ee3e50-eca8-468c-9c54-dd91a7e7cd09')) {
                    if (await frame.locator('.feedspace-element-container').first().isVisible({ timeout: 1000 })) {
                        console.log('Widget detected: masonry via API Key in iframe.');
                        detectedInfo.push({ type: 'masonry', frame });
                    }
                }

                if (frameUrl.includes('ec0aaf26-8a39-4186-8caa-84ae5b77fcd9')) {
                    console.log('Widget detected: horizontalscroll via API Key in iframe.');
                    detectedInfo.push({ type: 'horizontalscroll', frame });
                }


                if (frameUrl.includes('b8e1c19e-2550-4a58-ae58-d7708c3e3405')) {
                    if (await frame.locator(detectors.avatarslider).first().isVisible({ timeout: 1000 }).catch(() => false)) {
                        console.log('Widget detected: avatarslider via API Key and class verification.');
                        detectedInfo.push({ type: 'avatarslider', frame });
                    }
                }

                // 2. Selector-based Detection
                for (const [type, selector] of Object.entries(detectors)) {
                    // Skip if already detected via API key in this frame
                    if (detectedInfo.some(d => d.frame === frame && d.type === type)) continue;

                    // Increase timeout and check for presence even if not immediately visible (some widgets lazy-load styles)
                    const locator = frame.locator(selector).first();
                    const isVisible = await locator.isVisible({ timeout: 3000 }).catch(() => false);
                    const exists = (await locator.count().catch(() => 0)) > 0;

                    if (isVisible || exists) {
                        console.log(`Widget detected: ${type} in frame via selector: ${selector} (Visible: ${isVisible}, Exists: ${exists})`);
                        detectedInfo.push({ type, frame });
                    }
                }
            } catch (e) {
                console.warn(`Error scanning frame: ${e.message}`);
            }
        }

        // Deduplicate detectedInfo (same type in same frame)
        const uniqueDetected = [];
        const seen = new Set();
        for (const info of detectedInfo) {
            const key = `${info.type}-${info.frame === page ? 'main' : info.frame.url()}`;
            if (!seen.has(key)) {
                uniqueDetected.push(info);
                seen.add(key);
            }
        }

        // Add hint fallback if nothing detected
        if (uniqueDetected.length === 0 && widgetTypeHint && widgetTypeHint !== 'Auto') {
            console.warn(`Dynamic detection failed. Falling back to type hint: ${widgetTypeHint}`);
            uniqueDetected.push({ type: widgetTypeHint.toLowerCase(), frame: page });
        }

        const instances = [];
        for (const info of uniqueDetected) {
            const widgetConfig = config.widgets.find(w => w.type.toLowerCase() === info.type.toLowerCase()) || { type: info.type, uiRules: {} };
            instances.push(this.createInstance(info.type, page, widgetConfig, info.frame));
        }

        return instances;
    }

    static createInstance(type, page, config, frame = null) {
        let instance;
        switch (type.toLowerCase()) {
            case 'carousel': instance = new CarouselWidget(page, config); break;
            case 'masonry': instance = new MasonryWidget(page, config); break;
            case 'stripslider': instance = new StripSliderWidget(page, config); break;
            case 'avatargroup': instance = new AvatarGroupWidget(page, config); break;
            case 'avatarslider': instance = new AvatarSliderWidget(page, config); break;
            case 'verticalscroll': instance = new VerticalScrollWidget(page, config); break;
            case 'horizontalscroll': instance = new HorizontalScrollWidget(page, config); break;
            case 'floatingcards': instance = new FloatingCardsWidget(page, config); break;
            default: instance = new BaseWidget(page, config);
        }

        if (frame) {
            instance.context = frame;
            instance.isContextFixed = true;
            instance.logAudit(`Widget detected via mapping in iframe: ${frame.url()}`);
        } else {
            // Main frame detected
            instance.context = page;
            instance.isContextFixed = true;
            // instance.logAudit(`Widget detected on main page.`);
        }

        return instance;
    }
}

module.exports = { WidgetFactory };
