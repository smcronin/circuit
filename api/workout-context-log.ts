import { createHmac, timingSafeEqual } from 'node:crypto';
import { neon, type NeonQueryFunction } from '@neondatabase/serverless';

interface VercelRequest {
  method?: string;
  url?: string;
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

const EXPORT_MARKER = 'CIRCUIT_CONTEXT_EXPORT_c7a4f19e';
const GRANT_MARKER = 'CIRCUIT_CONTEXT_GRANT_c7a4f19e';
const SESSION_LIMIT = 60;
const GRANT_LIFETIME_MS = 5 * 60 * 1_000;
const MAX_FUTURE_EXPIRY_MS = 10 * 60 * 1_000;
const NONCE_PATTERN = /^[a-f0-9]{32,128}$/i;
const TOKEN_PATTERN = /^[a-f0-9]{64}$/i;

let sqlClient: NeonQueryFunction<false, false> | null = null;

function getConnectionString(): string {
  const connectionString =
    process.env.DATABASE_URL ||
    process.env.POSTGRES_URL ||
    process.env.NEON_DATABASE_URL;
  if (!connectionString) throw new Error('Circuit database is not configured');
  return connectionString;
}

function getSql(): NeonQueryFunction<false, false> {
  if (sqlClient) return sqlClient;

  sqlClient = neon(getConnectionString());
  return sqlClient;
}

function createGrantToken(nonce: string, expires: string): string {
  return createHmac('sha256', getConnectionString())
    .update(`circuit-workout-context-log:${nonce}:${expires}`)
    .digest('hex');
}

function tokensMatch(actual: string, expected: string): boolean {
  if (!TOKEN_PATTERN.test(actual) || actual.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(actual, 'hex'), Buffer.from(expected, 'hex'));
}

function hasValidGrant(req: VercelRequest): boolean {
  const requestUrl = new URL(req.url || '/', 'https://circuit.invalid');
  const nonce = requestUrl.searchParams.get('nonce') || '';
  if (!NONCE_PATTERN.test(nonce)) return false;

  const expires = requestUrl.searchParams.get('expires') || '';
  const token = requestUrl.searchParams.get('token') || '';
  if (!expires || !token) {
    const grantExpires = String(Date.now() + GRANT_LIFETIME_MS);
    console.info(
      GRANT_MARKER,
      JSON.stringify({
        nonce,
        expires: grantExpires,
        token: createGrantToken(nonce, grantExpires),
      }),
    );
    return false;
  }

  const expiryTime = Number.parseInt(expires, 10);
  const now = Date.now();
  if (
    !Number.isFinite(expiryTime) ||
    expiryTime < now ||
    expiryTime > now + MAX_FUTURE_EXPIRY_MS
  ) {
    return false;
  }

  return tokensMatch(token, createGrantToken(nonce, expires));
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');

  if (req.method !== 'GET') {
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  // An unauthenticated request can only mint a short-lived grant into private
  // Vercel logs. Workout data is logged only after that grant is presented.
  if (!hasValidGrant(req)) {
    return res.status(404).json({ ok: false, error: 'Not found' });
  }

  try {
    const sql = getSql();
    const snapshots = (await sql`
      SELECT
        owner_hash,
        session_count,
        workout_summary,
        source_updated_at,
        server_updated_at
      FROM circuit_history_snapshots
      ORDER BY server_updated_at DESC
      LIMIT 1
    `) as SnapshotRow[];
    const snapshot = snapshots[0];

    if (!snapshot) {
      console.info(EXPORT_MARKER, JSON.stringify({ kind: 'meta', sessionCount: 0 }));
      return res.status(200).json({ ok: true, loggedSessions: 0 });
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
      LIMIT ${SESSION_LIMIT}
    `;

    console.info(
      EXPORT_MARKER,
      JSON.stringify({
        kind: 'meta',
        sessionCount: snapshot.session_count,
        returnedSessions: sessions.length,
        workoutSummary: snapshot.workout_summary,
        sourceUpdatedAt: snapshot.source_updated_at,
        serverUpdatedAt: snapshot.server_updated_at,
      }),
    );
    sessions.forEach((session, index) => {
      console.info(
        EXPORT_MARKER,
        JSON.stringify({ kind: 'session', index, ...session }),
      );
    });

    return res.status(200).json({ ok: true, loggedSessions: sessions.length });
  } catch (error) {
    console.error(EXPORT_MARKER, 'failed', error);
    return res.status(503).json({ ok: false, error: 'Workout context export failed' });
  }
}
