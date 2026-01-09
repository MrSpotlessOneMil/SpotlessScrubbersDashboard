#!/bin/bash
# API Testing Script for Spotless Dashboard
# Usage: ./test-api.sh https://your-app.vercel.app

BASE_URL="${1:-http://localhost:3000}"

echo "🧪 Testing Spotless Dashboard API"
echo "Base URL: $BASE_URL"
echo ""

# Colors for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

test_endpoint() {
  local name=$1
  local method=$2
  local endpoint=$3
  local data=$4

  echo -n "Testing $name... "

  if [ "$method" = "GET" ]; then
    response=$(curl -s -w "\n%{http_code}" "$BASE_URL$endpoint")
  else
    response=$(curl -s -w "\n%{http_code}" -X "$method" "$BASE_URL$endpoint" \
      -H "Content-Type: application/json" \
      -d "$data")
  fi

  http_code=$(echo "$response" | tail -n1)
  body=$(echo "$response" | head -n-1)

  if [ "$http_code" -ge 200 ] && [ "$http_code" -lt 300 ]; then
    echo -e "${GREEN}✓ PASS${NC} (HTTP $http_code)"
    echo "  Response: $(echo $body | jq -c '.' 2>/dev/null || echo $body | head -c 100)"
  else
    echo -e "${RED}✗ FAIL${NC} (HTTP $http_code)"
    echo "  Response: $body"
  fi
  echo ""
}

echo "=== Health Checks ==="
test_endpoint "VAPI Webhook" "GET" "/api/webhooks/vapi"
test_endpoint "SMS Webhook" "GET" "/api/webhooks/sms"
test_endpoint "Stripe Webhook" "GET" "/api/webhooks/stripe"
test_endpoint "Job Change Webhook" "GET" "/api/webhooks/job-change"
echo ""

echo "=== Data Retrieval Endpoints ==="
test_endpoint "Get Cleaners" "GET" "/api/data/cleaners"
test_endpoint "Get Jobs" "GET" "/api/data/jobs?limit=5"
test_endpoint "Get Customers" "GET" "/api/data/customers?limit=5"
test_endpoint "Get Jobs Needing Assignment" "GET" "/api/data/jobs?needsAssignment=true&limit=5"
echo ""

echo "=== Data Creation (requires valid data) ==="
echo -e "${YELLOW}Note: These tests may fail if data doesn't exist${NC}"

# Test customer creation (will likely fail without proper data)
test_endpoint "Create Customer" "POST" "/api/data/customers" \
  '{"phone_number":"+15551234567","name":"Test Customer"}'

# Test job update (will fail if job ID doesn't exist)
test_endpoint "Update Job" "POST" "/api/data/jobs/update" \
  '{"jobId":1,"notes":"Test update from script"}'

echo ""
echo "=== Summary ==="
echo "All basic endpoints have been tested."
echo "✓ Green = Working"
echo "✗ Red = Failed (may need configuration or data)"
echo ""
echo "Next steps:"
echo "1. Ensure Supabase credentials are set in Vercel"
echo "2. Run schema.sql in Supabase SQL Editor"
echo "3. Add real customer/job data for full testing"
echo "4. Update webhook URLs in VAPI, OpenPhone, Stripe"
