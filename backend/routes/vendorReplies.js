// /backend/src/routes/vendorReplies.js
import express from "express";
import fetch from "node-fetch";
import db from "../db/config.js";
import { InferenceClient } from "@huggingface/inference";

const router = express.Router();
const PROCUREMENT_EMAIL = process.env.PROCUREMENT_EMAIL || "procurement-system@test.com";
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL) || 15000; // 15 seconds polling

const hfClient = new InferenceClient(process.env.HF_API_KEY);

// ---------------------------
// Mailpit helpers
// ---------------------------
async function getMailpitMessages() {
    try {
        const res = await fetch("http://localhost:8025/api/v1/messages?expand=1");
        const json = await res.json();
        return Array.isArray(json.messages) ? json.messages : [];
    } catch (err) {
        console.error("❌ Failed to fetch Mailpit:", err.message);
        return [];
    }
}

function extractSender(msg) {
    // Try multiple ways to extract sender email
    if (msg?.From?.Address) {
        return msg.From.Address.toLowerCase().trim();
    }
    if (msg?.addresses?.from?.[0]?.address) {
        return msg.addresses.from[0].address.toLowerCase().trim();
    }
    if (msg?.Headers?.From?.[0]) {
        const raw = String(msg.Headers.From[0]);
        const match = raw.match(/<([^>]+)>/);
        return (match ? match[1] : raw).toLowerCase().trim();
    }
    return "unknown";
}

function extractSubject(msg) {
    return (msg?.Subject || msg?.subject || msg?.Headers?.Subject?.[0] || "(no subject)").trim();
}

function extractBody(msg) {
    // 1. Direct properties
    if (typeof msg.Text === "string" && msg.Text.length > 0) return msg.Text;
    if (typeof msg.Body === "string" && msg.Body.length > 0) return msg.Body;

    // 2. Recursive search for text/plain in Mime parts
    function findTextInParts(parts) {
        if (!parts || !Array.isArray(parts)) return null;

        for (const part of parts) {
            // Check if this part is text/plain
            if (part.ContentType?.includes("text/plain") && part.Body) {
                return part.Body;
            }
            // Check if this part is text/html as fallback
            if (part.ContentType?.includes("text/html") && part.Body) {
                // Simple tag strip for HTML
                return part.Body.replace(/<[^>]*>?/gm, '');
            }

            // Recurse into sub-parts
            if (part.Mime?.Parts) {
                const found = findTextInParts(part.Mime.Parts);
                if (found) return found;
            }
            // Sometimes parts are direct children
            if (part.Parts) {
                const found = findTextInParts(part.Parts);
                if (found) return found;
            }
        }
        return null;
    }

    if (msg.Mime?.Parts) {
        const found = findTextInParts(msg.Mime.Parts);
        if (found) return found;
    }

    // 3. Last resort: Snippet (often present in Mailpit summaries)
    if (msg.Snippet) return msg.Snippet;

    return "";
}

// ---------------------------
// DB helpers
// ---------------------------
async function alreadyProcessed(msgId) {
    const res = await db.query(
        "SELECT 1 FROM processed_mailpit WHERE message_id=$1",
        [msgId]
    );
    return res.rowCount > 0;
}

async function markProcessed(msgId) {
    await db.query(
        "INSERT INTO processed_mailpit (message_id) VALUES ($1) ON CONFLICT DO NOTHING",
        [msgId]
    );
}

async function getRfpIdFromTitle(title) {
    // Try exact match first
    let res = await db.query("SELECT id FROM rfps WHERE title=$1", [title]);
    if (res.rows[0]) return res.rows[0].id;

    // Try case-insensitive match
    res = await db.query("SELECT id FROM rfps WHERE LOWER(title)=LOWER($1)", [title]);
    if (res.rows[0]) return res.rows[0].id;

    // Try partial match (contains)
    res = await db.query("SELECT id FROM rfps WHERE LOWER(title) LIKE LOWER($1)", [`%${title}%`]);
    return res.rows[0]?.id;
}

async function getVendorsForRfp(rfpId) {
    const res = await db.query(
        `SELECT v.id, v.vendor_name, v.contact_email
         FROM vendors v
         JOIN rfp_vendors rv ON rv.vendor_id = v.id
         WHERE rv.rfp_id = $1`,
        [rfpId]
    );
    return res.rows;
}

function findVendorByEmail(vendors, email) {
    return vendors.find((v) => v.contact_email.toLowerCase() === email);
}

// ---------------------------
// HF helpers with better error handling
// ---------------------------
async function extractProposalData(rfpTitle, vendorName, proposalText) {
    const systemPrompt = `
You are a procurement assistant AI.
Your ONLY job is to extract structured data from a vendor's proposal in response to an RFP.

RFP Context: "${rfpTitle}"
Vendor Name: "${vendorName}"

Input Proposal Text:
"""
${proposalText}
"""

STRICT INSTRUCTIONS:
1. Analyze the proposal text carefully.
2. Extract the following fields:
   - "price": Total cost or itemized prices found.
   - "delivery": Delivery timeline.
   - "warranty": Warranty terms.
   - "other_details": Payment terms, validity, extras.
3. The format might be bulleted or just "Key: Value" lines. Look for lines starting with "Price:", "Cost:", "Delivery:", etc.
4. If a field is missing, use "N/A".
5. OUTPUT ONLY A VALID JSON OBJECT. Do not output markdown, code blocks, or any conversation.

Example JSON:
{
  "price": "$2,450 per month",
  "delivery": "Starts Jan 10",
  "warranty": "2 years",
  "other_details": "Net 30 payment"
}
`;

    try {
        const completion = await hfClient.chatCompletion({
            model: "openai/gpt-oss-20b:groq",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Extract data from the proposal above." }
            ],
            max_tokens: 500
        });

        let content = completion.choices?.[0]?.message?.content || "{}";

        // Clean up response - remove markdown code blocks if present
        content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        const parsed = JSON.parse(content);
        console.log("✅ Successfully parsed AI response:", parsed);
        return parsed;
    } catch (err) {
        console.warn("⚠️ HF AI returned invalid JSON, storing raw text. Error:", err.message);
        return {
            raw_text: proposalText,
            price: "N/A",
            delivery: "N/A",
            warranty: "N/A",
            other_details: "Failed to parse - see raw_text"
        };
    }
}

async function summarizeProposal(rfpTitle, vendorName, proposalText) {
    const systemPrompt = `
You are a procurement assistant.
Read the vendor's proposal for the RFP: "${rfpTitle}".
Vendor: "${vendorName}"

Proposal Text:
"""
${proposalText}
"""

Task:
Provide a strong, detailed summary (2-3 sentences) highlighting the key value proposition.
Focus on:
1. Total Cost/Price.
2. Delivery commitment.
3. Any unique benefits or warranties mentioned.
Make it sound professional and helpful for decision making.
`;

    try {
        const completion = await hfClient.chatCompletion({
            model: "openai/gpt-oss-20b:groq",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Summarize this proposal." }
            ],
            max_tokens: 300
        });
        const summary = completion.choices?.[0]?.message?.content?.trim() || "";
        console.log("✅ Generated summary:", summary.substring(0, 100) + "...");
        return summary;
    } catch (err) {
        console.warn("⚠️ Failed to generate summary:", err.message);
        return proposalText.substring(0, 200) + "..."; // fallback
    }
}

async function scoreProposal(rfpTitle, rfpRequirements, vendorName, extractedData, proposalText) {
    const systemPrompt = `
You are a procurement evaluation AI.
Evaluate a vendor proposal against an RFP and assign a score from 0-100.

RFP Title: "${rfpTitle}"
RFP Requirements: ${JSON.stringify(rfpRequirements || "Standard business requirements", null, 2)}

Vendor: "${vendorName}"
Extracted Data: ${JSON.stringify(extractedData, null, 2)}

Full Proposal Text:
"""
${proposalText.substring(0, 1500)}
"""

Evaluation Guidelines:
1. Compare Price, Delivery, Warranty against requirements.
2. If specific requirements are missing, assume standard industry practices.
3. **CRITICAL**: If Extracted Data is "N/A", YOU MUST READ THE FULL PROPOSAL TEXT to find the values.
4. Score generously for complete proposals (typically 60-95 range).
5. Score 0 ONLY if the proposal is completely irrelevant or gibberish.

OUTPUT ONLY A JSON OBJECT:
{
  "score": <number 0-100>,
  "reasoning": "<short explanation>"
}
`;

    try {
        const completion = await hfClient.chatCompletion({
            model: "openai/gpt-oss-20b:groq",
            messages: [
                { role: "system", content: systemPrompt },
                { role: "user", content: "Evaluate and score this proposal." }
            ],
            max_tokens: 400
        });

        let content = completion.choices?.[0]?.message?.content || "{}";
        console.log(`🤖 Raw AI Score Response for ${vendorName}:`, content);

        let parsedScore = null;
        let reasoning = "Scored by AI";

        // 1. Try JSON Parse
        try {
            const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
            const parsed = JSON.parse(cleanContent);
            if (typeof parsed.score === 'number') {
                console.log(`✅ AI Scored via JSON: ${parsed.score}`);
                parsedScore = parsed.score;
                reasoning = parsed.reasoning || reasoning;
            }
        } catch (e) {
            console.warn("⚠️ JSON parse failed for score, trying regex fallback...");
        }

        // 2. Regex Fallback
        if (parsedScore === null) {
            const scoreMatch = content.match(/"score"\s*:\s*(\d+)/) || content.match(/Score:\s*(\d+)/i);
            if (scoreMatch) {
                parsedScore = parseInt(scoreMatch[1], 10);
                console.log(`✅ AI Scored via Regex: ${parsedScore}`);
                reasoning = "Parsed from text response";
            }
        }

        // 3. Score Floor for Valid Proposals
        if (parsedScore !== null) {
            // If AI is overly harsh (0) but proposal exists, bump it.
            if (parsedScore === 0 && proposalText.length > 50) {
                console.warn("⚠️ AI returned 0 for a valid length proposal. Applying floor.");
                parsedScore = 65;
                reasoning += " (Adjusted for completeness)";
            }
            return { score: parsedScore, reasoning };
        }

        console.warn("❌ Could not extract score from AI response. Defaulting to fallback.");
        throw new Error("No score found in AI response");

    } catch (err) {
        console.warn("⚠️ Scoring error:", err.message);
        // Robust Fallback Calculation
        let fallbackScore = 60; // Start with a passing grade for a valid email
        if (extractedData.price && extractedData.price !== "N/A") fallbackScore += 10;
        if (extractedData.delivery && extractedData.delivery !== "N/A") fallbackScore += 10;
        if (proposalText.length > 50) fallbackScore += 10;

        return {
            score: Math.min(95, fallbackScore),
            reasoning: "AI generation failed; score estimated based on data completeness."
        };
    }
}

// ---------------------------
// Main processing
// ---------------------------
async function processVendorReplies() {
    console.log("\n🔄 Polling for vendor replies...");

    const messages = await getMailpitMessages();
    if (!messages.length) {
        console.log("📭 No messages in Mailpit");
        return;
    }

    console.log(`📬 Found ${messages.length} total messages in Mailpit`);

    let processedCount = 0;

    for (const msg of messages) {
        const senderEmail = extractSender(msg);
        const subject = extractSubject(msg);

        console.log(`\n📧 Processing: From ${senderEmail} - "${subject}"`);

        // Only process emails sent TO procurement
        const toProcurement = msg?.To?.some(
            (t) => t.Address.toLowerCase() === PROCUREMENT_EMAIL.toLowerCase()
        );

        if (!toProcurement) {
            console.log("⏭️  Skipping: Not sent to procurement email");
            continue;
        }

        if (await alreadyProcessed(msg.ID)) {
            console.log("⏭️  Skipping: Already processed");
            continue;
        }

        // 1. Try to extract RFP ID directly from Subject "[RFP #123] ..."
        const idMatch = subject.match(/\[RFP #(\d+)\]/i);
        let rfpId = null;
        let rfpTitle = "";

        if (idMatch) {
            rfpId = parseInt(idMatch[1], 10);
            console.log(`✅ Extracted RFP ID ${rfpId} directly from subject`);

            try {
                const titleRes = await db.query("SELECT title FROM rfps WHERE id = $1", [rfpId]);
                if (titleRes.rows.length > 0) {
                    rfpTitle = titleRes.rows[0].title;
                }
            } catch (err) {
                console.warn("⚠️ Could not fetch title for extracted ID:", rfpId);
            }
        } else {
            // 2. Fallback: Parse title from subject
            // Remove "Re:", "Fwd:", "Proposal for:" and trailing " - Submission Required"
            rfpTitle = subject
                .replace(/^(Re|Fwd|Proposal for):\s*/i, "") // Prefixes
                .replace(/\s*-\s*Submission Required.*$/i, "") // Suffix
                .replace(/\[RFP #\d+\]/i, "") // Just in case
                .trim();

            console.log(`🔍 Extracted potential title: "${rfpTitle}"`);
            rfpId = await getRfpIdFromTitle(rfpTitle);
        }

        if (!rfpId) {
            console.log(`❌ RFP not found in DB (ID or Title match failed)`);
            await markProcessed(msg.ID);
            continue;
        }

        console.log(`✅ Found RFP ID: ${rfpId}`);

        // Fetch RFP requirements for scoring
        let rfpRequirements = null;
        try {
            const rfpRes = await db.query(
                "SELECT structured_requirements FROM rfps WHERE id = $1",
                [rfpId]
            );
            if (rfpRes.rows.length > 0) {
                rfpRequirements = rfpRes.rows[0].structured_requirements;
            }
        } catch (err) {
            console.warn("⚠️ Could not fetch RFP requirements:", err.message);
        }

        // Fetch vendors for this RFP
        const vendorsForRfp = await getVendorsForRfp(rfpId);
        console.log(`👥 Found ${vendorsForRfp.length} vendors linked to this RFP`);

        const vendor = findVendorByEmail(vendorsForRfp, senderEmail);
        if (!vendor) {
            console.log(`❌ Vendor with email ${senderEmail} not linked to RFP "${rfpTitle}"`);
            console.log(`   Linked vendors:`, vendorsForRfp.map(v => v.contact_email));
            await markProcessed(msg.ID);
            continue;
        }

        console.log(`✅ Matched vendor: ${vendor.vendor_name}`);

        const proposalText = extractBody(msg);
        console.log(`📄 Proposal text length: ${proposalText.length} characters`);

        console.log("🤖 Extracting proposal data with AI...");
        const extractedData = await extractProposalData(rfpTitle, vendor.vendor_name, proposalText);

        console.log("🤖 Generating AI summary...");
        const aiSummary = await summarizeProposal(rfpTitle, vendor.vendor_name, proposalText);

        console.log("🤖 Calculating AI score...");
        const scoreResult = await scoreProposal(
            rfpTitle,
            rfpRequirements,
            vendor.vendor_name,
            extractedData,
            proposalText
        );

        await db.query(
            `INSERT INTO proposals (rfp_id, vendor_id, extracted_data, ai_summary, ai_score)
             VALUES ($1, $2, $3::jsonb, $4, $5)
             ON CONFLICT (rfp_id, vendor_id) 
             DO UPDATE SET extracted_data = $3::jsonb, ai_summary = $4, ai_score = $5`,
            [rfpId, vendor.id, JSON.stringify(extractedData), aiSummary, scoreResult.score]
        );

        console.log(`✅ Stored proposal from ${vendor.vendor_name} for RFP "${rfpTitle}"`);
        await markProcessed(msg.ID);
        processedCount++;
    }

    console.log(`\n✅ Processed ${processedCount} new vendor replies`);
}

// ---------------------------
// Start polling
// ---------------------------
console.log("🚀 Starting vendor reply processor...");
console.log(`⏰ Polling every ${POLL_INTERVAL / 1000} seconds`);

setInterval(async () => {
    try {
        await processVendorReplies();
    } catch (err) {
        console.error("❌ Error processing vendor replies:", err);
    }
}, POLL_INTERVAL);

// Run immediately on startup
processVendorReplies().catch(console.error);

// ---------------------------
// Manual trigger route
// ---------------------------
router.get("/process", async (req, res) => {
    try {
        await processVendorReplies();
        res.json({ status: "success", message: "Processed vendor replies." });
    } catch (err) {
        res.status(500).json({ status: "error", message: err.message });
    }
});

// ---------------------------
// Get all proposals for an RFP
// ---------------------------
router.get("/proposals/:rfpId", async (req, res) => {
    try {
        const { rfpId } = req.params;
        const result = await db.query(
            `SELECT p.id, p.extracted_data, p.ai_summary, p.ai_score, p.created_at,
                    v.vendor_name, v.contact_email
             FROM proposals p
             JOIN vendors v ON p.vendor_id = v.id
             WHERE p.rfp_id = $1
             ORDER BY p.created_at DESC`,
            [rfpId]
        );
        res.json({ proposals: result.rows });
    } catch (err) {
        console.error("Error fetching proposals:", err);
        res.status(500).json({ error: "Could not fetch proposals" });
    }
});

// ---------------------------
// Get AI recommendation for an RFP
// ---------------------------
router.get("/recommendation/:rfpId", async (req, res) => {
    try {
        const { rfpId } = req.params;

        // 1. Check if we already have a stored recommendation
        const storedRec = await db.query(
            "SELECT recommendation_data FROM rfp_recommendations WHERE rfp_id = $1",
            [rfpId]
        );

        // Fetch proposals (needed for table in UI)
        const proposalsResult = await db.query(
            `SELECT p.id, p.extracted_data, p.ai_summary, p.ai_score, p.created_at,
                    v.vendor_name, v.contact_email
             FROM proposals p
             JOIN vendors v ON p.vendor_id = v.id
             WHERE p.rfp_id = $1
             ORDER BY p.ai_score DESC NULLS LAST, p.created_at DESC`,
            [rfpId]
        );
        const proposals = proposalsResult.rows;

        // If stored exists, return it immediately without calling AI
        if (storedRec.rows.length > 0) {
            console.log(`✅ Returned cached recommendation for RFP ${rfpId}`);
            return res.json({
                recommendation: storedRec.rows[0].recommendation_data,
                proposals: proposals
            });
        }

        // Fetch RFP details for generation
        const rfpResult = await db.query(
            `SELECT id, title, structured_requirements FROM rfps WHERE id = $1`,
            [rfpId]
        );
        if (rfpResult.rows.length === 0) {
            return res.status(404).json({ error: "RFP not found" });
        }
        const rfp = rfpResult.rows[0];

        if (proposals.length === 0) {
            return res.json({
                recommendation: null,
                reasoning: "No proposals received yet.",
                proposals: []
            });
        }

        // Generate AI recommendation (Only runs if no stored rec exists)
        console.log(`🤖 Generating NEW AI recommendation for RFP ${rfpId}...`);

        const systemPrompt = `
You are a procurement decision assistant.
Analyze multiple vendor proposals for an RFP and provide a recommendation.

RFP Title: "${rfp.title}"
RFP Requirements: ${JSON.stringify(rfp.structured_requirements, null, 2)}

Proposals to Compare:
${proposals.map((p, idx) => `
Proposal ${idx + 1} - ${p.vendor_name}:
- Score: ${p.ai_score || 'N/A'}/100
- Price: ${p.extracted_data?.price || 'N/A'}
- Delivery: ${p.extracted_data?.delivery || 'N/A'}
- Warranty: ${p.extracted_data?.warranty || 'N/A'}
- Summary: ${p.ai_summary || 'N/A'}
`).join('\n')}

Task:
1. Compare all proposals across price, delivery, warranty, and overall value
2. Recommend the best vendor with clear reasoning
3. Highlight key differentiators

OUTPUT ONLY A JSON OBJECT:
{
  "recommended_vendor": "<vendor name EXACTLY as shown in proposal>",
  "reasoning": "<2-3 paragraph explanation of why this vendor is recommended, comparing against others>",
  "key_factors": ["<factor1>", "<factor2>", "<factor3>"]
}

Do not include markdown, code blocks, or any other text. Only the JSON object.
`;

        try {
            const completion = await hfClient.chatCompletion({
                model: "openai/gpt-oss-20b:groq",
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: "Analyze and recommend the best vendor." }
                ],
                max_tokens: 500
            });

            let content = completion.choices?.[0]?.message?.content || "{}";
            content = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

            let recommendation = JSON.parse(content);

            // PROGRAMMATICALLY RESOLVE ID TO PREVENT HALLUCINATION
            const matchedProposal = proposals.find(p =>
                p.vendor_name.toLowerCase().includes(recommendation.recommended_vendor.toLowerCase()) ||
                recommendation.recommended_vendor.toLowerCase().includes(p.vendor_name.toLowerCase())
            );

            if (matchedProposal) {
                console.log(`✅ Matched AI recommendation "${recommendation.recommended_vendor}" to Proposal ID ${matchedProposal.id}`);
                recommendation.recommended_vendor_id = matchedProposal.id;
                // Correct name to exact match
                recommendation.recommended_vendor = matchedProposal.vendor_name;
            } else {
                console.warn(`⚠️ Could not match AI vendor "${recommendation.recommended_vendor}" to any proposal. Defaulting to top scored.`);
                // Fallback if AI name doesn't match known vendors
                const topProposal = proposals[0];
                recommendation.recommended_vendor = topProposal.vendor_name;
                recommendation.recommended_vendor_id = topProposal.id;
                recommendation.reasoning += " (Fallback match applied due to name mismatch)";
            }

            // Fallback if AI doesn't return valid recommendation keys at all
            if (!recommendation.recommended_vendor) {
                const topProposal = proposals[0];
                recommendation = {
                    recommended_vendor: topProposal.vendor_name,
                    recommended_vendor_id: topProposal.id,
                    reasoning: `Based on AI scoring, ${topProposal.vendor_name} has the highest score (${topProposal.ai_score}/100). ${topProposal.ai_summary || 'No additional reasoning available.'}`,
                    key_factors: ["AI Score", "Price", "Delivery Timeline"]
                };
            }

            // Store the new recommendation
            await db.query(
                "INSERT INTO rfp_recommendations (rfp_id, recommendation_data) VALUES ($1, $2::jsonb) ON CONFLICT (rfp_id) DO NOTHING",
                [rfpId, JSON.stringify(recommendation)]
            );
            console.log(`💾 Saved recommendation for RFP ${rfpId}`);

            res.json({
                recommendation: recommendation,
                proposals: proposals
            });
        } catch (err) {
            console.warn("⚠️ Failed to generate AI recommendation, using fallback:", err.message);
            // Fallback logic
            const topProposal = proposals[0];
            const fallbackRec = {
                recommended_vendor: topProposal.vendor_name,
                recommended_vendor_id: topProposal.id,
                reasoning: `Based on AI scoring, ${topProposal.vendor_name} has the highest score (${topProposal.ai_score || 'N/A'}/100). This recommendation is based on automated scoring of price competitiveness, delivery timeline, warranty terms, and proposal completeness.`,
                key_factors: ["AI Score", "Price", "Delivery", "Warranty"]
            };

            res.json({
                recommendation: fallbackRec,
                proposals: proposals
            });
        }
    } catch (err) {
        console.error("Error generating recommendation:", err);
        res.status(500).json({ error: "Could not generate recommendation" });
    }
});

export default router;