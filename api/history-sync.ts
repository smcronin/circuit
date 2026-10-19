import { createHash } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { historyFromSessions, mergeHistory, stableJson, type HistoryData } from '../src/utils/historyMerge';
import type { WorkoutHistory, WorkoutSession } from '../src/types/workout';
import type { SummarizedWorkoutHistory } from '../src/types/llm';

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
  protocolVersion?: unknown;
  deletedSessions?: unknown;
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
        ALTER TABLE circuit_history_snapshots
          ADD COLUMN IF NOT EXISTS revision INTEGER NOT NULL DEFAULT 0,
          ADD COLUMN IF NOT EXISTS deleted_sessions JSONB NOT NULL DEFAULT '{}'::JSONB
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS circuit_workout_versions (
          owner_hash TEXT NOT NULL,
          session_id TEXT NOT NULL,
          content_hash TEXT NOT NULL,
          session JSONB NOT NULL,
          first_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (owner_hash, session_id, content_hash)
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS circuit_history_sync_events (
          owner_hash TEXT NOT NULL,
          revision INTEGER NOT NULL,
          received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          incoming_count INTEGER NOT NULL,
          session_versions JSONB NOT NULL,
          history_metadata JSONB NOT NULL,
          PRIMARY KEY (owner_hash, revision)
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

    if (body.history.sessions.some(session => !isJsonObject(session) || typeof session.id !== 'string' || !session.id || session.id.length > 200 || !isJsonObject(session.workout))) {
      return res.status(400).json({ ok: false, error: 'Invalid workout session' });
    }
    const deletedSessions = body.protocolVersion === 2 && isJsonObject(body.deletedSessions) ? body.deletedSessions : {};
    if (Object.entries(deletedSessions).some(([id, at]) => !id || id.length > 200 || typeof at !== 'string' || !Number.isFinite(Date.parse(at)))) {
      return res.status(400).json({ ok: false, error: 'Invalid workout deletion' });
    }

    const sourceUpdatedAt =
      typeof body.sourceUpdatedAt === 'string' && !Number.isNaN(Date.parse(body.sourceUpdatedAt))
        ? body.sourceUpdatedAt
        : new Date().toISOString();
    const historyJson = JSON.stringify(body.history);

    if (Buffer.byteLength(historyJson, 'utf8') > MAX_PAYLOAD_BYTES) {
      return res.status(413).json({ ok: false, error: 'Workout history is too large to sync' });
    }

    const ownerHash = createHash('sha256').update(profileId).digest('hex');
    const sql = getSql();
    await ensureSchema(sql);

    const incoming: HistoryData = {
      history: body.history as unknown as WorkoutHistory,
      workoutSummary: body.workoutSummary as SummarizedWorkoutHistory | undefined,
      deletedSessions: deletedSessions as Record<string, string>,
    };
    // Missing IDs are never deletions, including uploads from older app builds.
    await sql`INSERT INTO circuit_history_snapshots (owner_hash, session_count, history, source_updated_at)
      VALUES (${ownerHash}, 0, ${JSON.stringify(historyFromSessions([]))}::JSONB, ${sourceUpdatedAt}::TIMESTAMPTZ)
      ON CONFLICT (owner_hash) DO NOTHING`;
    for (let attempt = 0; attempt < 6; attempt++) {
      const [row] = await sql`SELECT history, workout_summary, deleted_sessions, revision, source_updated_at, server_updated_at FROM circuit_history_snapshots WHERE owner_hash = ${ownerHash}`;
      const previous: HistoryData = { history: row.history, workoutSummary: row.workout_summary || undefined, deletedSessions: row.deleted_sessions };
      const merged = mergeHistory(previous, incoming);
      const changed = stableJson(previous) !== stableJson(merged);
      const nextRevision = row.revision + 1;
      const reply = (revision: number) => res.status(200).json({
        ok: true, syncedSessions: merged.history.sessions.length, syncedAt: new Date().toISOString(), revision,
        ...(body.protocolVersion === 2 ? { ...merged, protocolVersion: 2 } : {}),
      });
      if (!changed && row.revision > 0) return reply(row.revision);
      const fingerprint = (session: WorkoutSession) => createHash('sha256').update(stableJson(session)).digest('hex');
      const previousHashes = new Set(previous.history.sessions.map(fingerprint));
      const versions = [...(row.revision === 0 ? previous.history.sessions : []), ...incoming.history.sessions, ...merged.history.sessions]
        .filter(session => row.revision === 0 || !previousHashes.has(fingerprint(session)))
        .map(session => ({ session_id: session.id, content_hash: fingerprint(session), session }));
      const manifest = merged.history.sessions.map(session => ({ id: session.id, hash: fingerprint(session) }));
      const { sessions: _sessions, ...totals } = merged.history;
      const metadata = { ...totals, workoutSummary: merged.workoutSummary, deletedSessions: merged.deletedSessions };
      const { sessions: _previousSessions, ...previousTotals } = previous.history;
      // Compare-and-swap prevents concurrent phones/tabs from dropping each other's
      // changes. Versions and the reconstructable manifest commit with the snapshot.
      const [updated] = await sql.transaction([
        sql`UPDATE circuit_history_snapshots SET history = ${JSON.stringify(merged.history)}::JSONB,
          session_count = ${merged.history.sessions.length}, workout_summary = ${JSON.stringify(merged.workoutSummary || null)}::JSONB,
          deleted_sessions = ${JSON.stringify(merged.deletedSessions)}::JSONB, revision = ${nextRevision},
          source_updated_at = ${sourceUpdatedAt}::TIMESTAMPTZ, server_updated_at = NOW()
          WHERE owner_hash = ${ownerHash} AND revision = ${row.revision} RETURNING revision`,
        sql`INSERT INTO circuit_workout_versions (owner_hash, session_id, content_hash, session)
          SELECT ${ownerHash}, v.session_id, v.content_hash, v.session
          FROM jsonb_to_recordset(${JSON.stringify(versions)}::JSONB) AS v(session_id TEXT, content_hash TEXT, session JSONB)
          WHERE EXISTS (SELECT 1 FROM circuit_history_snapshots WHERE owner_hash = ${ownerHash} AND revision = ${nextRevision})
          ON CONFLICT DO NOTHING`,
        sql`INSERT INTO circuit_history_sync_events (owner_hash, revision, incoming_count, session_versions, history_metadata)
          SELECT ${ownerHash}, ${nextRevision}, ${incoming.history.sessions.length}, ${JSON.stringify(manifest)}::JSONB, ${JSON.stringify(metadata)}::JSONB
          WHERE EXISTS (SELECT 1 FROM circuit_history_snapshots WHERE owner_hash = ${ownerHash} AND revision = ${nextRevision})
          ON CONFLICT DO NOTHING`,
        ...(row.revision === 0 ? [sql`INSERT INTO circuit_history_sync_events (owner_hash, revision, incoming_count, session_versions, history_metadata)
          VALUES (${ownerHash}, 0, ${previous.history.sessions.length}, ${JSON.stringify(previous.history.sessions.map(session => ({ id: session.id, hash: fingerprint(session) })))}::JSONB,
          ${JSON.stringify({ ...previousTotals, workoutSummary: previous.workoutSummary, deletedSessions: previous.deletedSessions, sourceUpdatedAt: row.source_updated_at, serverUpdatedAt: row.server_updated_at })}::JSONB)
          ON CONFLICT DO NOTHING`] : []),
      ]);
      if (updated.length) {
        console.info('Circuit history saved', { owner: ownerHash.slice(0, 12), revision: nextRevision, incoming: incoming.history.sessions.length, stored: merged.history.sessions.length, deleted: Object.keys(merged.deletedSessions || {}).length });
        return reply(nextRevision);
      }
    }
    return res.status(409).json({ ok: false, error: 'History changed during sync. Please retry.' });
  } catch (error) {
    console.error('Circuit history sync failed', error);
    return res.status(503).json({ ok: false, error: 'Workout history sync failed' });
  }
}
