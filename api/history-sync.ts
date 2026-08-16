import { createHash } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

interface VercelRequest {
  method?: string;
  headers: Record<string, string | string[] | undefined>;
  body?: unknown;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): unknown;
  end(): unknown;
}

const MAX_PAYLOAD_BYTES = 3_750_000;
const MAX_SESSIONS = 2_000;

type JsonObject = Record<string, unknown>;

interface HistorySyncBody {
  profileId?: unknown;
  history?: unknown;
  workoutSummary?: unknown;
  sourceUpdatedAt?: unknown;
}

let sqlClient: NeonQueryFunction<false, false> | null = null;
let schemaPromise: Promise<void> | null = null;

function getConnectionString(): string | undefined {
  return (
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL
  );
}

function getSql(): NeonQueryFunction<false, false> {
  if (sqlClient) return sqlClient;

  const connectionString = getConnectionString();
  if (!connectionString) {
    throw new Error('Circuit database is not configured');
  }

  sqlClient = neon(connectionString);
  return sqlClient;
}

function ensureSchema(sql: NeonQueryFunction<false, false>): Promise<void> {
  if (!schemaPromise) {
    schemaPromise = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS circuit_history_snapshots (
          owner_hash TEXT PRIMARY KEY,
          session_count INTEGER NOT NULL,
          history JSONB NOT NULL,
          workout_summary JSONB,
          source_updated_at TIMESTAMPTZ NOT NULL,
          server_updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;

      await sql`
        CREATE OR REPLACE VIEW circuit_workout_sessions AS
        SELECT
          snapshot.owner_hash,
          session.value ->> 'id' AS session_id,
          session.value ->> 'status' AS status,
          session.value -> 'workout' ->> 'name' AS workout_name,
          COALESCE(
            session.value ->> 'completedAt',
            session.value ->> 'stoppedAt',
            session.value ->> 'startedAt',
            session.value -> 'workout' ->> 'createdAt'
          )::TIMESTAMPTZ AS workout_at,
          NULLIF(session.value ->> 'actualDurationWorked', '')::INTEGER AS duration_seconds,
          NULLIF(session.value -> 'feedback' ->> 'rpe', '')::SMALLINT AS rpe,
          session.value -> 'feedback' ->> 'notes' AS notes,
          session.value AS session,
          snapshot.server_updated_at
        FROM circuit_history_snapshots AS snapshot
        CROSS JOIN LATERAL jsonb_array_elements(snapshot.history -> 'sessions') AS session(value)
      `;
    })().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }

  return schemaPromise;
}

function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin) return true;

  try {
    const { hostname, protocol } = new URL(origin);
    if (protocol !== 'https:' && hostname !== 'localhost' && hostname !== '127.0.0.1') {
      return false;
    }

    return (
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === 'circuit-five.vercel.app' ||
      hostname === 'circuit-smcronins-projects.vercel.app' ||
      (/^circuit-[a-z0-9-]+-smcronins-projects\.vercel\.app$/i.test(hostname))
    );
  } catch {
    return false;
  }
}

function setCorsHeaders(req: VercelRequest, res: VercelResponse): boolean {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : undefined;
  if (!isAllowedOrigin(origin)) return false;

  if (origin) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-store');
  return true;
}

function parseBody(req: VercelRequest): HistorySyncBody {
  if (typeof req.body === 'string') {
    return JSON.parse(req.body) as HistorySyncBody;
  }
  return (req.body || {}) as HistorySyncBody;
}

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (!setCorsHeaders(req, res)) {
    return res.status(403).json({ ok: false, error: 'Origin not allowed' });
  }

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method === 'GET') {
    if (!getConnectionString()) {
      return res.status(503).json({
        ok: false,
        databaseConfigured: false,
        error: 'Circuit database is not configured',
      });
    }

    try {
      await ensureSchema(getSql());
      return res.status(200).json({ ok: true, databaseConfigured: true, schemaReady: true });
    } catch (error) {
      console.error('Circuit history schema check failed', error);
      return res.status(503).json({
        ok: false,
        databaseConfigured: true,
        schemaReady: false,
        error: 'Circuit database is unavailable',
      });
    }
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', 'GET,POST,OPTIONS');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  try {
    const body = parseBody(req);
    const profileId = typeof body.profileId === 'string' ? body.profileId.trim() : '';
    if (profileId.length < 10 || profileId.length > 200) {
      return res.status(400).json({ ok: false, error: 'Invalid profile identifier' });
    }

    if (!isJsonObject(body.history) || !Array.isArray(body.history.sessions)) {
      return res.status(400).json({ ok: false, error: 'Invalid workout history' });
    }

    if (body.history.sessions.length > MAX_SESSIONS) {
      return res.status(413).json({ ok: false, error: 'Workout history is too large' });
    }

    const sourceUpdatedAt =
      typeof body.sourceUpdatedAt === 'string' && !Number.isNaN(Date.parse(body.sourceUpdatedAt))
        ? body.sourceUpdatedAt
        : new Date().toISOString();
    const historyJson = JSON.stringify(body.history);
    const summaryJson = body.workoutSummary == null ? null : JSON.stringify(body.workoutSummary);

    if (Buffer.byteLength(historyJson, 'utf8') > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ ok: false, error: 'Workout history is too large to sync' });
    }

    const ownerHash = createHash('sha256').update(profileId).digest('hex');
    const sql = getSql();
    await ensureSchema(sql);

    await sql`
      INSERT INTO circuit_history_snapshots (
        owner_hash,
        session_count,
        history,
        workout_summary,
        source_updated_at,
        server_updated_at
      ) VALUES (
        ${ownerHash},
        ${body.history.sessions.length},
        ${historyJson}::JSONB,
        ${summaryJson}::JSONB,
        ${sourceUpdatedAt}::TIMESTAMPTZ,
        NOW()
      )
      ON CONFLICT (owner_hash) DO UPDATE SET
        session_count = EXCLUDED.session_count,
        history = EXCLUDED.history,
        workout_summary = EXCLUDED.workout_summary,
        source_updated_at = EXCLUDED.source_updated_at,
        server_updated_at = NOW()
    `;

    return res.status(200).json({
      ok: true,
      syncedSessions: body.history.sessions.length,
      syncedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Circuit history sync failed', error);
    return res.status(503).json({ ok: false, error: 'Workout history sync failed' });
  }
}
