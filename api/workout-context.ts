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
  weight_tracking: WeightTracking | null;
  weight_synced_at: string | null;
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
    // Optional non-secret selector, never caller supplied. Without a verified
    // pin, weights fail closed if more than one owner exists. Workouts retain
    // their legacy latest-snapshot behavior for backward compatibility.
    const configuredOwner = process.env.CIRCUIT_CONTEXT_OWNER_HASH;
    const ownerPin = configuredOwner && /^[a-f0-9]{64}$/.test(configuredOwner) ? configuredOwner : null;
    const snapshots = (await sql`
      SELECT
        owner_hash,
        session_count,
        workout_summary,
        source_updated_at,
        server_updated_at,
        to_jsonb(snapshot) -> 'weight_tracking' AS weight_tracking,
        to_jsonb(snapshot) ->> 'weight_synced_at' AS weight_synced_at
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

    return res.status(200).json({
      ok: true,
      sessionCount: snapshot.session_count,
      workoutSummary: snapshot.workout_summary,
      sourceUpdatedAt: snapshot.source_updated_at,
      serverUpdatedAt: snapshot.server_updated_at,
      returnedSessions: sessions.length,
      sessions,
      weightTracking: weightContext(snapshot.weight_tracking, requestUrl,
        configuredOwner && !ownerPin ? 'owner_mismatch' : !ownerPin && snapshots.length > 1 ? 'owner_ambiguous'
          : snapshot.weight_tracking ? 'available' : 'not_synced', snapshot.weight_synced_at),
    });
  } catch (error) {
    console.error('Circuit workout context read failed');
    return res.status(503).json({ ok: false, error: 'Workout context is unavailable' });
  }
}
