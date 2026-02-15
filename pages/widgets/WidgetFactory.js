const { CarouselWidget } = require('./CarouselWidget');
const { MasonryWidget } = require('./MasonryWidget');
const { StripSliderWidget } = require('./StripSliderWidget');
const { AvatarGroupWidget } = require('./AvatarGroupWidget');
const { AvatarSliderWidget } = require('./AvatarSliderWidget');
const { VerticalScrollWidget } = require('./VerticalScrollWidget');
const { HorizontalScrollWidget } = require('./HorizontalScrollWidget');
const { FloatingCardsWidget } = require('./FloatingCardsWidget');
const { BaseWidget } = require('./BaseWidget');
const { WidgetTypeConstants } = require('./WidgetTypeConstants');

class WidgetFactory {
    static async detectAndCreate(page, widgetTypeHint, config) {
        console.log(`Dynamic Detection: Searching for widget type: ${widgetTypeHint}`);

        const frameTypeMap = new Map();

        // Listener for API response to identify widget type by ID
        const responseHandler = async (response) => {
            if (response.url().includes('api/v1/widget/getwidget') && response.status() === 200) {
                try {
                    const json = await response.json();
                    if (json && json.widget && json.widget.type) {
                        const typeId = json.widget.type;
                        const frame = response.frame();
                        if (WidgetTypeConstants[typeId] && frame) {
                            const detectedType = WidgetTypeConstants[typeId];
                            console.log(`[API Detection] Intercepted widget type ID: ${typeId} -> ${detectedType} for frame: ${frame.url()}`);

                            if (!frameTypeMap.has(frame)) {
                                frameTypeMap.set(frame, []);
                            }
                            const types = frameTypeMap.get(frame);
                            if (!types.includes(detectedType)) {
                                types.push(detectedType);
                            }
                        }
                    }
                } catch (e) {
                    console.warn(`[API Detection] Failed to parse widget response: ${e.message}`);
                }
            }
        };

        // Attach listener
        page.on('response', responseHandler);

        // Scroll top to bottom to trigger lazy loading and network requests
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
            avatargroup: '.fe-feedspace-avatar-group-widget-wrap.fe-widget-center',
            avatarslider: '.feedspace-single-review-widget',
            verticalscroll: '.feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow',
            horizontalscroll: '.feedspace-element-horizontal-scroll-widget',
            masonry: '.feedspace-element-container:not(.feedspace-carousel-widget):not(.feedspace-element-horizontal-scroll-widget):not(.feedspace-element-feed-top-bottom-marquee)'
        };

        const detectedInfo = []; // Array of { type, frame }


        const mainFrameFoundTypes = new Set();
        // 1. Check Main Frame FIRST (Priority)
        console.log('Scanning Main Frame for widgets...');
        const mainFrame = page.mainFrame();

        // Check API Detection for Main Frame
        if (frameTypeMap.has(mainFrame)) {
            const apiTypes = frameTypeMap.get(mainFrame);
            for (const apiType of apiTypes) {
                console.log(`[Main Frame] Widget detected via API: ${apiType}`);
                detectedInfo.push({ type: apiType.toLowerCase(), frame: mainFrame, method: 'api' });
                mainFrameFoundTypes.add(apiType.toLowerCase());
            }
        } else {
            for (const [type, selector] of Object.entries(detectors)) {
                try {
                    const locator = mainFrame.locator(selector).first();
                    if (await locator.count() > 0 && await locator.isVisible().catch(() => false)) {
                        console.log(`[Main Frame] Widget detected via selector: ${type}`);
                        detectedInfo.push({ type, frame: mainFrame, method: 'selector' });
                        mainFrameFoundTypes.add(type);
                    }
                } catch (e) { /* ignore */ }
            }
        }

        // 2. Check Child Frames if nothing found or to find others
        const childFrames = page.frames().filter(f => f !== mainFrame);
        console.log(`Scanning ${childFrames.length} child frames for widgets...`);

        for (const frame of childFrames) {
            try {
                const frameUrl = frame.url();

                // 1. API Detection (Highest Priority)
                if (frameTypeMap.has(frame)) {
                    const apiTypes = frameTypeMap.get(frame);
                    for (const apiType of apiTypes) {
                        if (mainFrameFoundTypes.has(apiType.toLowerCase())) continue; // Skip if already found in Main Frame
                        console.log(`[Child Frame] Widget detected via API: ${apiType} in ${frameUrl}`);
                        detectedInfo.push({ type: apiType.toLowerCase(), frame, method: 'api' });
                    }
                    continue; // Skip other checks if API confirmed
                }

                console.log(`Checking frame: ${frameUrl.substring(0, 100)}${frameUrl.length > 100 ? '...' : ''}`);

                // 2. Specific API Key Detection (Legacy)
                if (frameUrl.includes('78ee3e50-eca8-468c-9c54-dd91a7e7cd09')) {
                    if (await frame.locator('.feedspace-element-container').first().isVisible({ timeout: 1000 })) {
                        console.log('Widget detected: masonry via API Key in iframe.');
                        detectedInfo.push({ type: 'masonry', frame, method: 'api' });
                    }
                }

                if (frameUrl.includes('ec0aaf26-8a39-4186-8caa-84ae5b77fcd9')) {
                    console.log('Widget detected: horizontalscroll via API Key in iframe.');
                    detectedInfo.push({ type: 'horizontalscroll', frame, method: 'api' });
                }


                if (frameUrl.includes('b8e1c19e-2550-4a58-ae58-d7708c3e3405')) {
                    if (await frame.locator(detectors.avatarslider).first().isVisible({ timeout: 1000 }).catch(() => false)) {
                        console.log('Widget detected: avatarslider via API Key and class verification.');
                        detectedInfo.push({ type: 'avatarslider', frame, method: 'api' });
                    }
                }

                if (frameUrl.includes('550b3106-588f-4e0e-be8b-c81e456a06d3')) {
                    console.log('Widget detected: avatargroup via API Key in iframe.');
                    detectedInfo.push({ type: 'avatargroup', frame, method: 'api' });
                }

                // 3. Selector-based Detection
                for (const [type, selector] of Object.entries(detectors)) {
                    // Skip if already detected via API key in this frame OR in Main Frame
                    if (mainFrameFoundTypes.has(type)) continue;
                    if (detectedInfo.some(d => d.frame === frame && d.type === type)) continue;

                    // Increase timeout and check for presence even if not immediately visible (some widgets lazy-load styles)
                    const locator = frame.locator(selector).first();
                    const isVisible = await locator.isVisible({ timeout: 3000 }).catch(() => false);
                    const exists = (await locator.count().catch(() => 0)) > 0;

                    if (isVisible || exists) {
                        console.log(`Widget detected: ${type} in frame via selector: ${selector} (Visible: ${isVisible}, Exists: ${exists})`);
                        detectedInfo.push({ type, frame, method: 'selector' });
                    }
                }
            } catch (e) {
                console.warn(`Error scanning frame: ${e.message}`);
            }
        }

        // Deduplicate detectedInfo (same type in same frame, AND prioritize API/Child over Main/Selector)
        // Stratgy: If we have the same type in Main Frame (Selector) and Child Frame (API), assume Main is just a wrapper and drop it.
        const uniqueDetected = [];
        const seen = new Set();

        // Helper to check if we have a "better" version of this widget type already or coming up
        // Actually, easiest is to filter at the end.

        const typeGroups = {}; // type -> [infos]

        for (const info of detectedInfo) {
            const t = info.type.toLowerCase();
            if (!typeGroups[t]) typeGroups[t] = [];
            typeGroups[t].push(info);
        }

        console.log('[Factory Debug] Raw Detected Info:', JSON.stringify(detectedInfo.map(d => ({ type: d.type, frameUrl: d.frame === page ? 'main' : d.frame.url(), method: d.method })), null, 2));

        for (const type in typeGroups) {
            const infos = typeGroups[type];
            let kept = infos;

            // If we have mixed frames (Main vs Child) for the same type
            const hasChild = infos.some(i => i.frame !== page);
            const hasMain = infos.some(i => i.frame === page);

            if (hasChild && hasMain) {
                console.log(`[Factory] Deduplication: Removing Main Frame instance of '${type}' in favor of Child Frame instance(s).`);
                kept = infos.filter(i => i.frame !== page);
            }

            // Standard unique check
            for (const info of kept) {
                const key = `${info.type}-${info.frame === page ? 'main' : info.frame.url()}`;
                if (!seen.has(key)) {
                    uniqueDetected.push(info);
                    seen.add(key);
                }
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
            if (!widgetConfig.url && config.widgets.length > 0) {
                // If we didn't find a matching type, and there's only one widget in config, assume it's this one
                // This fixes cases where detection says 'avatargroup' but config said 'avatar_group' (un-normalized)
                console.log(`[Factory] No exact match for ${info.type}, fallback to first item in config.`);
                Object.assign(widgetConfig, config.widgets[0]);
            }
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
