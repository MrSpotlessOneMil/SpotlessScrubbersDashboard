# API Endpoints Quick Reference

## Data Retrieval (GET)

### Cleaners
```
GET /api/data/cleaners
GET /api/data/cleaners?startDate=2026-01-15&endDate=2026-01-31
```
Returns: All cleaners with availability

### Jobs
```
GET /api/data/jobs
GET /api/data/jobs?needsAssignment=true
GET /api/data/jobs?date=2026-01-20&status=confirmed
GET /api/data/jobs?startDate=2026-01-15&endDate=2026-01-31
```
Returns: Jobs with filtering

### Customers
```
GET /api/data/customers
GET /api/data/customers?id=45
GET /api/data/customers?phone=%2B15559876543
GET /api/data/customers?includeStats=true
```
Returns: Customer data with full context

---

## Data Creation/Updates (POST)

### Create/Update Customer
```
POST /api/data/customers
Body: { phone_number, name, email, address, ... }
```

### Create Job
```
POST /api/data/jobs
Body: { customer_id, title, date, cleaning_type, ... }
```

### Update Job
```
POST /api/data/jobs/update
Body: { jobId, status, cleaning_team, paid, ... }
```

### Create Cleaner
```
POST /api/data/cleaners
Body: { name, phone, telegram_id, skills, ... }
```

---

## Webhooks (Incoming)

### VAPI Call Completion
```
POST /api/webhooks/vapi
```
Receives: VAPI end-of-call report
Actions: Creates customer, logs call, sends booking/quote

### SMS Message
```
POST /api/webhooks/sms
```
Receives: OpenPhone incoming message
Actions: AI response, booking processing, quote generation

### Stripe Payment
```
POST /api/webhooks/stripe
```
Receives: Stripe payment events
Actions: Marks job paid, sends confirmation

### Job Changes
```
POST /api/webhooks/job-change
```
Receives: Job update notifications
Actions: Notifies customers and cleaners

---

## URL Structure

**Base URL:** `https://your-app.vercel.app`

- `/api/data/*` - Data retrieval and manipulation
- `/api/webhooks/*` - Incoming webhook handlers

---

## Quick Test Commands

```bash
# Test deployment
curl https://your-app.vercel.app/api/webhooks/vapi

# Get all cleaners
curl https://your-app.vercel.app/api/data/cleaners

# Get jobs needing assignment
curl "https://your-app.vercel.app/api/data/jobs?needsAssignment=true"

# Get customer with full history
curl "https://your-app.vercel.app/api/data/customers?phone=%2B15551234567"

# Create a job
curl -X POST https://your-app.vercel.app/api/data/jobs \
  -H "Content-Type: application/json" \
  -d '{"customer_id":1,"title":"Test Clean","date":"2026-01-20"}'

# Update a job
curl -X POST https://your-app.vercel.app/api/data/jobs/update \
  -H "Content-Type: application/json" \
  -d '{"jobId":123,"status":"confirmed","cleaning_team":["Maria"]}'
```
