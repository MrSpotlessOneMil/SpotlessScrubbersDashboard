import { NextResponse } from "next/server";
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
  request: Request,
  { params }: { params: { id: string } }
) {
  const db = getPool();
  if (!db) {
    return NextResponse.json(
      { error: "Database not configured" },
      { status: 500 }
    );
  }

  const body = await request.json();
  const date = String(body.date || "").trim();
  const reason = String(body.reason || "").trim();

  if (!date) {
    return NextResponse.json({ error: "Missing date" }, { status: 400 });
  }

  try {
    const updateResult = await db.query(
      "UPDATE jobs SET date = $1 WHERE id = $2 RETURNING id, customer_id, date",
      [date, params.id]
    );

    if (!updateResult.rows[0]) {
      return NextResponse.json({ error: "Job not found" }, { status: 404 });
    }

    if (reason && updateResult.rows[0].customer_id) {
      await db.query(
        "INSERT INTO messages (customer_id, role, content, timestamp, message_type) VALUES ($1, $2, $3, NOW(), $4)",
        [
          updateResult.rows[0].customer_id,
          "business",
          `Job rescheduled to ${date}. Reason: ${reason}`,
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
