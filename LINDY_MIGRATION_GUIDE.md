# Lindy to Code Migration Guide

This guide helps you migrate from Lindy + Google Sheets to your code-based Supabase system hosted on Vercel.

## Overview

Your new system replaces all Lindy bots with API endpoints that can be called directly by webhooks or by Lindy (during transition). All data is now stored in Supabase instead of Google Sheets.

---

## API Endpoints Reference

### Base URL
```
https://your-app.vercel.app/api
```

---

## 1. Data Retrieval Endpoints (GET)

### Get Cleaners & Availability
**Endpoint:** `GET /api/data/cleaners`

**Purpose:** Retrieve all cleaners and their availability for scheduling

**Query Parameters:**
- `startDate` (optional): Start date for availability check (YYYY-MM-DD)
- `endDate` (optional): End date for availability check (YYYY-MM-DD)
- `includeInactive` (optional): Include inactive cleaners (true/false)

**Example Request:**
```bash
curl "https://your-app.vercel.app/api/data/cleaners?startDate=2026-01-15&endDate=2026-01-31"
```

**Response:**
```json
{
  "success": true,
  "count": 3,
  "dateRange": {
    "startDate": "2026-01-15",
    "endDate": "2026-01-31"
  },
  "cleaners": [
    {
      "id": 1,
      "name": "Maria",
      "phone": "+15551234567",
      "telegram_id": "123456",
      "active": true,
      "skills": ["deep_clean", "standard"],
      "hourly_rate": 25.00,
      "blockedDates": ["2026-01-20"],
      "availableDates": ["2026-01-15", "2026-01-16", "2026-01-17"],
      "assignments": []
    }
  ]
}
```

---

### Get Jobs
**Endpoint:** `GET /api/data/jobs`

**Purpose:** Retrieve jobs with filtering options

**Query Parameters:**
- `status` (optional): Filter by status (comma-separated: lead,quoted,booked,confirmed,completed,cancelled)
- `date` (optional): Filter by specific date (YYYY-MM-DD)
- `startDate` (optional): Start of date range
- `endDate` (optional): End of date range
- `customerId` (optional): Filter by customer ID
- `paid` (optional): Filter by payment status (true/false)
- `booked` (optional): Filter by booking status (true/false)
- `cleaningType` (optional): Filter by cleaning type
- `unassigned` (optional): Get jobs without cleaning team (true)
- `needsAssignment` (optional): Get paid jobs without team (true)
- `limit` (optional): Limit results (default: all)
- `sortBy` (optional): Sort field (default: date)
- `sortOrder` (optional): Sort order (asc/desc, default: asc)

**Example Request:**
```bash
# Get all jobs needing cleaner assignment
curl "https://your-app.vercel.app/api/data/jobs?needsAssignment=true&sortBy=date&sortOrder=asc"

# Get upcoming jobs for a specific date
curl "https://your-app.vercel.app/api/data/jobs?date=2026-01-20&status=confirmed,booked"
```

**Response:**
```json
{
  "success": true,
  "count": 5,
  "filters": {
    "needsAssignment": "true"
  },
  "jobs": [
    {
      "id": 123,
      "customer_id": 45,
      "title": "Deep Cleaning",
      "date": "2026-01-20",
      "scheduled_at": "2026-01-20T09:00:00Z",
      "status": "booked",
      "cleaning_team": null,
      "cleaning_type": "deep",
      "paid": true,
      "price": 250.00,
      "customers": {
        "name": "John Doe",
        "phone_number": "+15559876543",
        "address": "123 Main St, Denver, CO 80203"
      }
    }
  ]
}
```

---

### Get Customers
**Endpoint:** `GET /api/data/customers`

**Purpose:** Retrieve customer data with full context (jobs, calls, messages)

**Query Parameters:**
- `id` (optional): Get specific customer by ID with full context
- `phone` (optional): Get specific customer by phone with full context
- `source` (optional): Filter by source (vapi_call, sms, etc.)
- `search` (optional): Search by name or phone
- `frequency` (optional): Filter by cleaning frequency
- `includeStats` (optional): Include job statistics (true/false)
- `limit` (optional): Limit results (default: 100)
- `sortBy` (optional): Sort field (default: created_at)
- `sortOrder` (optional): Sort order (asc/desc, default: desc)

**Example Request:**
```bash
# Get customer by phone with full history
curl "https://your-app.vercel.app/api/data/customers?phone=%2B15559876543"

# List all customers with stats
curl "https://your-app.vercel.app/api/data/customers?includeStats=true&limit=50"
```

**Response (with ID/phone):**
```json
{
  "success": true,
  "customer": {
    "id": 45,
    "phone_number": "+15559876543",
    "name": "John Doe",
    "email": "john@example.com",
    "address": "123 Main St",
    "city": "Denver",
    "zip_code": "80203",
    "square_footage": 2000,
    "bedrooms": 3,
    "bathrooms": 2,
    "frequency": "bi-weekly"
  },
  "jobs": [
    {
      "id": 123,
      "title": "Deep Cleaning",
      "date": "2026-01-20",
      "status": "booked",
      "paid": true,
      "price": 250.00
    }
  ],
  "calls": [
    {
      "id": 10,
      "date": "2026-01-08T10:30:00Z",
      "transcript": "...",
      "summary": "Customer wants to book deep cleaning",
      "outcome": "booked"
    }
  ],
  "messages": [
    {
      "role": "client",
      "content": "Hi, I'd like to schedule a cleaning",
      "timestamp": "2026-01-08T10:00:00Z"
    },
    {
      "role": "bot",
      "content": "Hi John! I'd be happy to help...",
      "timestamp": "2026-01-08T10:01:00Z"
    }
  ],
  "messageHistory": "[2026-01-08 10:00] Customer: Hi, I'd like to schedule a cleaning\n[2026-01-08 10:01] Bot: Hi John! I'd be happy to help..."
}
```

---

## 2. Data Modification Endpoints (POST)

### Create/Update Customer
**Endpoint:** `POST /api/data/customers`

**Purpose:** Create new customer or update existing (upserts by phone number)

**Request Body:**
```json
{
  "phone_number": "+15559876543",
  "name": "John Doe",
  "email": "john@example.com",
  "address": "123 Main St",
  "city": "Denver",
  "state": "CO",
  "zip_code": "80203",
  "square_footage": 2000,
  "bedrooms": 3,
  "bathrooms": 2,
  "pets": "1 dog",
  "frequency": "bi-weekly",
  "source": "lindy",
  "notes": "Prefers morning appointments"
}
```

**Response:**
```json
{
  "success": true,
  "customer": { /* customer object */ }
}
```

---

### Create Job
**Endpoint:** `POST /api/data/jobs`

**Purpose:** Create a new job (replaces "Add to Jobs" Lindy action)

**Request Body:**
```json
{
  "customer_id": 45,
  "title": "Deep Cleaning",
  "date": "2026-01-20",
  "scheduled_at": "2026-01-20T09:00:00Z",
  "cleaning_type": "deep",
  "status": "lead",
  "price": 250.00,
  "quote_amount": 250.00,
  "hours": 5,
  "notes": "Customer requested eco-friendly products",
  "special_instructions": "Enter through side door"
}
```

**Response:**
```json
{
  "success": true,
  "job": { /* job object */ }
}
```

---

### Update Job
**Endpoint:** `POST /api/data/jobs/update` or `PATCH /api/data/jobs/update`

**Purpose:** Update job fields (replaces manual Google Sheets updates)

**Request Body:**
```json
{
  "jobId": 123,
  "status": "confirmed",
  "cleaning_team": ["Maria", "Carlos"],
  "scheduled_at": "2026-01-20T10:00:00Z",
  "paid": true,
  "notes": "Updated notes"
}
```

**Response:**
```json
{
  "success": true,
  "job": { /* updated job */ },
  "changes": {
    "status": { "from": "booked", "to": "confirmed" },
    "cleaning_team": { "from": null, "to": ["Maria", "Carlos"] }
  },
  "notifications": [
    "customer_notified_reschedule",
    "cleaners_notified"
  ]
}
```

**Important:** This endpoint automatically:
- Sends SMS to customer if time/date changed
- Notifies cleaners if team assigned
- Sends payment confirmation if paid status changed
- Sends completion message if status = completed

---

## 3. Webhook Endpoints (Incoming)

These are already set up and replace your existing Lindy webhooks:

### VAPI Call Webhook
**Endpoint:** `POST /api/webhooks/vapi`

**Purpose:** Process completed calls from VAPI

**Replaces:** "Vapi Call to Lindy Bot"

**What it does:**
- Extracts customer data from call transcript using AI
- Creates/updates customer record
- Creates call log
- If booking intent detected, creates job and sends payment link
- Sends follow-up SMS

---

### SMS/Text Webhook
**Endpoint:** `POST /api/webhooks/sms`

**Purpose:** Process incoming text messages

**Replaces:** "Customer Text Bot"

**What it does:**
- Gets customer context and message history
- Detects intent (booking, quote, question)
- Generates AI response or processes booking
- Sends automated response
- Logs all messages

---

### Stripe Payment Webhook
**Endpoint:** `POST /api/webhooks/stripe`

**Purpose:** Process payment confirmations

**Replaces:** "Payment confirmed text"

**What it does:**
- Marks job as paid
- Sends confirmation SMS
- Updates job status

---

### Job Change Webhook
**Endpoint:** `POST /api/webhooks/job-change`

**Purpose:** Receive notifications when jobs are updated

**Replaces:** Jobs-sheet change listener

**What it does:**
- Logs what changed
- Notifies customers of changes (time, address)
- Notifies cleaners of assignments
- Handles status change notifications

---

## Migration Steps

### Phase 1: Database Setup (✅ Already Done)
1. ✅ Database schema created in Supabase
2. ✅ All tables and indexes created
3. ✅ Triggers for automatic updates set up

### Phase 2: Code Deployment (Do This Now)
1. Update your Supabase credentials in Vercel environment variables:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   ```

2. Deploy to Vercel:
   ```bash
   vercel --prod
   ```

3. Run the schema update in Supabase SQL Editor:
   ```sql
   -- Run the updated lib/schema.sql file
   -- This adds the job change tracking trigger
   ```

### Phase 3: Webhook Migration (Update in Lindy/External Services)

Update these webhook URLs to point to your Vercel app:

1. **VAPI Webhook URL:**
   - Old: Points to Lindy
   - New: `https://your-app.vercel.app/api/webhooks/vapi`
   - Update in: VAPI dashboard

2. **OpenPhone SMS Webhook:**
   - Old: Points to Lindy
   - New: `https://your-app.vercel.app/api/webhooks/sms`
   - Update in: OpenPhone dashboard

3. **Stripe Webhook:**
   - Old: Points to Lindy
   - New: `https://your-app.vercel.app/api/webhooks/stripe`
   - Update in: Stripe dashboard

### Phase 4: Lindy Bot Updates (Transition Period)

During transition, update Lindy bots to call your new API instead of Google Sheets:

**Example: Booking Bot**
```
Instead of: "Add row to Google Sheets"
Use: HTTP POST to https://your-app.vercel.app/api/data/jobs
Body: { customer_id, title, date, cleaning_type, ... }
```

**Example: Cleaner Assignment**
```
Instead of: "Update Google Sheets row"
Use: HTTP POST to https://your-app.vercel.app/api/data/jobs/update
Body: { jobId, cleaning_team: ["Maria", "Carlos"] }
```

**Example: Get Available Cleaners**
```
Instead of: "Read from Google Sheets"
Use: HTTP GET https://your-app.vercel.app/api/data/cleaners?startDate=2026-01-20&endDate=2026-01-20
Parse JSON response for available cleaners
```

### Phase 5: Data Migration (If Needed)

If you have existing data in Google Sheets that needs to be imported:

1. Export Google Sheets to CSV
2. Use a migration script or import directly into Supabase:
   ```sql
   -- Import customers
   COPY customers (name, phone_number, address, city, zip_code, ...)
   FROM '/path/to/customers.csv'
   DELIMITER ','
   CSV HEADER;

   -- Import jobs
   COPY jobs (customer_id, title, date, status, ...)
   FROM '/path/to/jobs.csv'
   DELIMITER ','
   CSV HEADER;
   ```

### Phase 6: Testing

Test each endpoint:

```bash
# Test customer retrieval
curl "https://your-app.vercel.app/api/data/customers?limit=5"

# Test job creation
curl -X POST "https://your-app.vercel.app/api/data/jobs" \
  -H "Content-Type: application/json" \
  -d '{"customer_id": 1, "title": "Test Cleaning", "date": "2026-01-20"}'

# Test cleaner availability
curl "https://your-app.vercel.app/api/data/cleaners"
```

### Phase 7: Go Live

1. Switch all webhook URLs to your Vercel app
2. Update Lindy bots to use new API endpoints
3. Monitor automation logs in Supabase:
   ```sql
   SELECT * FROM automation_logs
   ORDER BY created_at DESC
   LIMIT 50;
   ```

4. Once stable, gradually remove Lindy bots one by one

---

## Key Differences from Lindy System

| Feature | Old (Lindy + Sheets) | New (Code + Supabase) |
|---------|---------------------|----------------------|
| Data Storage | Google Sheets | Supabase PostgreSQL |
| Webhooks | Point to Lindy | Point to your Vercel app |
| Logic | Lindy workflows | Your code |
| Customer context | Limited | Full history (jobs, calls, messages) |
| AI responses | Lindy AI | Your AI integration |
| Notifications | Lindy sends | Your code sends via OpenPhone/Telegram |
| Change tracking | Google Sheets onChange | Database triggers + webhooks |
| Query flexibility | Limited to Sheets | Full SQL + REST API |

---

## Monitoring & Debugging

### Check Automation Logs
```sql
-- Recent events
SELECT event_type, source, success, created_at, payload
FROM automation_logs
ORDER BY created_at DESC
LIMIT 100;

-- Failed events
SELECT *
FROM automation_logs
WHERE success = false
ORDER BY created_at DESC;
```

### Check Job Changes
```sql
-- Recent job changes
SELECT job_id, payload->>'changedFields' as changed, created_at
FROM automation_logs
WHERE event_type = 'job_changed'
ORDER BY created_at DESC;
```

### API Testing
All endpoints support GET requests for health checks:
```bash
curl https://your-app.vercel.app/api/webhooks/vapi
# Returns: {"status":"ok","service":"vapi-webhook"}
```

---

## Support & Troubleshooting

### Common Issues

**Issue:** Webhook not receiving data
- Check webhook URL is correct in external service
- Verify Supabase credentials are set in Vercel
- Check Vercel logs: `vercel logs`

**Issue:** Customer not found
- Ensure phone numbers are normalized (+1 format)
- Check customer was created via POST /api/data/customers first

**Issue:** Job update not triggering notifications
- Verify OpenPhone integration credentials
- Check automation_logs for errors
- Ensure job has customer with phone_number

---

## Next Steps

1. Deploy the updated code to Vercel
2. Run the updated schema.sql in Supabase
3. Test each endpoint using the examples above
4. Update webhook URLs one by one
5. Monitor automation_logs to ensure everything works
6. Gradually phase out Lindy bots

Your system is now fully code-based and hosted on Vercel with Supabase! 🎉
