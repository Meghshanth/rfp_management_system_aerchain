-- 1. ENUM for RFP Status (Required for workflow tracking: DRAFT, SENT, CLOSED)
CREATE TYPE "RfpStatus" AS ENUM ('DRAFT', 'SENT', 'CLOSED');

DROP TABLE vendors, rfp_vendors, rfps, proposals, processed_mailpit, rfp_recommendations;
----------------------------------------------------------------------
-- 2. VENDOR Table (Your requested 4-column structure)
----------------------------------------------------------------------
CREATE TABLE vendors (
                         id SERIAL PRIMARY KEY,
                         vendor_name VARCHAR(255) NOT NULL,
                         contact_name VARCHAR(255),
                         contact_email VARCHAR(255) UNIQUE NOT NULL
);

----------------------------------------------------------------------
-- 3. RFP Table (What you send out)
-- Stores the structured requirements parsed from user input.
----------------------------------------------------------------------
CREATE TABLE rfps (
                      id SERIAL PRIMARY KEY,
                      title VARCHAR(255) NOT NULL,
                      status "RfpStatus" NOT NULL DEFAULT 'DRAFT',

    -- The fully structured requirements (AI's output from the initial request)
                      structured_requirements JSONB NOT NULL,

                      created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

----------------------------------------------------------------------
-- 4. RFP_VENDORS (Junction Table)
----------------------------------------------------------------------
CREATE TABLE rfp_vendors (
                             rfp_id INTEGER NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
                             vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE CASCADE,

                             PRIMARY KEY (rfp_id, vendor_id),

                             sent_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

----------------------------------------------------------------------
-- 5. PROPOSALS Table (What you evaluate)
-- Contains only the essential keys and the AI-parsed/evaluated data.
----------------------------------------------------------------------
CREATE TABLE proposals (
                           id SERIAL PRIMARY KEY,

                           rfp_id INTEGER NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
                           vendor_id INTEGER NOT NULL REFERENCES vendors(id) ON DELETE RESTRICT,

    -- THE ONLY DATA COLUMN: Structured data extracted from the vendor's response by AI.
                           extracted_data JSONB NOT NULL,

    -- AI-Assisted Evaluation results (Needed for comparison/scoring)
                           ai_score INT,
                           ai_summary TEXT,

                           created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,

    -- Constraint: A vendor submits only one proposal per RFP
                           UNIQUE (rfp_id, vendor_id)
);


CREATE TABLE processed_mailpit (
                                   message_id VARCHAR(255) PRIMARY KEY,
                                   processed_at TIMESTAMPTZ DEFAULT NOW()
);

----------------------------------------------------------------------
-- 6. RFP RECOMMENDATIONS
-- Stores the AI's final recommendation to prevent regeneration on refresh.
----------------------------------------------------------------------
CREATE TABLE rfp_recommendations (
    id SERIAL PRIMARY KEY,
    rfp_id INTEGER NOT NULL REFERENCES rfps(id) ON DELETE CASCADE,
    recommendation_data JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(rfp_id)
);


INSERT INTO vendors (vendor_name, contact_name, contact_email)
VALUES ('Tech Supply Co.', 'John Doe', 'vendor1@test.com');

INSERT INTO vendors (vendor_name, contact_name, contact_email)
VALUES ('Supply Tech Co.', 'Jane Doe', 'vendor2@test.com');