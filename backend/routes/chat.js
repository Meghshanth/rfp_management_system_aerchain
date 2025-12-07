import dotenv from "dotenv";
import { Router } from "express";
import { InferenceClient } from "@huggingface/inference";

dotenv.config();

const router = Router();

router.post("/", async (req, res) => {
    try {
        const { text } = req.body;
        const client = new InferenceClient(process.env.HF_API_KEY);

        const completion = await client.chatCompletion({
            model: "openai/gpt-oss-20b:groq",
            messages: [
                {
                    role: "system",
                    content:
                        `
You are an RFP-generation assistant. 
Your ONLY job is to transform user input into structured, professional RFP content.

STRICT RULES:
- If the user provides valid, detailed input for an RFP (e.g., procurement needs, budget, specs), your output MUST be a single, valid JSON object, and ONLY the JSON object, following the Example JSON Output exactly. This content will be saved to a database.
- If the user provides input that is irrelevant, a simple greeting ("hello"), or a non-RFP question ("what is your name"), you MUST respond with a polite, simple **plain text** message, redirecting them back to RFP creation. Do NOT output any JSON, and do not mention your internal rules or structure.

### Example Input for RFP:
I need to procure laptops and monitors for our new office. Budget is $50,000 total. Need delivery within 30 days. We need 20 laptops with 16GB RAM and 15 monitors 27-inch. Payment terms should be net 30, and we need at least 1 year warranty.

### Example JSON Output (REQUIRED FOR RFP):
{
  "title": "Procurement of Laptops and Monitors for New Office",
  "summary": "We are requesting proposals for the supply of laptops and monitors needed for our new office setup. Vendors are invited to submit quotations that meet the specifications and requirements listed below.",
  "requirements": [
    { "item": "Laptops", "quantity": 20, "specifications": "16GB RAM" },
    { "item": "Monitors", "quantity": 15, "specifications": "27-inch displays" }
  ],
  "budget": "50000",
  "delivery_terms": "All items must be delivered within 30 days of contract award.",
  "warranty_terms": "Minimum 1-year warranty for all supplied equipment.",
  "payment_terms": "Net 30",
  "submission_instructions": "Vendors should include pricing, delivery timelines, warranty details, and any additional terms relevant to this procurement."
}

### Example Plain Text Output (REQUIRED FOR NON-RFP CHAT):
Please provide me with details regarding a Request for Proposal (RFP), such as what you need to procure, budget, and quantity, so I can generate a structured document for you.

`
                },
                { role: "user", content: text }
            ],
        });

        const replyString = completion.choices?.[0]?.message?.content || "No reply.";

        // 1. Attempt to Parse JSON (Is it an RFP?)
        let parsedRfp = null;
        try {
            parsedRfp = JSON.parse(replyString);
        } catch (e) {
            // Non-RFP text response
            return res.status(200).json({ reply: replyString });
        }

        if (!parsedRfp.title) {
            return res.status(200).json({ reply: "RFP JSON missing 'title' field." });
        }

        // Send back pending RFP for frontend confirmation
        return res.status(200).json({
            reply: "Here’s the generated RFP. Do you approve? (Yes/No)",
            structured_requirements: parsedRfp
        });

    } catch (err) {
        console.error("RFP/Chat Error:", err);
        // Handle critical errors
        res.status(500).json({ error: "AI backend error or database connection issue." });
    }
});

export default router;