# Workout history persistence

History has two durable destinations: IndexedDB on web (AsyncStorage on native),
and the Neon snapshot. The old web localStorage copy is retained as a migration
backup. IndexedDB writes merge inside one read/write transaction so two tabs
cannot overwrite one another's sessions. A completed attempt replaces its
background checkpoint by session ID; feedback uses its `updatedAt` timestamp.
Cloud merges never remove on-device GPS points.

`POST /api/history-sync` accepts protocol version 2 and returns the reconciled
history. The existing profile ID scopes access; the public GET remains a health
check and never returns history. Legacy uploads are still accepted but missing
IDs no longer imply deletion. Deletion requires an explicit ID/timestamp in
`deletedSessions`; tombstones prevent older devices from restoring deletions.

The server uses a revision compare-and-swap and retries concurrent changes. Each
changed snapshot commits with immutable `circuit_workout_versions` and a
`circuit_history_sync_events` manifest. A manifest identifies every full session
version by ID and SHA-256, including feedback. Revision zero preserves the
pre-migration snapshot. Identical uploads do not create new revisions; unchanged
sessions are stored only once. Routine logs contain counts/revisions, not notes
or workout contents. Private SQL joins can reconstruct a recorded revision:

```sql
SELECT e.revision, e.received_at, e.history_metadata,
       v.ordinality, w.session
FROM circuit_history_sync_events e
CROSS JOIN LATERAL jsonb_array_elements(e.session_versions)
  WITH ORDINALITY AS v(value, ordinality)
JOIN circuit_workout_versions w
  ON w.owner_hash = e.owner_hash
 AND w.session_id = v.value ->> 'id'
 AND w.content_hash = v.value ->> 'hash'
WHERE e.owner_hash = $1 AND e.revision = $2
ORDER BY v.ordinality;
```

Finishing a workout or saving feedback waits for a durable destination. If both
fail, the screen retains the workout/input and offers retry. Offline local saves
retry cloud sync on a timer, foregrounding, and the online event. Both completion
buttons save feedback. GPS draft cleanup additionally requires a local save.

Validation: `node scripts/test-history.cjs`, `npx tsc --noEmit`,
`npx expo export --platform web`, and a browser completion/save/reload check.
Setting `CIRCUIT_TEST_DATABASE_URL` also tests the actual handler and Neon
transactions with a new disposable profile, then removes only that test profile.
Never use a real athlete's profile for a write test.

The endpoint retains the existing 2,000-session and 3,750,000-byte upload limits;
capacity errors are visible and local history is retained. The new revision
trail cannot reconstruct payloads erased before its deployment. Provider request
logs alone contain no workout bodies.
