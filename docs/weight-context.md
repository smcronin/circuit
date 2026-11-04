# Weight tracking

PostgreSQL stores the canonical weight history in `circuit_weight_entries`, one row per selected calendar day. Every approved device reads this table on app start, on returning to the app, and when its network comes back. The weight tracker and private coaching reader use the same records.

## Saving and reconnecting

The app saves each edit and its pending upload together in IndexedDB on the web, or AsyncStorage on native. It keeps the form open if the local save fails. A local success can be displayed while offline. The tracker displays **Synced with database** only after the server has committed the edits, returned the current history, and the device has saved the result.

The device submits pending edits to `POST /api/weights`. Each transaction applies up to 100 edits and returns the database history with acknowledgments. The selected local date identifies the day even when a device changes time zone. For concurrent corrections to one day, the latest client change time wins, with a mutation ID as the tie breaker. Deletion markers prevent an old upload or a reconnecting device from reviving a deleted entry. A pending edit takes precedence over an incoming snapshot on the device until its exact mutation is acknowledged.

The first connection of the approved original profile also fills missing database dates from its existing device history. Previously saved database values and deletion markers take precedence over these historical imports. A newly linked replacement profile can download the history and record new edits. A fresh device needs its own approval.

## Device access

Circuit is a single-user app. Opening the weight tracker in an unlinked browser creates a random secret held in a secure, HTTP-only, same-site cookie. The tracker shows a public device code derived from that secret and the local profile ID. The code alone cannot read or write weights.

After the owner supplies the device code through a trusted channel, run `node scripts/approve-weight-device.cjs <device-code>` privately with the production database connection in the environment. Approval associates the device with the verified singleton Circuit account. The open app retries automatically. The cookie renews during successful use. Clearing cookies or replacing the local profile requires linking again. To revoke a device, remove its exact fingerprint from `circuit_weight_devices`.

## Data and coaching

Apply `db/weight-sync.sql` as one transaction against the original Circuit database. The migration retains the original imported measurements and fills their calendar dates using America/New_York. It folds the verified account’s legacy workout-snapshot weights into the daily table, choosing the latest recorded change within each day. The source snapshot is retained. The public workout-history endpoint no longer handles weights.

The protected immutable deployment endpoint `GET /api/workout-context` includes the same account’s active measurements in its existing `weightTracking` field. Public aliases return 404. The archived singleton profile determines the owner independently of workout activity. An optional server-only `CIRCUIT_CONTEXT_OWNER_HASH` must match that account for weight reads. The existing `weightLimit` and `weightOffset` parameters paginate measurements separately from workouts.

## Validation

Run `npm run weight:test` for PostgreSQL migration, authorization, save, retry, conflict, cache, and cold-start coverage using a disposable database. Run `node scripts/test-history.cjs` with `CIRCUIT_TEST_DATABASE_URL` unset, `npx tsc --noEmit`, `npm run security:test`, and `npm run build:web`. Verify the released tracker from an empty cache in a mobile browser.
