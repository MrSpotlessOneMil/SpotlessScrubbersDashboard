/**
 * Google Sheets to Supabase Migration Script
 *
 * Run with: node scripts/migrate-to-supabase.js
 */

const { google } = require('googleapis');

const SPREADSHEET_ID = '15b_r7w7IN4SumxEYWy8P4-_vbj9czaPWQquOxJKul0I';
const JOBS_SHEET_NAME = 'Jobs';

function parseBoolean(value) {
  if (!value) return false;
  const normalized = value.toString().toUpperCase().trim();
  return normalized === 'TRUE' || normalized === 'YES' || normalized === '1';
}

function parsePrice(value) {
  if (!value) return null;
  const cleaned = value.toString().replace(/[$,]/g, '').trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

function cleanPhoneNumber(value) {
  if (!value) return '';
  return value.toString().replace(/\D/g, '');
}

function parseDate(value) {
  if (!value) return null;
  try {
    const date = new Date(value.toString());
    if (isNaN(date.getTime())) return null;
    return date.toISOString().split('T')[0];
  } catch {
    return null;
  }
}

function escapeSql(value) {
  if (!value) return 'NULL';
  return `'${value.toString().replace(/'/g, "''")}'`;
}

async function migrateData() {
  console.log('🚀 Starting Google Sheets → Supabase Migration\n');

  const auth = new google.auth.GoogleAuth({
    credentials: {
      client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    },
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
  });

  const sheets = google.sheets({ version: 'v4', auth });

  try {
    console.log('📊 Fetching data from Google Sheets...');
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${JOBS_SHEET_NAME}!A:R`,
    });

    const rows = response.data.values;
    if (!rows || rows.length === 0) {
      console.log('❌ No data found in Google Sheets');
      return;
    }

    const headers = rows[0];
    const dataRows = rows.slice(1);

    console.log(`✅ Found ${dataRows.length} rows\n`);

    const colIndices = {
      phoneNumber: headers.indexOf('Phone Number'),
      frequency: headers.indexOf('Frequency'),
      dateAndTime: headers.indexOf('Date And Time (YYYY-MM-DD XX:XX AM/PM)'),
      cleaningTeam: headers.indexOf('Cleaning Team'),
      serviceType: headers.indexOf('Service Type'),
      notesForCleaners: headers.indexOf('Notes For Cleaners'),
      address: headers.indexOf('Address'),
      bedrooms: headers.indexOf('Bedrooms'),
      bathrooms: headers.indexOf('Bathrooms'),
      squareFootage: headers.indexOf('Square Footage'),
      firstName: headers.indexOf('First Name'),
      lastName: headers.indexOf('Last Name'),
      email: headers.indexOf('Email'),
      price: headers.indexOf('Price'),
      duration: headers.indexOf('Duration (hours)'),
      connecteamShiftId: headers.indexOf('connecteamShiftId'),
      booked: headers.indexOf('Booked'),
      paid: headers.indexOf('Paid'),
    };

    const customers = new Map();
    const jobs = [];

    for (const row of dataRows) {
      const phoneNumber = cleanPhoneNumber(row[colIndices.phoneNumber]);
      if (!phoneNumber) continue;

      const firstName = row[colIndices.firstName]?.toString().trim() || '';
      const lastName = row[colIndices.lastName]?.toString().trim() || '';
      const name = `${firstName} ${lastName}`.trim() || 'Unknown';
      const email = row[colIndices.email]?.toString().trim() || null;
      const booked = parseBoolean(row[colIndices.booked]);
      const paid = parseBoolean(row[colIndices.paid]);
      const price = parsePrice(row[colIndices.price]);
      const date = parseDate(row[colIndices.dateAndTime]);

      if (!customers.has(phoneNumber)) {
        customers.set(phoneNumber, { name, email });
      }

      jobs.push({
        phoneNumber,
        title: row[colIndices.serviceType]?.toString().trim() || 'Standard Clean',
        date,
        status: 'scheduled',
        cleaningTeam: row[colIndices.cleaningTeam]?.toString().trim() || null,
        booked,
        paid,
        price,
        hours: parseFloat(row[colIndices.duration]) || null,
      });
    }

    console.log('📝 Generating SQL statements...\n');
    console.log('-- ========================================');
    console.log('-- INSERT CUSTOMERS');
    console.log('-- ========================================\n');

    let customerIndex = 1;
    const phoneToId = new Map();

    for (const [phoneNumber, customer] of customers) {
      phoneToId.set(phoneNumber, customerIndex);
      console.log(
        `INSERT INTO customers (id, phone_number, name, email) VALUES (${customerIndex}, '${phoneNumber}', ${escapeSql(customer.name)}, ${escapeSql(customer.email)});`
      );
      customerIndex++;
    }

    console.log('\n-- ========================================');
    console.log('-- INSERT JOBS');
    console.log('-- ========================================\n');

    for (const job of jobs) {
      const customerId = phoneToId.get(job.phoneNumber);
      if (!customerId) continue;

      const cleaningTeam = job.cleaningTeam
        ? `ARRAY[${escapeSql(job.cleaningTeam)}]`
        : 'NULL';

      console.log(
        `INSERT INTO jobs (customer_id, title, date, status, cleaning_team, booked, paid, price, hours) VALUES (${customerId}, ${escapeSql(job.title)}, ${job.date ? `'${job.date}'` : 'NULL'}, '${job.status}', ${cleaningTeam}, ${job.booked}, ${job.paid}, ${job.price}, ${job.hours});`
      );
    }

    console.log('\n-- ========================================');
    console.log('-- RESET SEQUENCES (IMPORTANT!)');
    console.log('-- ========================================\n');

    console.log(`SELECT setval('customers_id_seq', ${customerIndex});`);
    console.log(`SELECT setval('jobs_id_seq', (SELECT MAX(id) FROM jobs));`);

    console.log('\n✅ Migration SQL generated successfully!');
    console.log('\n📋 Next steps:');
    console.log('1. Copy all the SQL above');
    console.log('2. Go to Supabase → SQL Editor');
    console.log('3. Paste and run the SQL');
    console.log('4. Verify data in Table Editor');
    console.log('5. Redeploy your Vercel app\n');
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  }
}

migrateData().catch((error) => {
  console.error('Migration failed:', error);
  process.exit(1);
});
