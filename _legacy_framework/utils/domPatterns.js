/**
 * Robust DOM patterns for finding UI elements without relying on specific CSS classes.
 * Focuses on Accessibility roles, Tag names, and Text content.
 */
module.exports = {
    // Carousel Specific
    carousel: {
        // Container: Look for a generic region or typical carousel container roles
        container: { role: 'region', labelPatterns: ['carousel', 'slider', 'testimonials', 'reviews'] },

        // Navigation
        prevButton: {
            role: 'button',
            names: ['Previous', 'Prev', 'Left', 'Previous slide', 'Scroll left']
        },
        nextButton: {
            role: 'button',
            names: ['Next', 'Right', 'Next slide', 'Scroll right']
        },

        // Indicators
        indicators: {
            role: 'list', // or 'tablist'
            namePatterns: ['slides', 'pagination', 'indicators']
        }
    },

    // Branding & Social
    branding: {
        // Branding is usually a link or text at the bottom
        textPatterns: ['Powered by Feedspace', 'Feedspace'],
        linkHref: 'feedspace.io'
    },

    socialIcon: {
        // Generic social links often have specific accessible names or hrefs
        role: 'link',
        names: ['Facebook', 'Twitter', 'LinkedIn', 'Instagram', 'YouTube', 'TikTok', 'Google', 'G2', 'Capterra', 'Trustpilot']
    },

    // Platform Icons (Source of review)
    platformIcon: {
        role: 'img',
        names: ['Google Logo', 'Twitter Logo', 'LinkedIn Logo', 'Facebook Logo', 'Source: Google', 'Source: Twitter']
    },

    // Content
    rating: {
        // Stars are often images or SVGs with 'star' in name
        role: 'img',
        names: ['star', 'rating', 'out of 5', 'stars']
    },

    date: {
        // Date is hard to detect by role alone, usually just text.
        // We rely on regex matching in the validator.
        formatRegex: /\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}|[A-Za-z]{3}\s\d{1,2},?\s\d{4}|\d{1,2}\s[A-Za-z]{3}\s\d{4}/
    },

    readMore: {
        role: 'button',
        // 'text' property isn't a role attribute, but a text content helper
        texts: ['Read More', 'Show more', 'Expand']
    },

    cta: {
        // CTA is usually a prominent link or button with specific text
        role: 'link',
        // In a real generic validator, we might check for "Sign up", "Get Started", etc.
        // For this specific widget, the user knows the CTA text or structure.
        // But to be "pure", we might look for a button/link that *isn't* navigation or social.
        potentialRoles: ['link', 'button']
    }
};
