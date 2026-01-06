import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";

let pool: Pool | null = null;

function getPool() {
  if (!process.env.DATABASE_URL) {
    return null;
  }

  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false
    });
  }

  return pool;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const db = getPool();
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  const { id } = await params;
  const body = await request.json();
  const date = String(body.date || "").trim();
  const startTime = String(body.startTime || "").trim();
  const reason = String(body.reason || "").trim();
  const notifyClient = Boolean(body.notifyClient);
  const notifyMessage = String(body.notifyMessage || "").trim();
  const hours =
    body.hours === undefined || body.hours === null
      ? undefined
      : Number(body.hours);
  const cleaningTeam = Array.isArray(body.cleaningTeam)
    ? (body.cleaningTeam as unknown[])
        .filter((member): member is string => typeof member === "string")
        .map((member) => member.trim())
        .filter(Boolean)
    : undefined;

  if (!date) {
    return NextResponse.json({ error: "Missing date" }, { status: 400 });
  }

  try {
    let hasScheduledAt = false;
    try {
      const columnResult = await db.query(
        "SELECT column_name FROM information_schema.columns WHERE table_name = 'jobs' AND column_name = 'scheduled_at'"
      );
      const columnCount = columnResult.rowCount ?? 0;
      hasScheduledAt = columnCount > 0;
      if (!hasScheduledAt) {
        await db.query("ALTER TABLE jobs ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMP");
        hasScheduledAt = true;
      }
    } catch (error) {
      console.error("Scheduled_at check error:", error);
    }

    const updates: string[] = [];
    const values: Array<string | number | string[] | null> = [];
    let index = 1;

    updates.push(`date = $${index++}`);
    values.push(date);

    if (hasScheduledAt && startTime) {
      updates.push(`scheduled_at = $${index++}`);
      values.push(`${date}T${startTime}:00`);
    }

    if (Number.isFinite(hours)) {
      updates.push(`hours = $${index++}`);
      values.push(hours as number);
    }

    if (cleaningTeam) {
      updates.push(`cleaning_team = $${index++}`);
      values.push(cleaningTeam);
    }

    values.push(id);

    const updateResult = await db.query(
      `UPDATE jobs SET ${updates.join(", ")} WHERE id = $${index} RETURNING id, customer_id, date`,
      values
    );

    if (!updateResult.rows[0]) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    const timeLabel = startTime ? ` at ${startTime}` : "";
    const fallbackMessage = reason
      ? `Job rescheduled to ${date}${timeLabel}. Reason: ${reason}`
      : `Job rescheduled to ${date}${timeLabel}.`;
    const messageContent = notifyClient
      ? notifyMessage || fallbackMessage
      : reason
      ? fallbackMessage
      : "";

    if (messageContent && updateResult.rows[0].customer_id) {
      await db.query(
        "INSERT INTO messages (customer_id, role, content, timestamp, message_type) VALUES ($1, $2, $3, NOW(), $4)",
        [
          updateResult.rows[0].customer_id,
          "business",
          messageContent,
          "text"
        ]
      );
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Reschedule error:", error);
    return NextResponse.json(
      { error: "Failed to reschedule job" },
      { status: 500 }
    );
  }
}
