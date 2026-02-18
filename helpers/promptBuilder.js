const fs = require('fs');
const path = require('path');

class PromptBuilder {
    static build(widgetType, config, staticFeatures) {
        const featureMap = {
            "Left & Right Buttons": "is_show_arrows_buttons",
            "Slider Indicators": "is_show_indicators",
            "Show Review Date": "allow_to_display_feed_date",
            "Show Review Ratings": "is_show_ratings",
            "Shorten Long Reviews / Read More": "show_full_review",
            "Show Social Platform Icon": "show_platform_icon",
            "Inline CTA": "cta_enabled",
            "Feedspace Branding": "allow_to_remove_branding",
            "Review Card Border & Shadow": ["is_show_border", "is_show_shadow"],
            "Show Star Ratings": "show_star_ratings",
            "Cross scrollanimation": "allow_cross_scrolling_animation",
            "Horizontal Scrolling animation": "allow_left_right_scrolling_animation",
            "Widget position": "widget_position",
            "Show Load More Button": "enable_load_more"
        };

        const featuresToTest = staticFeatures || config.features || Object.keys(featureMap);

        const instructions = featuresToTest.map(featureName => {
            return `- ${featureName}: (Identify if this is VISIBLE or HIDDEN in the screenshot)`;
        }).join('\n');

        return `
      You are a QA Automation AI. Analyze the provided UI Screenshot of a ${widgetType} widget.
      
      TARGET FEATURES TO IDENTIFY:
      ${instructions}
      
      ACCURACY RULES (CRITICAL):
      1. **STRICT VISUAL EVIDENCE ONLY**: Base your analysis strictly on what you see.
      2. **IGNORE EXTERNAL ELEMENTS**: Focus ONLY on the feedspace ${widgetType} cards. Ignore Trustpilot widgets, chat bubbles, or logos in the header.
      3. **Feedspace Branding**: Mark as VISIBLE only if you see "Capture Reviews with Feedspace" at the bottom of the widget area.
      4. **Review Date**: Mark as VISIBLE only if you see dates (for eg : 27 Jan 2026 or 27/01/2026 or 27-01-2026 or 27th Jan 2026) within the feedback cards.
      5. **Read More**: Mark as VISIBLE only if you see text truncation followed by "Read More" or "...".
      6. **Slider Indicators**: Look for small dots or lines at the bottom of the carousel.
      7. **Show Star Ratings**: Mark as VISIBLE only if you see star ratings (e.g., 5 stars) within the feedback cards.It can be *,circle,half stars,filled stars,empty stars.
      8. **Show Social Platform Icon**: Identify if the widget displays any social platform logos (for eg : Trustpilot, YouTube, Google, Twitter, appsumo or other recognized logos). 
      Mark as VISIBLE if any are present
      ⚠️ Include a warning if the icon is very faint, low contrast, or partially obscured.

      ⚠️ VISIBILITY WARNING: If a feature is hard to see due to color, contrast, overlap, or UI styling, 
mark it as HIDDEN/FAIL and include a short warning in the "warning" field.

      
      REPORTING LOGIC:
      - If the feature is present and VISIBLE -> status: "PASS"
      - If the feature is NOT visible or NOT found -> status: "FAIL"
      
      Return raw JSON only:
      {
        "feature_results": [
           { "feature": "Feature Name", "actual": "VISIBLE/HIDDEN", "status": "PASS/FAIL" }
        ],
        "overall_status": "PASS"
      }
      `;
    }
}

module.exports = PromptBuilder;
