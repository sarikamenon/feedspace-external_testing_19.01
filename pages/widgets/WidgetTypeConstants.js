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

module.exports = { WidgetTypeConstants, WidgetTypeNames };
