-- Apply as one transaction against the original single-user Circuit schema.
-- Existing import rows keep their identities, measurement times and weights.
ALTER TABLE circuit_weight_entries
  ADD COLUMN IF NOT EXISTS local_day date,
  ADD COLUMN IF NOT EXISTS mutation_key text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS measurement_zone text;

UPDATE circuit_weight_entries
SET local_day = (measured_at AT TIME ZONE 'America/New_York')::date
WHERE local_day IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS circuit_weights_by_day ON circuit_weight_entries(local_day);

-- An offline deletion can arrive before the corresponding insert. A deletion
-- marker has no invented weight and participates in the same conflict rules.
ALTER TABLE circuit_weight_entries ALTER COLUMN weight DROP NOT NULL, ALTER COLUMN unit DROP NOT NULL;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid='circuit_weight_entries'::regclass AND conname='weight_required_when_active') THEN
    ALTER TABLE circuit_weight_entries ADD CONSTRAINT weight_required_when_active
      CHECK (deleted_at IS NOT NULL OR (weight IS NOT NULL AND unit IS NOT NULL));
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS circuit_weight_devices (
  fingerprint text PRIMARY KEY,
  owner_hash text NOT NULL,
  approved_at timestamptz NOT NULL DEFAULT now()
);

-- The archived profile establishes ownership independently of snapshot recency.
-- Retain the original snapshots. Collapse repeated saves to the newest per day.
WITH candidates AS (
  SELECT r, (r->>'localDate')::date AS day
  FROM circuit_app_state a
  JOIN circuit_history_snapshots s ON s.owner_hash = encode(sha256(convert_to(a.profile->>'id','UTF8')),'hex')
  CROSS JOIN LATERAL jsonb_each(s.weight_tracking->'records') AS records(key,r)
  WHERE a.singleton AND r->>'localDate' IS NOT NULL
), latest AS (
  SELECT DISTINCT ON (day) day, r FROM candidates ORDER BY day, (r->>'updatedAt')::timestamptz DESC, r->>'mutationId' DESC
)
INSERT INTO circuit_weight_entries
  (sync_id,source_entry_id,local_day,measured_at,weight,unit,notes,entry_snapshot,client_updated_at,mutation_key,measurement_zone)
SELECT 'daily-'||day, r->>'id', day,(r->>'date')::timestamptz,(r->>'weight')::numeric,r->>'unit',r->>'notes',
       r - 'localDate' - 'updatedAt' - 'mutationId' - 'timeZone', (r->>'updatedAt')::timestamptz,r->>'mutationId',r->>'timeZone'
FROM latest ON CONFLICT (local_day) DO NOTHING;
