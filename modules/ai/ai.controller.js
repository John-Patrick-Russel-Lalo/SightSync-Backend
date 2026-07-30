import { generateSummary } from "./ai.service.js";

export const aiController = async (req, res) => {
    try {
        const prompt = req.body.prompt;
        console.log(prompt)
        const ai_summary = await generateSummary(prompt);
        res.status(200).json({ ai_summary });
    } catch (error) {
        console.error("AI Error:", error);

        res.status(503).json({
            message: "AI service is temporarily unavailable."
        });
    }
};