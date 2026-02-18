const WidgetTypeConstants = {
    4: 'Carousel',        // CAROUSEL_SLIDER
    5: 'Masonry',         // MASONRY
    6: 'StripSlider',     // MARQUEE_STRIPE
    7: 'AvatarGroup',     // AVATAR_GROUP
    8: 'AvatarSlider',    // SINGLE_SLIDER
    9: 'VerticalScroll',  // MARQUEE_UPDOWN
    10: 'HorizontalScroll', // MARQUEE_LEFTRIGHT
    11: 'FloatingCards'   // FLOATING_TOAST
};

const WidgetTypeNames = {
    CAROUSEL_SLIDER: 4,
    MASONRY: 5,
    MARQUEE_STRIPE: 6,
    AVATAR_GROUP: 7,
    SINGLE_SLIDER: 8,
    MARQUEE_UPDOWN: 9,
    MARQUEE_LEFTRIGHT: 10,
    FLOATING_TOAST: 11
};

class WidgetDetector {
    static identify(config) {
        if (!config) return 'Unknown';

        // Support: widget_type_id (int), type (int), or type (string)
        const raw = config.widget_type_id || config.type;

        // If it's already a recognized name string, return it
        if (typeof raw === 'string') {
            const normalized = raw.toLowerCase().replace(/_/g, '');
            for (const key in WidgetTypeConstants) {
                if (WidgetTypeConstants[key].toLowerCase() === normalized) {
                    return WidgetTypeConstants[key];
                }
            }
            // Fallback for names like 'carouselslider' 
            if (normalized === 'carouselslider') return 'Carousel';
            return raw;
        }

        if (WidgetTypeConstants[raw]) {
            return WidgetTypeConstants[raw];
        }

        return 'Unknown';
    }
}

module.exports = { WidgetDetector, WidgetTypeConstants, WidgetTypeNames };
