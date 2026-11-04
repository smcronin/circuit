// The phone displays a public fingerprint. The device's secret never leaves
// its HTTP-only cookie. Run privately with the production DATABASE_URL.
const { neon } = require('@neondatabase/serverless');
const fingerprint = process.argv[2] || '';
if (!/^[A-Za-z0-9_-]{22}$/.test(fingerprint)) throw new Error('Supply the complete device code shown in Circuit.');
const sql = neon(process.env.DATABASE_URL || process.env.POSTGRES_URL);
(async () => {
  const rows = await sql`
    INSERT INTO circuit_weight_devices (fingerprint, owner_hash)
    SELECT ${fingerprint}, encode(sha256(convert_to(profile->>'id','UTF8')),'hex')
    FROM circuit_app_state WHERE singleton AND length(profile->>'id') >= 10
    ON CONFLICT (fingerprint) DO UPDATE SET approved_at = now()
      WHERE circuit_weight_devices.owner_hash = excluded.owner_hash
    RETURNING approved_at
  `;
  if (rows.length !== 1) throw new Error('Owner verification failed');
  console.log('Device approved for the Circuit owner.');
})().catch(() => { console.error('Device approval failed.'); process.exitCode = 1; });
