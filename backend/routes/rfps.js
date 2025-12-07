// import express from "express";
// import db from "../db/config.js";
// import nodemailer from "nodemailer";
//
// const router = express.Router();
//
// // Mailpit SMTP Transport
// const transporter = nodemailer.createTransport({
//     host: "localhost",
//     port: 1025,
//     secure: false,
//     auth: null,
// });
//
// /**
//  * ----------------------------------------
//  * GET /api/vendors
//  * Fetch vendor list
//  * ----------------------------------------
//  */
// router.get("/vendors", async (req, res) => {
//     try {
//         const sql = `
//             SELECT id, vendor_name, contact_name, contact_email
//             FROM vendors
//             ORDER BY vendor_name ASC
//         `;
//         const result = await db.query(sql);
//
//         res.status(200).json({ vendors: result.rows });
//     } catch (err) {
//         console.error("Vendor fetch error:", err);
//         res.status(500).json({ error: "Could not fetch vendors" });
//     }
// });
//
// /**
//  * -------------------------------------------------
//  * POST /api/rfps/confirm
//  * Saves RFP, sends emails via Mailpit SMTP
//  * -------------------------------------------------
//  */
// router.post("/confirm", async (req, res) => {
//     try {
//         const { approved, rfp, vendorIds } = req.body;
//
//         if (!approved) {
//             return res.status(200).json({ message: "RFP discarded" });
//         }
//
//         if (!vendorIds || vendorIds.length === 0) {
//             return res.status(400).json({ error: "No vendors selected" });
//         }
//
//         // 1. Insert RFP into database
//         const insertSql = `
//             INSERT INTO rfps (title, status, structured_requirements)
//             VALUES ($1, 'DRAFT', $2::jsonb)
//             RETURNING id, title, status
//         `;
//         const dbResult = await db.query(insertSql, [
//             rfp.title,
//             JSON.stringify(rfp),
//         ]);
//         const savedRfp = dbResult.rows[0];
//
//         // 2. Fetch selected vendors
//         const vendorQuery = `
//             SELECT vendor_name, contact_name, contact_email
//             FROM vendors
//             WHERE id = ANY($1::int[])
//         `;
//         const vendorResult = await db.query(vendorQuery, [vendorIds]);
//
//         // 3. Send emails through Mailpit
//         const emailPromises = vendorResult.rows.map(async (vendor) => {
//             const emailBody = `
// Hello ${vendor.contact_name},
//
// You have received a new Request for Proposal (RFP).
//
// RFP Title: ${rfp.title}
// --------------------------------------------------
// ${JSON.stringify(rfp, null, 2)}
// --------------------------------------------------
//
// Please reply to this email in order to submit your proposal.
// (Your reply will appear inside Mailpit UI.)
// `;
//
//             await transporter.sendMail({
//                 from: "procurement-system@test.com",
//                 to: vendor.contact_email,
//                 subject: `New RFP: ${rfp.title} - Submission Required`,
//                 text: emailBody,
//             });
//         });
//
//         await Promise.all(emailPromises);
//
//         // 4. Update RFP status
//         const updateSql = `UPDATE rfps SET status = 'SENT' WHERE id = $1`;
//         await db.query(updateSql, [savedRfp.id]);
//
//         return res.status(201).json({
//             rfp: { ...savedRfp, status: "SENT" },
//             message: "RFP saved and sent to selected vendors",
//         });
//
//     } catch (err) {
//         console.error("RFP confirm error:", err);
//         res.status(500).json({ error: "Could not save/send RFP" });
//     }
// });
//
// export default router;

// /backend/src/routes/rfps.js
import express from "express";
import db from "../db/config.js";
import nodemailer from "nodemailer";

const router = express.Router();

// Mailpit SMTP Transport
const transporter = nodemailer.createTransport({
    host: "localhost",
    port: 1025,
    secure: false,
    auth: null,
});

// Helper function to capitalize keys
function capitalize(str) {
    return str.charAt(0).toUpperCase() + str.slice(1).replace(/_/g, ' ');
}

// Helper function to format RFP for email dynamically
function formatRfpForEmail(rfp, vendorName) {
    let lines = [`Hello ${vendorName},\n`,
        `You have received a new Request for Proposal (RFP) from our procurement system.\n`,
    `RFP Title: ${rfp.title}\n`,
        '--------------------------------------------------'];

    for (const [key, value] of Object.entries(rfp)) {
        if (key === 'title') continue; // Already displayed
        if (Array.isArray(value)) {
            lines.push(`${capitalize(key)}:`);
            value.forEach(item => {
                if (typeof item === 'object') {
                    const itemLines = Object.entries(item)
                        .map(([k, v]) => `${k}: ${v}`)
                        .join(', ');
                    lines.push(`• ${itemLines}`);
                } else {
                    lines.push(`• ${item}`);
                }
            });
        } else if (typeof value === 'object' && value !== null) {
            lines.push(`${capitalize(key)}:`);
            Object.entries(value).forEach(([k, v]) => {
                lines.push(`• ${k}: ${v}`);
            });
        } else {
            lines.push(`${capitalize(key)}: ${value || 'N/A'}`);
        }
    }

    lines.push('--------------------------------------------------');
    lines.push('\nPlease reply to this email in order to submit your proposal.\n(Your reply will appear inside Mailpit UI.)');

    return lines.join('\n');
}

/**
 * GET /api/vendors
 */
router.get("/vendors", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, vendor_name, contact_name, contact_email
            FROM vendors
            ORDER BY vendor_name ASC
        `);
        res.status(200).json({ vendors: result.rows });
    } catch (err) {
        console.error("Vendor fetch error:", err);
        res.status(500).json({ error: "Could not fetch vendors" });
    }
});

/**
 * POST /api/rfps/confirm
 * Saves RFP, links vendors, sends emails
 */
router.post("/confirm", async (req, res) => {
    try {
        const { approved, rfp, vendorIds } = req.body;

        console.log("📥 Received confirm request:");
        console.log("   - Approved:", approved);
        console.log("   - RFP Title:", rfp?.title);
        console.log("   - Vendor IDs:", vendorIds);

        if (!approved) {
            console.log("❌ RFP not approved by user");
            return res.status(200).json({ message: "RFP discarded" });
        }

        if (!vendorIds || vendorIds.length === 0) {
            console.log("❌ No vendors selected");
            return res.status(400).json({ error: "No vendors selected" });
        }

        // 1. Insert RFP
        console.log("💾 Inserting RFP into database...");
        const insertSql = `
            INSERT INTO rfps (title, status, structured_requirements)
            VALUES ($1, 'DRAFT', $2::jsonb)
            RETURNING id, title, status
        `;
        const dbResult = await db.query(insertSql, [rfp.title, JSON.stringify(rfp)]);
        const savedRfp = dbResult.rows[0];
        console.log(`✅ RFP saved with ID: ${savedRfp.id}`);

        // 2. Fetch selected vendors
        console.log(`🔍 Fetching ${vendorIds.length} vendors...`);
        const vendorResult = await db.query(
            `SELECT id, vendor_name, contact_name, contact_email
             FROM vendors
             WHERE id = ANY($1::int[])`,
            [vendorIds]
        );
        console.log(`✅ Found ${vendorResult.rows.length} vendors`);

        if (vendorResult.rows.length === 0) {
            console.log("❌ No valid vendors found with provided IDs");
            return res.status(400).json({ error: "No valid vendors found" });
        }

        // 3. Link vendors to RFP
        console.log("🔗 Linking vendors to RFP...");
        for (const vendor of vendorResult.rows) {
            try {
                await db.query(
                    `INSERT INTO rfp_vendors (rfp_id, vendor_id)
                     VALUES ($1, $2)
                     ON CONFLICT (rfp_id, vendor_id) DO NOTHING`,
                    [savedRfp.id, vendor.id]
                );
                console.log(`   ✅ Linked vendor ${vendor.vendor_name} (ID: ${vendor.id})`);
            } catch (linkErr) {
                console.error(`   ❌ Failed to link vendor ${vendor.vendor_name}:`, linkErr.message);
                throw linkErr; // Re-throw to trigger rollback
            }
        }

        // Verify links were created
        const verifyResult = await db.query(
            `SELECT v.vendor_name, v.contact_email 
             FROM rfp_vendors rv
             JOIN vendors v ON rv.vendor_id = v.id
             WHERE rv.rfp_id = $1`,
            [savedRfp.id]
        );
        console.log(`✅ Verified ${verifyResult.rows.length} vendor links created`);

        // 4. Send emails
        console.log("📧 Sending emails to vendors...");
        const emailPromises = vendorResult.rows.map(async (vendor) => {
            const emailBody = formatRfpForEmail(rfp, vendor.contact_name);
            try {
                await transporter.sendMail({
                    from: "procurement-system@test.com",
                    to: vendor.contact_email,
                    subject: `[RFP #${savedRfp.id}] ${rfp.title} - Submission Required`,
                    text: emailBody,
                });
                console.log(`   ✅ Email sent to ${vendor.vendor_name} (${vendor.contact_email})`);
            } catch (emailErr) {
                console.error(`   ❌ Failed to send email to ${vendor.vendor_name}:`, emailErr.message);
                // Continue with other emails even if one fails
            }
        });

        await Promise.all(emailPromises);

        // 5. Update RFP status to SENT
        console.log("📝 Updating RFP status to SENT...");
        await db.query(`UPDATE rfps SET status = 'SENT' WHERE id = $1`, [savedRfp.id]);

        console.log("✅ RFP process complete!");
        return res.status(201).json({
            rfp: { ...savedRfp, status: "SENT" },
            message: `RFP saved, ${verifyResult.rows.length} vendors linked, and emails sent successfully`,
            vendorsLinked: verifyResult.rows.length
        });

    } catch (err) {
        console.error("❌ RFP confirm error:", err);
        res.status(500).json({ error: "Could not save/send RFP", details: err.message });
    }
});

/**
 * GET /api/rfps/:id
 * Get a specific RFP with vendor links
 */
router.get("/:id", async (req, res) => {
    try {
        const { id } = req.params;

        // Get RFP
        const rfpResult = await db.query(
            `SELECT id, title, status, structured_requirements, created_at
             FROM rfps
             WHERE id = $1`,
            [id]
        );

        if (rfpResult.rows.length === 0) {
            return res.status(404).json({ error: "RFP not found" });
        }

        // Get linked vendors
        const vendorResult = await db.query(
            `SELECT v.id, v.vendor_name, v.contact_email
             FROM vendors v
             JOIN rfp_vendors rv ON rv.vendor_id = v.id
             WHERE rv.rfp_id = $1`,
            [id]
        );

        res.json({
            rfp: rfpResult.rows[0],
            vendors: vendorResult.rows
        });
    } catch (err) {
        console.error("Error fetching RFP:", err);
        res.status(500).json({ error: "Could not fetch RFP" });
    }
});

/**
 * GET /api/rfps
 * Get all RFPs
 */
router.get("/", async (req, res) => {
    try {
        const result = await db.query(`
            SELECT id, title, status, created_at
            FROM rfps
            ORDER BY created_at DESC
        `);
        res.json({ rfps: result.rows });
    } catch (err) {
        console.error("Error fetching RFPs:", err);
        res.status(500).json({ error: "Could not fetch RFPs" });
    }
});

export default router;