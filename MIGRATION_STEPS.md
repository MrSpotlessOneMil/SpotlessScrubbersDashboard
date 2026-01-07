# Supabase Migration - Step by Step

## Step 1: Export Google Sheets Data

1. Open your Google Sheet: https://docs.google.com/spreadsheets/d/15b_r7w7IN4SumxEYWy8P4-_vbj9czaPWQquOxJKul0I
2. Click **File** → **Download** → **Comma Separated Values (.csv)**
3. This will download the "Jobs" tab
4. Save it as `jobs-export.csv` in your Downloads folder

## Step 2: Send Me the CSV

Once you have the `jobs-export.csv` file, I'll:
1. Parse it locally
2. Convert "TRUE"/"No" to proper booleans
3. Generate SQL INSERT statements
4. Give you the SQL to paste into Supabase

## Step 3: Import to Supabase (After I generate SQL)

1. Go to Supabase → **SQL Editor**
2. Create **New query**
3. Paste the SQL I generate
4. Click **Run**
5. Verify data appears in **Table Editor** → **customers** and **jobs** tables

## Step 4: Test Dashboard

1. Go to your dashboard: https://spotless-scrubbers-dashboard.vercel.app
2. It should now show **"Live System"** instead of "Demo Mode"
3. Revenue should show correct numbers (only paid jobs counted)
4. Jobs should appear on calendar

## Step 5: Update Lindy Workflows (We'll do together)

Once the dashboard is working with live data, I'll provide you with HTTP Request configurations for each of your 8 Lindy workflows to use Supabase REST API instead of Google Sheets.

---

## Quick Alternative: Manual Entry

If you only have a few jobs, you can also manually add them in Supabase:

1. Supabase → **Table Editor** → **customers**
2. Click **Insert row**
3. Fill in: phone_number, name, email
4. Repeat for each customer

Then:
1. Supabase → **Table Editor** → **jobs**
2. Click **Insert row**
3. Fill in: customer_id (from customers table), title, date, booked (checkbox), paid (checkbox), price
4. Repeat for each job

But the CSV export method is much faster for bulk data!
