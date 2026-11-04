import { createHash, randomBytes } from 'node:crypto';
import { neon } from '@neondatabase/serverless';
import { parseWeightChanges, type WeightChange } from '../src/utils/weightSync';

type Request = { method?: string; headers: Record<string, string | string[] | undefined>; body?: unknown };
type Response = { setHeader(name: string, value: string): void; status(code: number): Response; json(value: unknown): unknown };
const cookieName = '__Host-circuit-weight-device';

export default async function weights(req: Request, res: Response) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST required' });
  const origin = req.headers.origin;
  if (origin && origin !== `https://${req.headers.host}`) return res.status(403).json({ error: 'Origin denied' });
  if (!String(req.headers['content-type']).startsWith('application/json')) return res.status(415).json({ error: 'JSON required' });

  let profileId: string, changes: WeightChange[], seeds: WeightChange[];
  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    profileId = body.profileId;
    if (typeof profileId !== 'string' || profileId.length < 10 || profileId.length > 200) throw new Error();
    changes = parseWeightChanges(body.changes ?? []);
    seeds = parseWeightChanges(body.seeds ?? []);
    if ([...changes, ...seeds].some(c => c.entry && (!c.localDate || c.entry.weight >= 100000)) ||
        seeds.some(c => !c.entry)) throw new Error();
  } catch {
    return res.status(400).json({ error: 'Invalid weight request' });
  }

  try {
    const cookie = String(req.headers.cookie || '').split(';').map(v => v.trim()).find(v => v.startsWith(cookieName+'='));
    const existing = cookie?.slice(cookieName.length + 1);
    const secret = existing && /^[a-f0-9]{64}$/.test(existing) ? existing : randomBytes(32).toString('hex');
    const fingerprint = createHash('sha256').update(`circuit-weights-v1\0${profileId}\0${secret}`).digest('base64url').slice(0, 22);
    const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.NEON_DATABASE_URL || '');
    const [device] = await sql`
      SELECT d.owner_hash FROM circuit_weight_devices d JOIN circuit_app_state a
      ON d.owner_hash = encode(sha256(convert_to(a.profile->>'id','UTF8')),'hex')
      WHERE a.singleton AND d.fingerprint=${fingerprint}
    `;
    if (!existing || secret !== existing || device) {
      res.setHeader('Set-Cookie', `${cookieName}=${secret}; Path=/; Max-Age=31536000; HttpOnly; Secure; SameSite=Strict`);
    }
    if (!device) return res.status(401).json({ error: 'device_approval_required', deviceCode: fingerprint });
    const canSeed = createHash('sha256').update(profileId).digest('hex') === device.owner_hash;
    if (seeds.length && !canSeed) return res.status(403).json({ error: 'Legacy import is restricted to its original profile' });

    const operations = [];
    if (seeds.length) operations.push(sql`
      INSERT INTO circuit_weight_entries
        (sync_id,source_entry_id,local_day,measured_at,weight,unit,notes,entry_snapshot,client_updated_at,mutation_key,measurement_zone)
      SELECT DISTINCT ON (day) 'daily-'||day,id,day,(entry->>'date')::timestamptz,(entry->>'weight')::numeric,entry->>'unit',
        entry->>'notes',entry,(entry->>'date')::timestamptz,'',zone
      FROM (SELECT c->>'id' AS id,(c->>'localDate')::date AS day,c->'entry' AS entry,c->>'timeZone' AS zone
            FROM jsonb_array_elements(${JSON.stringify(seeds)}::jsonb) c) v
      ORDER BY day,(entry->>'date')::timestamptz DESC,id DESC
      ON CONFLICT (local_day) DO NOTHING
    `);
    // Consistent day order also prevents opposite lock order across devices.
    changes.sort((a, b) => (a.localDate || '').localeCompare(b.localDate || '') ||
      Date.parse(a.changedAt) - Date.parse(b.changedAt) || a.mutationId.localeCompare(b.mutationId));
    for (const c of changes) {
      const e = c.entry;
      operations.push(sql`
        WITH target AS (SELECT COALESCE(${c.localDate}::date,
          (SELECT local_day FROM circuit_weight_entries WHERE source_entry_id=${c.id} ORDER BY local_day DESC LIMIT 1)) AS day)
        INSERT INTO circuit_weight_entries AS old
          (sync_id,source_entry_id,local_day,measured_at,weight,unit,notes,entry_snapshot,client_updated_at,mutation_key,measurement_zone,deleted_at)
        SELECT 'daily-'||day,${c.id},day,${e?.date || c.changedAt}::timestamptz,${e?.weight ?? null}::numeric,${e?.unit ?? null},
          ${e?.notes ?? null},${JSON.stringify(e || {})}::jsonb,${c.changedAt}::timestamptz,${c.mutationId},${c.timeZone},
          ${e ? null : c.changedAt}::timestamptz FROM target WHERE day IS NOT NULL
        ON CONFLICT (local_day) DO UPDATE SET
          source_entry_id=excluded.source_entry_id, measured_at=excluded.measured_at, weight=excluded.weight,
          unit=excluded.unit, notes=excluded.notes, entry_snapshot=excluded.entry_snapshot, client_updated_at=excluded.client_updated_at,
          mutation_key=excluded.mutation_key, measurement_zone=excluded.measurement_zone, deleted_at=excluded.deleted_at
        WHERE (excluded.client_updated_at,excluded.mutation_key) > (old.client_updated_at,old.mutation_key)
          AND (excluded.deleted_at IS NULL OR excluded.source_entry_id=old.source_entry_id)
      `);
    }
    operations.push(sql`SELECT local_day::text AS "localDate", source_entry_id AS id,
      CASE WHEN deleted_at IS NULL THEN entry_snapshot ELSE NULL END AS entry
      FROM circuit_weight_entries WHERE local_day IS NOT NULL ORDER BY local_day DESC`);
    const result = await sql.transaction(operations);
    return res.status(200).json({ days: result[result.length-1], acknowledged: changes.map(c => c.mutationId), canSeed });
  } catch {
    return res.status(503).json({ error: 'Weight database unavailable' });
  }
}
