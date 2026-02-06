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
                let distance = 200;
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
        await page.waitForTimeout(3000);

        // Context search logic
        const frames = page.frames();
        const detectedTypes = new Set(); // Use Set to avoid duplicates

        const detectors = {
            floatingcards: '.feedspace-floating-widget.show-left-bottom.close-active, .feedspace-floating-widget',
            carousel: '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget',
            stripslider: '.feedspace-marque-main-wrap, .feedspace-show-overlay',
            avatargroup: '.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center',
            avatarslider: '.feedspace-single-review-widget, .feedspace-show-left-right-shadow',
            verticalscroll: '.feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow',
            horizontalscroll: '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow',
            masonry: '.feedspace-element-container' // Base container often used for masonry
        };
        // Remove masonry from generic detectors to avoid partial matches with WOL
        delete detectors.masonry;

        for (const frame of frames) {
            try {
                const frameUrl = frame.url();

                // Specific check for Masonry via API Key
                if (frameUrl.includes('78ee3e50-eca8-468c-9c54-dd91a7e7cd09')) {
                    if (await frame.locator('.feedspace-element-container').first().isVisible({ timeout: 500 })) {
                        console.log('Detected masonry via API Key in iframe.');
                        detectedTypes.add('masonry');
                    }
                }

                for (const [type, selector] of Object.entries(detectors)) {
                    if (await frame.locator(selector).first().isVisible({ timeout: 500 })) { // Short timeout for check
                        console.log(`Detected ${type} in iframe.`);
                        detectedTypes.add(type);
                    }
                }
            } catch (e) { }
        }

        // Add hint fallback if nothing detected
        if (detectedTypes.size === 0 && widgetTypeHint && widgetTypeHint !== 'Auto') {
            console.warn(`Dynamic detection failed. Falling back to type hint: ${widgetTypeHint}`);
            detectedTypes.add(widgetTypeHint.toLowerCase());
        }

        const instances = [];
        for (const type of detectedTypes) {
            const widgetConfig = config.widgets.find(w => w.type.toLowerCase() === type.toLowerCase()) || { type: type, uiRules: {} };
            instances.push(this.createInstance(type, page, widgetConfig));
        }

        return instances;
    }

    static createInstance(type, page, config) {
        switch (type.toLowerCase()) {
            case 'carousel': return new CarouselWidget(page, config);
            case 'masonry': return new MasonryWidget(page, config);
            case 'stripslider': return new StripSliderWidget(page, config);
            case 'avatargroup': return new AvatarGroupWidget(page, config);
            case 'avatarslider': return new AvatarSliderWidget(page, config);
            case 'verticalscroll': return new VerticalScrollWidget(page, config);
            case 'horizontalscroll': return new HorizontalScrollWidget(page, config);
            case 'floatingcards': return new FloatingCardsWidget(page, config);
            default: return new BaseWidget(page, config);
        }
    }
}

module.exports = { WidgetFactory };
