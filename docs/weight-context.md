# Prospective weight synchronization

New explicit weight saves queue changes alongside the local entries. On the web,
Circuit commits both to IndexedDB (`circuit-weights`); on native it uses
AsyncStorage. On first use, web reads the existing `weight-storage` snapshot,
including its pending uploads. The legacy copy is retained. Opening the app, hydrating legacy storage, importing
a backup, or editing an untracked historical entry does not backfill weights.
Saving a new entry for a historical selected date is an explicit new save and is
eligible. Corrections/deletions of records first saved by this version sync too.
Replacing a tracked entry for the same local day queues its deletion and the new
entry; stable IDs are preserved within each record.

The queue is persisted, scoped to the profile ID captured at save time, and sent
in batches of at most 100 through the existing `POST /api/history-sync`. It uses
the current history sync startup, foreground/online and retry lifecycle; no
workout is required to trigger a weight upload. Only submitted mutation IDs that
the server acknowledges are removed. Edits made during an upload remain queued.
Old servers that do not acknowledge weights leave the queue intact for retry.

## Storage and privacy

The existing `circuit_history_snapshots` row gains two nullable columns:

- `weight_tracking JSONB`: records and deletion tombstones, separate from history.
- `weight_synced_at TIMESTAMPTZ`: last server acceptance of a weight-state change.

Writes participate in the existing revision compare-and-swap transaction. Weight
changes alone advance the revision; retries do not. Missing fields from old
clients preserve all weights. Stored weights are never included in public
history-sync responses, workout summaries, history-version manifests, or the
legacy workout-context-log export. A response may acknowledge mutation IDs the
caller just submitted; it does not return weight values or stored record IDs.
Errors in the touched data paths log a fixed message, not bound payloads.

Weights are read only through the existing immutable deployment URL at
`GET /api/workout-context`. The public aliases still return 404. The Vercel
deployment must remain protected by its existing SSO settings; the hostname
comparison in application code is not itself user authentication.

## Owner selection

Previously this handler always chose the most recently updated workout owner.
Without configuration, that behavior remains for workout fields, but weight
records are withheld if more than one snapshot owner exists (`owner_ambiguous`).
There is no arbitrary owner switching for weights.

Optional server-only `CIRCUIT_CONTEXT_OWNER_HASH` pins both workout and weight
reads to one independently verified existing owner hash. It is a data selector,
not a password or credential. Never infer it from the most recent row or accept
it from an HTTP parameter. A malformed or unmatched pin withholds weights
(`owner_mismatch`). No pin was configured during implementation. With exactly
one owner, no new setting is necessary.

This preserves the existing write-access model: the public upload accepts a
profile ID and hashes it. It does not authenticate the owner. Someone knowing
that profile ID could forge writes, including weights. CORS is not authentication.
This feature does not fix or weaken that pre-existing control. The private reader
continues to share the existing Vercel project-access boundary. Restoring a deleted
owner row, changing deployment protection, and adding full app authentication are
not part of this change.

## Response contract

Existing workout fields and `limit` are unchanged. The new `weightTracking` field
contains:

| Field | Meaning |
| --- | --- |
| `status` | `available`, `not_synced`, `owner_ambiguous`, or `owner_mismatch` |
| `totalEntries` | Current non-deleted count for this owner, or null when unavailable |
| `returnedEntries` | Number of entries in this page |
| `limit`, `offset`, `nextOffset` | Separate weight pagination; null next offset at the end |
| `syncedAt` | Server time of the last changed weight snapshot; never measurement time |
| `provenance` | `circuit-weight-store` |
| `dateSemantics` | Explicitly identifies the date as selected by the user |
| `entries` | Raw weight records with metadata described below |

Each entry retains `id`, original `date`, numeric `weight`, `unit` (`lbs` or
`kg`), and optional `notes`. `localDate` and `timeZone` describe the context
captured at the explicit save, with null for unknown metadata. `updatedAt` is
the client change timestamp, not a verified measurement instant or import time.
There is no inferred creation timestamp. The original `date` is not converted
to a UTC calendar day; offsets and units are retained without conversion.
No profile-weight fallback, targets, medical interpretation or averages are added.

Query parameters: `weightLimit` defaults to 50, bounded 1–200; `weightOffset`
defaults to 0, bounded 0–5,000. Ordering is descending date instant, then ID.
Each page reads one snapshot. Pagination across multiple requests is not a frozen
export: if data changes between pages, restart at offset zero. Known synchronized
empty data returns `available`, count zero and an empty array; never-synced or
withheld data returns a null count. Invalid/missing/zero weights are rejected,
never converted to zero. A maximum of 5,000 distinct record IDs plus tombstones
per owner bounds storage; capacity errors retain the local queue.

Weight history remains device-local; this is prospective upload,
not cross-device reconciliation. The log form waits for the local commit before
closing. If it fails, the form retains the input and offers retry. A failed
update to the separate profile weight does not undo a saved weigh-in. Web writes
apply per-record changes inside one IndexedDB transaction so an older tab's upload
acknowledgement does not replace newer entries or erase another tab's pending edit.
Client-clock skew can affect
conflict ordering. Neither a profile switch nor an import reassigns queued records.

For owner-assisted recovery, Profile → Import Data also accepts a local JSON
file with `format: "circuit-missing-weights-v1"` and an `entries` array of
up to 100 validated weight records. This format adds only missing IDs/days,
does not upload historical weights, and does not replace existing profile or
workout data. Old app versions reject it as an invalid full backup. Keep
recovery files private and outside the repository.

## Validation and activation

Synthetic regression command: `npm run weight:test`. It runs the real stores,
sync service and handlers with in-memory storage/database/network boundaries.
It covers dates/DST/units, empty versus missing, invalid records, pending queues,
offline reload, lost acknowledgements, concurrent edits, CAS retry, deletion,
old-client compatibility, profile isolation, same-owner reads, owner ambiguity,
public denial, legacy log privacy and pagination. It cannot access a live database.

Also run `node scripts/test-history.cjs` with `CIRCUIT_TEST_DATABASE_URL` unset,
`npm run security:test`, `npx tsc --noEmit`, and `npm run build:web`. There is no
lint script. CI runs the synthetic weight test before the web build.

No production schema or data is changed by this branch sitting locally. Activation
requires the separately authorized release:

1. Review the diff and test evidence. Verify the target database's owner identity
   using existing authorized administration; if multiple owners exist, configure
   the optional verified owner selector before expecting weights in context.
2. Merge/deploy only after authorization. The current `history-sync` schema
   initializer will add the two nullable columns on its first GET/POST after
   deployment. No manual backfill, new credential or new database is required.
   The private reader safely handles a schema that has not yet added the columns.
3. Open the new app build on the device used for weigh-ins. Existing entries stay
   local. The next explicit new save queues and uploads through history sync.
4. Verify the deployment commit is Ready, then use the existing authenticated
   Vercel connector to fetch its immutable `/api/workout-context?limit=20` URL.
   Check record/date/unit/owner, unchanged workouts, and public-alias 404. Do not
   log or export the health payload as a validation artifact.

Rollback to the prior app/server preserves the nullable database columns; old
clients do not touch them. Do not drop stored data during rollback. A rollback
cannot make the old client capture future weigh-ins, so reinstall the fixed build
before relying on continued synchronization.
