import { neon, type NeonQueryFunction } from '@neondatabase/serverless';
import { weightContext, type WeightTracking } from '../src/utils/weightSync';

interface VercelRequest {
  method?: string;
  url?: string;
  headers: Record<string, string | string[] | undefined>;
}

interface VercelResponse {
  setHeader(name: string, value: string): void;
  status(code: number): VercelResponse;
  json(body: unknown): unknown;
}

interface SnapshotRow {
  owner_hash: string;
  session_count: number;
  workout_summary: unknown;
  source_updated_at: string;
  server_updated_at: string;
}

const DEFAULT_SESSION_LIMIT = 50;
const MAX_SESSION_LIMIT = 200;

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getSql(): NeonQueryFunction<false, false> {
  if (sqlClient) return sqlClient;

  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error('Circuit database is not configured');

  sqlClient = neon(connectionString);
  return sqlClient;
}

function requestHost(req: VercelRequest): string {
  const host = req.headers.host;
  return (Array.isArray(host) ? host[0] : host || '').split(':')[0].toLowerCase();
}

/**
 * Workout context is intentionally unavailable through Circuit's public aliases.
 * VERCEL_URL is the immutable deployment hostname, which is protected by Vercel
 * Authentication and can be read by the owner's authenticated Vercel connector.
 */
function isProtectedDeploymentRequest(req: VercelRequest): boolean {
  const deploymentHost = process.env.VERCEL_URL?.toLowerCase();
  return Boolean(deploymentHost && requestHost(req) === deploymentHost);
}

function parseLimit(req: VercelRequest): number {
  const requestUrl = new URL(req.url || '/', 'https://circuit.invalid');
  const requested = Number.parseInt(requestUrl.searchParams.get('limit') || '', 10);
  if (!Number.isFinite(requested)) return DEFAULT_SESSION_LIMIT;
  return Math.min(Math.max(requested, 1), MAX_SESSION_LIMIT);
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // Return 404 rather than advertising a private data endpoint on public hosts.
  if (!isProtectedDeploymentRequest(req)) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  try {
    const sql = getSql();
    const limit = parseLimit(req);
    const requestUrl = new URL(req.url || '/', 'https://circuit.invalid');
    // The imported account establishes the owner independently of recent writes.
    const configuredOwner = process.env.CIRCUIT_CONTEXT_OWNER_HASH;
    const [account] = await sql`SELECT encode(sha256(convert_to(profile->>'id','UTF8')),'hex') AS owner
      FROM circuit_app_state WHERE singleton`;
    const ownerPin = configuredOwner
      ? (/^[a-f0-9]{64}$/.test(configuredOwner) ? configuredOwner : null)
      : account?.owner || null;
    const snapshots = (await sql`
      SELECT
        owner_hash,
        session_count,
        workout_summary,
        source_updated_at,
        server_updated_at
      FROM circuit_history_snapshots AS snapshot
      WHERE (${ownerPin}::TEXT IS NULL OR owner_hash = ${ownerPin})
      ORDER BY server_updated_at DESC
      LIMIT 2
    `) as SnapshotRow[];
    const snapshot = snapshots[0];

    if (!snapshot) {
      return res.status(200).json({ ok: true, sessionCount: 0, sessions: [],
        weightTracking: weightContext(null, requestUrl, configuredOwner ? 'owner_mismatch' : 'not_synced', null) });
    }

    const sessions = await sql`
      SELECT
        status,
        workout_name,
        workout_at,
        duration_seconds,
        rpe,
        notes,
        session
      FROM circuit_workout_sessions
      WHERE owner_hash = ${snapshot.owner_hash}
      ORDER BY workout_at DESC NULLS LAST
      LIMIT ${limit}
    `;

    const sameOwner = Boolean(ownerPin && account?.owner === snapshot.owner_hash && ownerPin === snapshot.owner_hash);
    const tracking: WeightTracking = { records: {}, deleted: {} };
    let syncedAt: string | null = null;
    if (sameOwner) {
      const rows = await sql`SELECT entry_snapshot, local_day::text AS day, measurement_zone,
        client_updated_at, updated_at, deleted_at FROM circuit_weight_entries WHERE local_day IS NOT NULL`;
      for (const row of rows) {
        const updated = new Date(row.updated_at).toISOString();
        if (!syncedAt || updated > syncedAt) syncedAt = updated;
        if (!row.deleted_at) tracking.records[row.entry_snapshot.id] = {
          ...row.entry_snapshot, localDate: row.day, timeZone: row.measurement_zone,
          updatedAt: new Date(row.client_updated_at).toISOString(), mutationId: '',
        };
      }
    }
    return res.status(200).json({
      ok: true,
      sessionCount: snapshot.session_count,
      workoutSummary: snapshot.workout_summary,
      sourceUpdatedAt: snapshot.source_updated_at,
      serverUpdatedAt: snapshot.server_updated_at,
      returnedSessions: sessions.length,
      sessions,
      weightTracking: weightContext(sameOwner ? tracking : null, requestUrl,
        sameOwner ? 'available' : configuredOwner ? 'owner_mismatch' : 'owner_ambiguous', syncedAt),
    });
  } catch (error) {
    console.error('Circuit workout context read failed');
    return res.status(503).json({ ok: false, error: 'Workout context is unavailable' });
  }
}
