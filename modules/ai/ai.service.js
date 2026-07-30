import { GoogleGenAI } from "@google/genai";

export async function generateSummary(prompt) {

    const AI_KEY = process.env.AI_KEY;
    const AI_PROVIDER = process.env.AI_PROVIDER;
    
    const ai = new GoogleGenAI({
        apiKey: AI_KEY
    });

    if (!AI_PROVIDER || !AI_KEY) {
        throw new Error("AI provider or API key is not configured.");
    }

    try {
        const response = await ai.models.generateContent({
            model: AI_PROVIDER,
            contents: prompt,
            config: {
                systemInstruction: "Summarize the user's input in simple, easy-to-understand terms. Do not include introductory text, conversational pleasantries, explanations, or concluding remarks. Return ONLY the final summarized text.",
                responseMimeType: "application/json",
                responseSchema: {
                    type: "OBJECT",
                    properties: {
                        summary: {
                            type: "STRING",
                            description: "The plain-text simple summary only. Absolutely no markdown headers, rules, or questions."
                        }
                    },
                    required: ["summary"]
                },
                temperature: 0.1
            }
        });

        return JSON.parse(response.text).summary;

    } catch (error) {
        console.error("AI Service Error:", error.message);
        throw new Error("Unable to generate summary at this time.");
    }
}