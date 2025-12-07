import "dotenv/config";
import nodemailer from "nodemailer";
import fetch from "node-fetch";

const PROCUREMENT_EMAIL = process.env.PROCUREMENT_EMAIL || "procurement-system@test.com";

// Mailpit SMTP
const transport = nodemailer.createTransport({
    host: "localhost",
    port: 1025,
    secure: false,
    auth: null,
});

/* ---------------------------------------------
   Configuration: Vendor Response Templates
   Edit these templates to change how vendors reply.
------------------------------------------------ */
const VENDOR_CONFIG = [
    {
        name: "Tech Supply Co.",
        email: "vendor1@test.com",
        responseTemplate: (title) => `
Proposal for "${title}":

Thank you for inviting us to submit a proposal for "Office Furniture Procurement for Expanding Team".

Offer:

* Price: $28,750
* Delivery: 25 days (on-site assembly included)
* Warranty: 2 years on all items
* Additional Services: Free ergonomic assessment for chairs, optional customization of desk finishes
* Payment Terms: Net 30
* Notes: All furniture is made from sustainable materials and includes lifetime support for assembly issues.
`,
    },
    {
        name: "Supply Tech Co.",
        email: "vendor2@test.com",
        responseTemplate: (title) => `
Proposal for "${title}":

Cost: $2,300 per month

Delivery: Service start date January 10, 2026

Warranty: 1 year service satisfaction guarantee

Additional Details: Includes restroom restocking, weekly deep sanitation cycle, and optional weekend add-on services.
`,
    },
];

/* ---------------------------------------------
   Mailpit Helpers
------------------------------------------------ */
async function getMailpitMessages() {
    try {
        const res = await fetch("http://localhost:8025/api/v1/messages?expand=1");
        const json = await res.json();
        return Array.isArray(json.messages) ? json.messages : [];
    } catch (error) {
        console.log(`❌ Failed to connect to Mailpit at http://localhost:8025. Is it running? Error: ${error.message}`);
        return [];
    }
}

function extractSender(msg) {
    if (msg?.From?.Address) return msg.From.Address.toLowerCase().trim();
    if (msg?.addresses?.from?.[0]?.address) return msg.addresses.from[0].address.toLowerCase().trim();
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

/* ---------------------------------------------
   Find the latest procurement-sent RFP ID
------------------------------------------------ */
async function findLatestRfpId() {
    const messages = await getMailpitMessages();

    // Filter messages from procurement with "New RFP" or "Submission Required"
    const rfpMessages = messages.filter(
        (msg) =>
            extractSender(msg) === PROCUREMENT_EMAIL.toLowerCase() &&
            (extractSubject(msg).includes("New RFP:") || extractSubject(msg).includes("- Submission Required"))
    );

    if (rfpMessages.length === 0) return null;

    // Sort by creation timestamp (newest first)
    rfpMessages.sort((a, b) => new Date(b.created) - new Date(a.created));

    const latestMsg = rfpMessages[0];
    const subject = extractSubject(latestMsg);

    // Attempt to extract [RFP #123]
    const idMatch = subject.match(/\[RFP #(\d+)\]/);
    if (!idMatch) {
        console.log("⚠️ Latest email found but no RFP ID in subject:", subject);
        return null;
    }

    return {
        id: idMatch[1],
        idTag: idMatch[0],
        title: subject.replace(/\[RFP #\d+\]/i, "").replace("New RFP:", "").replace("- Submission Required", "").trim(),
        timestamp: latestMsg.created
    };
}

/* ---------------------------------------------
   Send vendor proposals back to procurement
------------------------------------------------ */
async function sendVendorProposals() {
    console.log("🔍 Searching for latest RFP transaction...");

    const latestRfp = await findLatestRfpId();

    if (!latestRfp) {
        console.log("\n❌ No procurement RFP emails found.");
        process.exit(0);
    }

    console.log(`\n📨 Latest RFP detected: ID #${latestRfp.id} - "${latestRfp.title}"`);

    // Now find ALL emails that have this ID in the subject
    const messages = await getMailpitMessages();
    const relatedMessages = messages.filter(msg =>
        extractSubject(msg).includes(latestRfp.idTag) &&
        extractSender(msg) === PROCUREMENT_EMAIL.toLowerCase()
    );

    console.log(`Checks found ${relatedMessages.length} emails associated with this RFP.`);

    // Aggregate all recipients from these related messages
    const recipients = new Set();
    relatedMessages.forEach(msg => {
        const toList = msg.To || [];
        toList.forEach(t => recipients.add(t.Address.toLowerCase()));
    });

    console.log(`👥 Consolidated recipient list: ${Array.from(recipients).join(", ")}`);

    for (const vendor of VENDOR_CONFIG) {
        // Only reply if this vendor was in the consolidated list
        if (!recipients.has(vendor.email.toLowerCase())) {
            console.log(`⏭️  Skipping ${vendor.name} (${vendor.email}) - not a recipient.`);
            continue;
        }

        await transport.sendMail({
            from: vendor.email,
            to: PROCUREMENT_EMAIL,
            subject: `Re: ${latestRfp.idTag} ${latestRfp.title}`,
            text: vendor.responseTemplate(latestRfp.title),
        });

        console.log(`✅ Sent proposal from: ${vendor.name}`);
    }

    console.log("🏁 Vendor simulation complete.");
    process.exit(0);
}

sendVendorProposals();
