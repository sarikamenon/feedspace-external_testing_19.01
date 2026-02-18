const fs = require('fs');
const path = require('path');
const ReportHelper = require('./helpers/reportHelper');

const reportHelper = new ReportHelper();

const demoData = {
    "summary": {
        "total": 1,
        "passed": 1,
        "failed": 0,
        "errors": 0
    },
    "runs": [
        {
            "url": "https://www.mat-academy.com/",
            "widgetType": "Carousel",
            "capturedConfig": {
                "ratings": "5",
                "is_autoplay": "1",
                "shadow_size": "4",
                "border_color": "#000000",
                "shadow_color": "#000000",
                "shadow_style": "blurred",
                "border_radius": "6",
                "marquee_speed": "3",
                "autoplay_speed": "3",
                "hide_on_mobile": "0",
                "is_show_border": "0",
                "is_show_shadow": "1",
                "allow_dark_mode": "0",
                "is_show_ratings": "1",
                "widget_position": "left",
                "allow_custom_css": 0,
                "border_thickness": "1",
                "card_hover_color": "#000000",
                "show_full_review": "0",
                "marquee_direction": "alter",
                "show_star_ratings": "0",
                "star_rating_color": "#facc15",
                "is_limited_reviews": "0",
                "is_show_indicators": "1",
                "primary_text_color": "#ffffff",
                "show_avatar_border": "1",
                "show_platform_icon": "1",
                "avatar_border_color": "#ffffff",
                "card_backgound_color": "#000000",
                "secondary_text_color": "#ffffff",
                "is_show_arrows_buttons": "1",
                "allow_social_redirection": "1",
                "allow_to_remove_branding": "1",
                "star_rating_border_color": "#eab308",
                "is_show_full_review_popup": "1",
                "allow_to_display_feed_date": "0",
                "horizontal_marquee_direction": "alter",
                "allow_cross_scrolling_animation": "1",
                "allow_left_right_scrolling_animation": "1"
            },
            "aiAnalysis": {
                "overall_status": "FAIL",
                "message": "AI analysis complete. Several features are not visually present in the carousel. Note: Indicators are black on a black background.",
                "feature_results": [
                    { "feature": "Left & Right Buttons", "actual": "VISIBLE", "status": "PASS" },
                    { "feature": "Slider Indicators", "actual": "HIDDEN", "status": "WARNING", "warning": "Low contrast: Dark indicators on dark background." },
                    { "feature": "Show Review Date", "actual": "HIDDEN", "status": "FAIL" },
                    { "feature": "Show Review Ratings", "actual": "VISIBLE", "status": "PASS" },
                    { "feature": "Shorten Long Reviews / Read More", "actual": "HIDDEN", "status": "FAIL" },
                    { "feature": "Show Social Platform Icon", "actual": "HIDDEN", "status": "FAIL" },
                    { "feature": "Inline CTA", "actual": "VISIBLE", "status": "PASS" },
                    { "feature": "Feedspace Branding", "actual": "HIDDEN", "status": "FAIL" },
                    { "feature": "Review Card Border & Shadow", "actual": "VISIBLE", "status": "PASS" }
                ]
            },
            "screenshotPath": path.join(process.cwd(), "screenshots", "Carousel_1771400625253.png"),
            "status": "FAIL",
            "timestamp": new Date().toISOString()
        }
    ]
};

reportHelper.saveReport(demoData).then(path => {
    console.log(`Demo report generated at: ${path}`);
});
