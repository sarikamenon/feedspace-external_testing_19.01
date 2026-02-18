const { GoogleGenerativeAI } = require("@google/generative-ai");
const PromptBuilder = require('./promptBuilder');
require('dotenv').config();

class AIEngine {
    constructor() {
        this.apiKey = process.env.GEMINI_API_KEY;
        if (this.apiKey) {
            this.genAI = new GoogleGenerativeAI(this.apiKey);
            // Updated to use the available model version found via API
            this.model = this.genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
        } else {
            console.warn("[AIEngine] GEMINI_API_KEY is not set. AI validation will return mock data.");
        }
    }

    async analyzeScreenshot(imageBuffer, config, widgetType, staticFeatures) {
        if (!this.apiKey) {
            return this.getMockResult(widgetType);
        }

        try {
            const prompt = PromptBuilder.build(widgetType, config, staticFeatures);
            const imagePart = {
                inlineData: {
                    data: imageBuffer.toString("base64"),
                    mimeType: "image/png",
                },
            };

            console.log(`[AIEngine] Sending screenshot to Gemini for ${widgetType} validation...`);
            const result = await this.model.generateContent([prompt, imagePart]);
            const response = await result.response;
            const text = response.text();

            // Clean up markdown if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(cleanText);

        } catch (error) {
            console.error("[AIEngine] Error during analysis:", error);

            // If we have a list of features, at least report them as UNKNOWN
            const features = staticFeatures || (config && config.features) || [];
            const fallbackResults = (Array.isArray(features) ? features : []).map(f => ({
                feature: typeof f === 'string' ? f : (f.name || 'Unknown'),
                actual: 'N/A',
                status: 'UNKNOWN',
                warning: 'AI analysis failed'
            }));

            return {
                error: error.message,
                status: "ERROR",
                feature_results: fallbackResults
            };
        }
    }

    getMockResult(widgetType) {
        return {
            mock: true,
            overall_status: "FAIL",
            message: "Mock Mode: AI Validation Results (Simulated)",
            feature_results: [
                { feature: "Left & Right Buttons", actual: "VISIBLE", status: "PASS" },
                { feature: "Slider Indicators", actual: "HIDDEN", status: "FAIL" },
                { feature: "Show Review Date", actual: "HIDDEN", status: "FAIL" },
                { feature: "Show Review Ratings", actual: "VISIBLE", status: "PASS" },
                { feature: "Shorten Long Reviews / Read More", actual: "HIDDEN", status: "FAIL" },
                { feature: "Show Social Platform Icon", actual: "HIDDEN", status: "FAIL" },
                { feature: "Inline CTA", actual: "VISIBLE", status: "PASS" },
                { feature: "Feedspace Branding", actual: "HIDDEN", status: "FAIL" },
                { feature: "Review Card Border & Shadow", actual: "VISIBLE", status: "PASS" }
            ]
        };
    }
}

module.exports = AIEngine;
