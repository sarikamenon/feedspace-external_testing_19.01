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
        let detectedType = null;

        const detectors = {
            carousel: '.feedspace-carousel-widget, .feedspace-element-container.feedspace-carousel-widget',
            stripslider: '.feedspace-marque-main-wrap, .feedspace-show-overlay',
            avatargroup: '.fe-feedspace-avatar-group-widget-wrap, .fe-widget-center',
            avatarslider: '.feedspace-single-review-widget, .feedspace-show-left-right-shadow',
            verticalscroll: '.feedspace-element-feed-top-bottom-marquee, .feedspace-top-bottom-shadow',
            horizontalscroll: '.feedspace-element-horizontal-scroll-widget, .feedspace-left-right-shadow',
            floatingcards: '.feedspace-floating-widget.show-left-bottom',
            masonry: '.feedspace-element-container' // Base container often used for masonry
        };

        for (const frame of frames) {
            try {
                for (const [type, selector] of Object.entries(detectors)) {
                    if (await frame.locator(selector).first().isVisible({ timeout: 1000 })) {
                        console.log(`Detected ${type} in iframe.`);
                        detectedType = type;
                        break;
                    }
                }
            } catch (e) { }
            if (detectedType) break;
        }

        const finalType = detectedType || widgetTypeHint;
        if (!detectedType) {
            console.warn(`Dynamic detection failed for ${widgetTypeHint}. Falling back to type hint.`);
        }

        // Find the specific config for this type in the widgets array
        const widgetConfig = config.widgets.find(w => w.type.toLowerCase() === finalType.toLowerCase()) || { type: finalType, uiRules: {} };

        return this.createInstance(finalType, page, widgetConfig);
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
