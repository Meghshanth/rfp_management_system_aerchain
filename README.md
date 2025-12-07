# AI-Powered RFP Management System

An end-to-end purchasing workflow that allows users to create RFPs from natural language, send them to vendors via email, and automatically parse/compare vendor responses using AI.
(for any questions on how to run this, email me at: sara.meghshanth@gmail.com)
## Features
- **Natural Language Creation**: Type "I need 20 laptops..." and get a structured RFP.
- **Email Integration**: Sends RFPs to vendors and polls for replies using Mailpit (SMTP/IMAP simulator).
- **AI Parsing**: Automatically extracts price, delivery, and warranty terms from vendor email replies.
- **Comparison View**: Real-time table comparison of proposals with AI-generated summaries and recommendations.

## Tech Stack
- **Frontend**: React, Material UI
- **Backend**: Node.js, Express, PostgreSQL
- **AI**: Hugging Face Inference API (`openai/gpt-oss-20b:groq` model)
- **Email**: Mailpit (Local SMTP/IMAP mock)

## Project Setup

### Prerequisites
- Node.js (v18+)
- PostgreSQL (Local instance)
- Mailpit (Running on ports 1025/8025)
- Hugging Face API Key

### Installation

1.  **Database**:
    - Ensure PostgreSQL is running.
    - Create database `rfp_management_system`.
    - Run schema: `psql -d rfp_management_system -f backend/sql/schema.sql`

2.  **Backend**:
    ```bash
    cd backend
    npm install
    cp .env.example .env # Add your HF_API_KEY and DB credentials
    node server.js
    ```

3.  **Frontend**:
    ```bash
    cd frontend
    npm install
    npm run dev
    ```

4.  **Mailpit**:
    - Run Mailpit locally: `mailpit`
    - Make sure to install Mailpit from https://mailpit.axllent.org/, according to your OS and run the exe file through cmd line.

## How to Run the Demo

1.  **Open App**: Go to `http://localhost:5173`.
2.  **Create RFP**:
    - Type a request: *"I need 50 gaming laptops, high end. Budget $100k."*
    - click send. AI will generate the structure.
    - Click **Yes, proceed**.
    - Select vendors and **Send RFP**.
3.  **Simulate Vendors**:
    - Open a new terminal.
    - Run: `node backend/vendor/vendor.js`
    - This sends fake email replies to the system.
4.  **View Comparison**:
    - In the frontend, after sending, click **View Proposals & Comparison**.
    - Wait a few seconds for the backend to poll and parse the emails.
    - Refresh the comparison page to see the table and AI recommendation.

## Decisions & Assumptions
- **Single User**: No authentication implemented as per scope.
- **Mailpit**: Used instead of real Gmail/Outlook to avoid spamming real addresses and for ease of local testing.
- **AI Model**: Used `gpt-oss-20b` via Hugging Face free tier for zero-cost inference.
- **Polling**: Backend polls Mailpit every 15s. In production, webhooks would be better.

## API Documentation

### Endpoints

#### 1. Create RFP from Natural Language
**POST** `/api/chat`

Converts natural language procurement requests into structured RFP JSON.

**Request Body:**
```json
{
  "text": "I need 20 laptops with 16GB RAM. Budget $50,000. Delivery within 30 days."
}
```

**Success Response (200):**
```json
{
  "reply": "Here's the generated RFP. Do you approve? (Yes/No)",
  "structured_requirements": {
    "title": "Procurement of Laptops",
    "summary": "...",
    "requirements": [],
    "budget": "50000",
    "delivery_terms": "...",
    "warranty_terms": "...",
    "payment_terms": "...",
    "submission_instructions": "..."
  }
}
```

**Error Response (500):**
```json
{
  "error": "AI backend error or database connection issue."
}
```

#### 2. Save and Send RFP
**POST** `/api/rfps/confirm`

Saves RFP to database, links vendors, and sends emails.

**Request Body:**
```json
{
  "approved": true,
  "rfp": {  },
  "vendorIds": [1, 2, 3]
}
```

**Success Response (201):**
```json
{
  "rfp": {
    "id": 1,
    "title": "...",
    "status": "SENT"
  },
  "message": "RFP saved, 2 vendors linked, and emails sent successfully",
  "vendorsLinked": 2
}
```

#### 3. Get RFP Details
**GET** `/api/rfps/:id`

Retrieves RFP with linked vendors.

**Success Response (200):**
```json
{
  "rfp": {
    "id": 1,
    "title": "...",
    "status": "SENT",
    "structured_requirements": {},
    "created_at": "..."
  },
  "vendors": []
}
```

#### 4. Get All RFPs
**GET** `/api/rfps`

Lists all RFPs.

**Success Response (200):**
```json
{
  "rfps": [
    {
      "id": 1,
      "title": "...",
      "status": "SENT",
      "created_at": "..."
    }
  ]
}
```

#### 5. Get Vendors
**GET** `/api/rfps/vendors`

Lists all available vendors.

**Success Response (200):**
```json
{
  "vendors": [
    {
      "id": 1,
      "vendor_name": "Tech Supply Co.",
      "contact_name": "John Doe",
      "contact_email": "vendor1@test.com"
    }
  ]
}
```

#### 6. Get Proposals for RFP
**GET** `/api/vendor/proposals/:rfpId`

Retrieves all proposals received for an RFP.

**Success Response (200):**
```json
{
  "proposals": [
    {
      "id": 1,
      "vendor_name": "Tech Supply Co.",
      "extracted_data": {
        "price": "$28,750",
        "delivery": "25 days",
        "warranty": "2 years",
        "other_details": "..."
      },
      "ai_summary": "...",
      "ai_score": 85,
      "created_at": "..."
    }
  ]
}
```

#### 7. Get AI Recommendation
**GET** `/api/vendor/recommendation/:rfpId`

Generates AI-powered recommendation comparing all proposals.

**Success Response (200):**
```json
{
  "recommendation": {
    "recommended_vendor": "Tech Supply Co.",
    "recommended_vendor_id": 1,
    "reasoning": "Based on comprehensive analysis...",
    "key_factors": ["Price", "Delivery", "Warranty"]
  },
  "proposals": []
}
```

#### 8. Manual Process Vendor Replies
**GET** `/api/vendor/process`

Manually triggers email polling and proposal processing.

**Success Response (200):**
```json
{
  "status": "success",
  "message": "Processed vendor replies."
}
```

## AI Usage

### Tools Used
- **Cursor AI / Google Antigravity**: Primary development assistant.
- **ChatGPT/Claude**: Design decisions and prompt engineering for AI input.

### What AI Helped With

1. **Boilerplate Generation**
   - Frontend UI restructuring for minimalist, and easy going Web UI
   - Express route scaffolding

2. **Prompt Engineering**
   - RFP generation prompts (structured JSON output)
   - Recommendation prompts (multi-factor analysis)

3. **Debugging**
   - Email parsing regex patterns
   - JSON parsing edge cases
   - Database query optimization

4. **Design Decisions**
   - API endpoint structure
   - Error handling patterns

### Key AI Prompts

#### RFP Generation Prompt
```
You are an RFP-generation assistant. 
Transform user input into structured, professional RFP content.

STRICT RULES:
- If valid RFP input: output ONLY valid JSON object
- If non-RFP input: output plain text redirect

Example JSON Output:
{
  "title": "...",
  "summary": "...",
  "requirements": [...],
  "budget": "...",
  ...
}
```

#### Proposal Extraction Prompt
```
You are a procurement assistant AI.
Extract structured data from vendor proposals.

Extract:
- price: Total cost
- delivery: Timeline
- warranty: Terms
- other_details: Additional terms

OUTPUT ONLY VALID JSON OBJECT.
```

#### Scoring Prompt
```
Evaluate vendor proposal against RFP.
Score 0-100 based on:
1. Price competitiveness (0-30)
2. Delivery timeline (0-25)
3. Warranty/terms (0-20)
4. Completeness (0-15)
5. Value-added services (0-10)

OUTPUT: { "score": <number>, "reasoning": "<text>" }
```

#### Recommendation Prompt
```
Analyze multiple vendor proposals.
Compare across price, delivery, warranty, value.
Recommend best vendor with clear reasoning.

OUTPUT: {
  "recommended_vendor": "...",
  "reasoning": "...",
  "key_factors": [...]
}
```

### What Changed Because of AI

1. **Structured Output**: Switched from free-form text to strict JSON for RFP generation
2. **Error Handling**: Added fallback mechanisms when AI returns invalid JSON
3. **Multi-step Processing**: Separated extraction, summarization, and scoring into distinct AI calls
4. **Prompt Iteration**: Refined prompts through multiple iterations to improve accuracy