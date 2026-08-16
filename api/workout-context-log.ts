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

type JsonObject = Record<string, unknown>;

interface SessionRow {
  status: string | null;
  workout_name: string | null;
  workout_at: string | null;
  duration_seconds: number | null;
  rpe: number | null;
  notes: string | null;
  session: JsonObject;
}

const EXPORT_MARKER = 'CIRCUIT_CONTEXT_EXPORT_c7a4f19e';
const GRANT_MARKER = 'CIRCUIT_CONTEXT_GRANT_c7a4f19e';
const DEFAULT_SESSION_LIMIT = 20;
const MAX_SESSION_LIMIT = 40;
const MAX_SESSION_OFFSET = 2_000;
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

function asObject(value: unknown): JsonObject | undefined {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : undefined;
}

function asObjectArray(value: unknown): JsonObject[] {
  return Array.isArray(value)
    ? value.map(asObject).filter((item): item is JsonObject => Boolean(item))
    : [];
}

function parseBoundedInteger(
  requestUrl: URL,
  name: string,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number.parseInt(requestUrl.searchParams.get(name) || '', 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 0), maximum);
}

function exerciseNames(session: JsonObject): string[] {
  const workout = asObject(session.workout);
  if (!workout) return [];

  const exercises: JsonObject[] = [];
  const warmUp = asObject(workout.warmUp);
  const coolDown = asObject(workout.coolDown);
  exercises.push(...asObjectArray(warmUp?.exercises));
  for (const circuit of asObjectArray(workout.circuits)) {
    exercises.push(...asObjectArray(circuit.exercises));
  }
  exercises.push(...asObjectArray(coolDown?.exercises));

  return [
    ...new Set(
      exercises
        .map((exercise) => exercise.name)
        .filter((name): name is string => typeof name === 'string' && name.length > 0),
    ),
  ];
}

function compactSession(row: SessionRow, index: number) {
  const workout = asObject(row.session.workout);
  const ride = asObject(row.session.ride);
  const gaps = ride ? asObjectArray(ride.gaps) : [];

  return {
    kind: 'session',
    index,
    sessionId: row.session.id,
    status: row.status,
    workoutName: row.workout_name,
    workoutAt: row.workout_at,
    durationSeconds: row.duration_seconds,
    percentComplete: row.session.percentComplete,
    rpe: row.rpe,
    notes: row.notes,
    activityType: workout?.activityType,
    targetDurationSeconds: workout?.targetDuration,
    focusAreas: workout?.focusAreas,
    muscleGroups: workout?.muscleGroupsTargeted,
    exercises: exerciseNames(row.session),
    ride: ride
      ? {
          startedAt: ride.startedAt,
          endedAt: ride.endedAt,
          calorieModel: ride.calorieModel,
          stats: ride.stats,
          gapCount: gaps.length,
        }
      : undefined,
  };
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
    const requestUrl = new URL(req.url || '/', 'https://circuit.invalid');
    const limit = Math.max(
      1,
      parseBoundedInteger(
        requestUrl,
        'limit',
        DEFAULT_SESSION_LIMIT,
        MAX_SESSION_LIMIT,
      ),
    );
    const offset = parseBoundedInteger(
      requestUrl,
      'offset',
      0,
      MAX_SESSION_OFFSET,
    );
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

    const sessions = (await sql`
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
      OFFSET ${offset}
    `) as SessionRow[];

    console.info(
      EXPORT_MARKER,
      JSON.stringify({
        kind: 'meta',
        sessionCount: snapshot.session_count,
        returnedSessions: sessions.length,
        offset,
        limit,
        workoutSummary: snapshot.workout_summary,
        sourceUpdatedAt: snapshot.source_updated_at,
        serverUpdatedAt: snapshot.server_updated_at,
      }),
    );
    sessions.forEach((session, index) => {
      console.info(
        EXPORT_MARKER,
        JSON.stringify(compactSession(session, offset + index)),
      );
    });

    return res.status(200).json({
      ok: true,
      loggedSessions: sessions.length,
      offset,
      nextOffset: offset + sessions.length,
    });
  } catch (error) {
    console.error(EXPORT_MARKER, 'failed', error);
    return res.status(503).json({ ok: false, error: 'Workout context export failed' });
  }
}
