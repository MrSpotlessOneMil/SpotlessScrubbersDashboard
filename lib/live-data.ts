import { Pool } from 'pg';
import { DashboardData, Job, Call, CallerProfile } from './google-sheets';

// Connection pool - only created if DATABASE_URL exists
let pool: Pool | null = null;

function getPool(): Pool | null {

  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });
  } else {
  }

  return pool;
}

export async function getLiveDashboardData(): Promise<DashboardData | null> {
  const db = getPool();
  if (!db) {
    return null;
  }

  try {
    // Fetch jobs with customer info
    const jobsResult = await db.query(`
      SELECT j.*, c.phone_number, c.name as client_name
      FROM jobs j
      JOIN customers c ON j.customer_id = c.id
      ORDER BY j.date DESC
    `);

    // Fetch calls with audio URLs
    const callsResult = await db.query(`
      SELECT cl.*, c.phone_number, c.name as caller_name
      FROM calls cl
      JOIN customers c ON cl.customer_id = c.id
      ORDER BY cl.date DESC
    `);

    // Fetch messages grouped by customer
    const messagesResult = await db.query(`
      SELECT m.*, c.phone_number, c.name as caller_name
      FROM messages m
      JOIN customers c ON m.customer_id = c.id
      ORDER BY m.timestamp ASC
    `);

    // Transform jobs to app format
    const jobs: Job[] = jobsResult.rows.map(row => {
      const dateValue = row.scheduled_at ?? row.date;
      const dateString = dateValue instanceof Date ? dateValue.toISOString() : String(dateValue);
      const createdValue = row.created_at;
      const createdAt = createdValue instanceof Date ? createdValue.toISOString() : createdValue ? String(createdValue) : undefined;
      const scheduledValue = row.scheduled_at;
      const scheduledAt = scheduledValue instanceof Date ? scheduledValue.toISOString() : scheduledValue ? String(scheduledValue) : undefined;

      return {
        id: row.id.toString(),
        title: row.title,
        date: dateString,
        status: row.status,
        client: row.client_name,
        cleaningTeam: row.cleaning_team || [],
        callDurationSeconds: 0,
        booked: row.booked,
        paid: row.paid,
        price: parseFloat(row.price) || 0,
        phoneNumber: row.phone_number,
        hours: row.hours ? parseFloat(row.hours) : undefined,
        createdAt,
        scheduledAt
      };
    });

    // Transform calls to app format
    const calls: Call[] = callsResult.rows.map(row => ({
      id: row.id.toString(),
      phoneNumber: row.phone_number,
      callerName: row.caller_name,
      date: row.date,
      durationSeconds: row.duration_seconds || 0,
      audioUrl: row.audio_url,
      transcript: row.transcript,
      outcome: row.outcome
    }));

    // Build caller profiles from calls and messages
    const profileMap = new Map<string, CallerProfile>();

    for (const call of calls) {
      if (!profileMap.has(call.phoneNumber)) {
        profileMap.set(call.phoneNumber, {
          phoneNumber: call.phoneNumber,
          callerName: call.callerName,
          totalCalls: 0,
          messages: [],
          lastCallDate: call.date,
          calls: []
        });
      }
      const profile = profileMap.get(call.phoneNumber)!;
      profile.totalCalls++;
      profile.calls!.push(call);
      if (new Date(call.date) > new Date(profile.lastCallDate)) {
        profile.lastCallDate = call.date;
      }
    }

    // Add messages to profiles
    for (const msg of messagesResult.rows) {
      const profile = profileMap.get(msg.phone_number);
      if (profile) {
        profile.messages.push({
          role: msg.role as 'client' | 'business' | 'bot',
          content: msg.content,
          timestamp: msg.timestamp
        });
      }
    }

    const profiles = Array.from(profileMap.values());

    // Calculate metrics (never show negatives)
    const jobsBooked = jobs.filter(j => j.booked).length;
    const callsAnswered = calls.length;


    return {
      jobsBooked,
      quotesSent: jobs.filter(j => j.booked).length,
      cleanersScheduled: jobs.filter(j => j.paid).length,
      callsAnswered,
      jobs,
      calls,
      profiles,
      isLiveData: true
    };
  } catch (error) {
    console.error('Live data fetch error:', error);
    return null;
  }
}

export async function getLiveSettings(): Promise<{ spreadsheetId: string; hourlyRate: number; costPerJob: number } | null> {
  const db = getPool();
  if (!db) {
    return null;
  }

  try {
    const result = await db.query('SELECT * FROM settings LIMIT 1');
    if (result.rows[0]) {
      return {
        spreadsheetId: result.rows[0].spreadsheet_id || '',
        hourlyRate: parseFloat(result.rows[0].hourly_rate) || 25,
        costPerJob: parseFloat(result.rows[0].cost_per_job) || 50
      };
    }
    return null;
  } catch (error) {
    console.error('Settings fetch error:', error);
    return null;
  }
}

export async function saveLiveSettings(settings: { spreadsheetId: string; hourlyRate: number; costPerJob: number }): Promise<boolean> {
  const db = getPool();
  if (!db) {
    return false;
  }

  try {
    await db.query(`
      INSERT INTO settings (id, spreadsheet_id, hourly_rate, cost_per_job)
      VALUES (1, $1, $2, $3)
      ON CONFLICT (id) DO UPDATE SET
        spreadsheet_id = $1,
        hourly_rate = $2,
        cost_per_job = $3,
        updated_at = NOW()
    `, [settings.spreadsheetId, settings.hourlyRate, settings.costPerJob]);
    return true;
  } catch (error) {
    console.error('Settings save error:', error);
    return false;
  }
}

export { pool };

