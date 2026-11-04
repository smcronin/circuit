const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { IDBFactory } = require('fake-indexeddb');
const { createHash, createHmac } = require('node:crypto');
const root = path.resolve(__dirname, '..');
const owner = id => createHash('sha256').update(id).digest('hex');
const profileA = 'synthetic-owner-alpha';
const profileB = 'synthetic-owner-bravo';
const host = 'circuit-synthetic-smcronins-projects.vercel.app';

function runtime({ disk = new Map(), sql, fetcher, env = {}, profileId = profileA, failDisk = false, indexedDB } = {}) {
  const cache = new Map();
  const user = require('zustand').create(() => ({ profile: { id: profileId } }));
  user.persist = { hasHydrated: () => true, onFinishHydration: () => () => {} };
  const logs = [];
  const timers = new Map();
  let timerId = 0;
  function load(file) {
    file = path.resolve(root, file);
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const mod = { exports: {} }; cache.set(file, mod);
    const localRequire = name => {
      if (name === 'react-native') return { Platform: { OS: indexedDB ? 'web' : 'ios' }, AppState: { addEventListener: () => ({ remove() {} }) } };
      if (name === '@react-native-async-storage/async-storage') return {
        getItem: async key => disk.get(key) ?? null,
        setItem: async (key, value) => { if (failDisk) throw new Error('Synthetic full disk'); disk.set(key, value); },
        removeItem: async key => disk.delete(key),
      };
      if (name === '@/stores/useUserStore' || (file.endsWith('useWeightStore.ts') && name === './useUserStore')) return { useUserStore: user };
      if (name === '@neondatabase/serverless') return { neon: () => { assert(sql, 'No live database allowed'); return sql; } };
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: {
      module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true,
    } }).outputText;
    new Function('module', 'exports', 'require', 'fetch', 'process', 'console', 'setTimeout', 'clearTimeout', 'indexedDB', source)(
      mod, mod.exports, localRequire,
      fetcher || (async () => { throw new Error('No live network allowed'); }),
      { env: { DATABASE_URL: 'synthetic-only', VERCEL_URL: host, ...env } },
      { info: (...args) => logs.push(args), error: (...args) => logs.push(args) },
      (callback, ms) => { timers.set(++timerId, { callback, ms }); return timerId; }, id => timers.delete(id), indexedDB);
    return mod.exports;
  }
  return { load, disk, user, logs, timers };
}

// In-memory SQL boundary: exercises the actual handlers, transactions, WHERE
// scoping and JSON projections. It cannot connect to or mutate a real database.
function database() {
  const rows = new Map();
  const queries = [];
  let tick = 0;
  let conflicts = 0;
  function sql(strings, ...values) {
    const text = strings.reduce((out, str, i) => out + (i ? `$${i}` : '') + str, '').replace(/\s+/g, ' ').trim();
    const query = { text, values, run() {
      queries.push({ text, values });
      if (/^(CREATE|ALTER)/.test(text)) return [];
      if (text.startsWith('INSERT INTO circuit_history_snapshots')) {
        if (!rows.has(values[0])) rows.set(values[0], { owner_hash: values[0], history: JSON.parse(values[1]),
          session_count: 0, workout_summary: null, deleted_sessions: {}, revision: 0,
          source_updated_at: values[2], server_updated_at: new Date(++tick).toISOString(),
          weight_tracking: null, weight_synced_at: null });
        return [];
      }
      if (text.startsWith('SELECT history,')) return [{ ...rows.get(values[0]) }];
      if (text.startsWith('UPDATE circuit_history_snapshots')) {
        assert.match(text, /WHERE owner_hash = \$9 AND revision = \$10 RETURNING revision$/);
        const row = rows.get(values[8]);
        if (conflicts) { conflicts--; return []; }
        if (row.revision !== values[9]) return [];
        Object.assign(row, { history: JSON.parse(values[0]), session_count: values[1], workout_summary: JSON.parse(values[2]),
          deleted_sessions: JSON.parse(values[3]), revision: values[4], weight_tracking: JSON.parse(values[5]),
          source_updated_at: values[7], server_updated_at: new Date(++tick).toISOString() });
        if (values[6]) row.weight_synced_at = row.server_updated_at;
        return [{ revision: row.revision }];
      }
      if (/^INSERT INTO circuit_(workout_versions|history_sync_events)/.test(text)) return [];
      if (text.includes('FROM circuit_history_snapshots AS snapshot')) {
        assert.match(text, /WHERE \(\$1::TEXT IS NULL OR owner_hash = \$2\)/);
        assert.equal(values[0], values[1]);
        return [...rows.values()].filter(row => !values[0] || row.owner_hash === values[0])
          .sort((a, b) => b.server_updated_at.localeCompare(a.server_updated_at)).slice(0, 2).map(row => ({ ...row }));
      }
      if (text.includes('FROM circuit_history_snapshots ORDER BY')) {
        return [...rows.values()].sort((a, b) => b.server_updated_at.localeCompare(a.server_updated_at)).slice(0, 1);
      }
      if (text.includes('FROM circuit_workout_sessions')) {
        assert.match(text, /WHERE owner_hash = \$1/);
        return (rows.get(values[0])?.history.sessions || []).slice(0, values[1]).map(session => ({ session }));
      }
      throw new Error('Unhandled synthetic query: ' + text);
    }, then(resolve, reject) { return Promise.resolve().then(() => query.run()).then(resolve, reject); } };
    return query;
  }
  sql.transaction = queries => Promise.resolve(queries.map(query => query.run()));
  return { sql, rows, queries, conflictNext: () => { conflicts++; } };
}

async function request(handler, req) {
  let status = 200, body;
  const headers = {};
  await handler(req, { setHeader: (key, value) => { headers[key] = value; },
    status(code) { status = code; return this; }, json(value) { body = value; return this; }, end() {} });
  return { status, body, headers };
}
const entry = (id, unit = 'lbs', date = '2026-11-03T00:30:00+14:00') => ({ id, date, weight: unit === 'lbs' ? 170.2 : 77.2, unit });
const change = (id, overrides = {}) => ({ id, mutationId: `mutation-${id}`, changedAt: '2026-11-03T12:00:00.000Z',
  entry: entry(id), localDate: '2026-11-03', timeZone: 'Pacific/Kiritimati', ...overrides });

async function main() {
  const math = runtime().load('src/utils/weightSync.ts');
  const history = runtime().load('src/utils/historyMerge.ts').historyFromSessions([]);
  const payload = (weightChanges, profileId = profileA) => ({ profileId, protocolVersion: 2, history,
    ...(weightChanges === undefined ? {} : { weightChanges }) });
  for (const invalid of [0, null, '', -1, NaN, Infinity]) {
    assert.throws(() => math.parseWeightChanges([change('invalid', { entry: { ...entry('invalid'), weight: invalid } })]));
  }
  for (const date of ['2026-02-31T12:00:00Z', '2026-11-03T24:00:00Z', '2026-11-03', '2026-11-03T12:00:00', 'invalid']) {
    assert.throws(() => math.parseWeightChanges([change('invalid', { entry: entry('invalid', 'lbs', date) })]));
  }
  assert.throws(() => math.parseWeightChanges([change('__proto__')]));
  assert.throws(() => math.parseWeightChanges([change('invalid', { timeZone: 'Invented/Zone' })]));
  assert.throws(() => math.parseWeightChanges([change('invalid', { entry: { ...entry('invalid'), unit: 'stones' } })]));
  assert.throws(() => math.parseWeightChanges(Array(101).fill(change('too-many'))));
  const dates = ['2026-11-01T01:30:00-04:00', '2026-11-01T01:30:00-05:00', '2026-11-03T00:30:00+14:00'];
  dates.forEach(date => assert.equal(math.parseWeightChanges([change('date', { entry: entry('date', 'kg', date) })])[0].entry.date, date));
  assert.equal(math.parseWeightChanges([change('unknown-zone', { timeZone: null, localDate: null })])[0].timeZone, null);
  assert.equal(math.parseWeightChanges([change('project', { entry: { ...entry('project'), hidden: 'never persist' } })])[0].entry.hidden, undefined);

  const db = database();
  const server = runtime({ sql: db.sql });
  const postHandler = server.load('api/history-sync.ts').default;
  const getHandler = server.load('api/workout-context.ts').default;
  const post = body => request(postHandler, { method: 'POST', headers: {}, body });
  const get = (url = '/api/workout-context', headers = { host }, method = 'GET') => request(getHandler, { method, headers, url });
  let result = await get();
  assert.equal(result.body.weightTracking.status, 'not_synced');
  assert.equal(result.body.weightTracking.totalEntries, null);
  await post(payload());
  assert.equal((await get()).body.weightTracking.status, 'not_synced');
  result = await post(payload([change('alpha')]));
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.acknowledgedWeightChanges, ['mutation-alpha']);
  assert(!JSON.stringify(result.body).includes('170.2'), 'public sync must not disclose stored weight');
  assert(!Object.hasOwn(result.body, 'weightTracking'));
  assert.equal(db.rows.get(owner(profileA)).weight_tracking.records.alpha.unit, 'lbs');
  const revision = result.body.revision;
  await post(payload([change('alpha')]));
  assert.equal(db.rows.get(owner(profileA)).revision, revision, 'retry is idempotent');
  const beforeLegacy = JSON.stringify(db.rows.get(owner(profileA)).weight_tracking);
  await post({ ...payload(), protocolVersion: 1 });
  assert.equal(JSON.stringify(db.rows.get(owner(profileA)).weight_tracking), beforeLegacy, 'legacy clients preserve weights');
  db.conflictNext();
  await post(payload([change('beta', { entry: entry('beta', 'kg', '2026-11-02T23:30:00-05:00') })]));
  result = await get('/api/workout-context?limit=20&weightLimit=1');
  assert.equal(result.body.returnedSessions, 0);
  assert.equal(result.body.weightTracking.totalEntries, 2);
  assert.equal(result.body.weightTracking.returnedEntries, 1);
  assert.equal(result.body.weightTracking.nextOffset, 1);
  assert.equal(result.body.weightTracking.entries[0].unit, 'kg');
  assert.equal(result.body.weightTracking.entries[0].date, '2026-11-02T23:30:00-05:00');
  assert.equal(result.headers['Cache-Control'], 'private, no-store');
  assert.equal(result.headers['X-Robots-Tag'], 'noindex, nofollow');
  result = await get('/api/workout-context?weightLimit=1&weightOffset=1');
  assert.equal(result.body.weightTracking.entries[0].id, 'alpha');
  assert.equal(result.body.weightTracking.nextOffset, null);
  assert.equal((await get('/api/workout-context?weightLimit=9999&weightOffset=-1')).body.weightTracking.limit, 200);
  const nonce = 'ab'.repeat(16);
  const expires = String(Date.now() + 60_000);
  const token = createHmac('sha256', 'synthetic-only').update(`circuit-workout-context-log:${nonce}:${expires}`).digest('hex');
  const logHandler = server.load('api/workout-context-log.ts').default;
  result = await request(logHandler, { method: 'GET', url: `/api/workout-context-log?nonce=${nonce}&expires=${expires}&token=${token}` });
  assert.equal(result.status, 200);
  assert(!JSON.stringify(result).includes('170.2'));
  assert(!JSON.stringify(server.logs).includes('170.2'), 'legacy log export must not emit weight records');

  const queryCount = db.queries.length;
  for (const headers of [{ host: 'circuit-five.vercel.app' }, {},
    { host: 'circuit-five.vercel.app', 'x-forwarded-host': host }]) {
    assert.equal((await get('/', headers)).status, 404);
  }
  assert.equal((await get('/', { host }, 'POST')).status, 405);
  assert.equal(db.queries.length, queryCount, 'denied requests perform no data access');
  const noDeployment = runtime({ sql: db.sql, env: { VERCEL_URL: '' } }).load('api/workout-context.ts').default;
  assert.equal((await request(noDeployment, { method: 'GET', headers: { host } })).status, 404);
  assert.equal((await post(payload([change('bad', { entry: { ...entry('bad'), weight: 0 } })]))).status, 400);
  assert.equal((await request(postHandler, { method: 'POST', headers: { origin: 'https://untrusted.invalid' }, body: payload([change('bad')]) })).status, 403);

  await post(payload([change('bravo', { entry: entry('bravo', 'kg') })], profileB));
  db.rows.get(owner(profileA)).history.sessions = [{ id: 'workout-alpha' }];
  db.rows.get(owner(profileB)).history.sessions = [{ id: 'workout-bravo' }];
  result = await get();
  assert.equal(result.body.weightTracking.status, 'owner_ambiguous');
  assert.deepEqual(result.body.weightTracking.entries, []);
  assert.equal(result.body.weightTracking.totalEntries, null);
  assert.equal(result.body.sessions[0].session.id, 'workout-bravo', 'legacy latest workout selection remains intact');
  assert.equal(db.rows.get(owner(profileA)).weight_tracking.records.bravo, undefined);
  const pinned = runtime({ sql: db.sql, env: { CIRCUIT_CONTEXT_OWNER_HASH: owner(profileA) } }).load('api/workout-context.ts').default;
  result = await request(pinned, { method: 'GET', headers: { host }, url: '/api/workout-context?owner_hash=' + owner(profileB) });
  assert.deepEqual(result.body.weightTracking.entries.map(e => e.id).sort(), ['alpha', 'beta']);
  assert.equal(result.body.sessions[0].session.id, 'workout-alpha', 'pinned workouts and weights use the same owner');
  db.rows.get(owner(profileA)).history.sessions = [];
  db.rows.get(owner(profileB)).history.sessions = [];
  for (const pin of ['invalid', owner('missing-synthetic-owner')]) {
    const handler = runtime({ sql: db.sql, env: { CIRCUIT_CONTEXT_OWNER_HASH: pin } }).load('api/workout-context.ts').default;
    result = await request(handler, { method: 'GET', headers: { host } });
    assert.equal(result.body.weightTracking.status, 'owner_mismatch');
    assert.deepEqual(result.body.weightTracking.entries, []);
  }
  const deleted = change('bravo', { mutationId: 'deletion-bravo', changedAt: '2026-11-04T12:00:00Z', entry: null, localDate: null });
  await post(payload([deleted], profileB));
  await post(payload([change('bravo')], profileB));
  assert.deepEqual(db.rows.get(owner(profileB)).weight_tracking.records, {}, 'stale writes cannot resurrect deletion');
  const empty = math.weightContext(db.rows.get(owner(profileB)).weight_tracking, new URL('https://synthetic.invalid'), 'available', 'sync-time');
  assert.equal(empty.totalEntries, 0);
  assert.equal(empty.status, 'available');
  assert(!JSON.stringify(server.logs).includes('170.2'));
  const broken = runtime({ sql: () => { throw new Error('synthetic sensitive weight 170.2'); } });
  assert.equal((await request(broken.load('api/workout-context.ts').default, { method: 'GET', headers: { host } })).status, 503);
  assert(!JSON.stringify(broken.logs).includes('170.2'));

  // Start with legacy local data. Hydration/import and editing legacy entries
  // do not enqueue backfill; only new explicit saves become tracked records.
  const disk = new Map([['weight-storage', JSON.stringify({ version: 0, state: { entries: [entry('legacy')] } })]]);
  const client = runtime({ disk });
  const weights = client.load('src/stores/useWeightStore.ts');
  const store = weights.useWeightStore;
  await store.persist.rehydrate();
  assert.deepEqual(store.getState().pendingByOwner, {});
  store.getState().updateEntry('legacy', { weight: 169 });
  assert.deepEqual(store.getState().pendingByOwner, {});
  store.setState({ entries: [entry('imported')] });
  assert.deepEqual(store.getState().pendingByOwner, {});
  store.getState().addEntry(entry('fresh'));
  await weights.flushWeightStorage();
  assert.deepEqual(Object.keys(store.getState().pendingByOwner[profileA]), ['fresh']);
  const firstMutation = store.getState().pendingByOwner[profileA].fresh.mutationId;
  store.getState().updateEntry('fresh', { weight: 168, id: 'must-not-change-id' });
  store.getState().acknowledgeChanges(profileA, [firstMutation]);
  assert.equal(store.getState().pendingByOwner[profileA].fresh.entry.id, 'fresh');
  assert.equal(store.getState().pendingByOwner[profileA].fresh.entry.weight, 168, 'ack must retain edits made during upload');
  client.user.setState({ profile: { id: profileB } });
  store.getState().updateEntry('fresh', { weight: 167 });
  assert.equal(store.getState().pendingByOwner[profileB], undefined, 'profile change cannot reassign tracked entries');
  store.getState().addEntry(entry('fresh-bravo', 'kg'));
  await weights.flushWeightStorage();
  assert.deepEqual(Object.keys(store.getState().pendingByOwner[profileB]), ['fresh-bravo']);
  const reload = runtime({ disk });
  const reloaded = reload.load('src/stores/useWeightStore.ts').useWeightStore;
  await reloaded.persist.rehydrate();
  assert(reloaded.getState().pendingByOwner[profileA].fresh, 'offline queue survives reload');

  const networkDb = database();
  const networkServer = runtime({ sql: networkDb.sql }).load('api/history-sync.ts').default;
  let offline = true;
  let loseAck = false;
  let inFlightEdit;
  const sent = [];
  const network = runtime({ disk, fetcher: async (_url, opts) => {
    if (offline) throw new Error('Synthetic offline');
    const body = JSON.parse(opts.body); sent.push(body);
    const reply = await request(networkServer, { method: 'POST', headers: {}, body });
    if (inFlightEdit) { const fn = inFlightEdit; inFlightEdit = undefined; fn(); }
    if (loseAck) { loseAck = false; throw new Error('Synthetic lost acknowledgement'); }
    return { ok: reply.status === 200, json: async () => reply.body };
  } });
  const networkWeights = network.load('src/stores/useWeightStore.ts');
  await networkWeights.useWeightStore.persist.rehydrate();
  await network.load('src/stores/useHistoryStore.ts').useHistoryStore.persist.rehydrate();
  const sync = network.load('src/services/historySync.ts');
  await assert.rejects(sync.syncHistoryToCloud(), /offline/);
  assert(networkWeights.useWeightStore.getState().pendingByOwner[profileA].fresh);
  offline = false; loseAck = true;
  await assert.rejects(sync.syncHistoryToCloud(), /acknowledgement/);
  const savedRevision = networkDb.rows.get(owner(profileA)).revision;
  await sync.syncHistoryToCloud();
  assert.equal(networkDb.rows.get(owner(profileA)).revision, savedRevision);
  assert.deepEqual(networkWeights.useWeightStore.getState().pendingByOwner[profileA], {});
  assert(networkWeights.useWeightStore.getState().pendingByOwner[profileB]['fresh-bravo']);
  assert(sent.every(body => !body.weightChanges?.some(change => change.id === 'fresh-bravo')));
  networkWeights.useWeightStore.getState().addEntry(entry('during-upload'));
  inFlightEdit = () => networkWeights.useWeightStore.getState().updateEntry('during-upload', { weight: 165.1 });
  await sync.syncHistoryToCloud();
  assert.equal(networkWeights.useWeightStore.getState().pendingByOwner[profileA]['during-upload'].entry.weight, 165.1);
  await sync.syncHistoryToCloud();
  assert.equal(networkDb.rows.get(owner(profileA)).weight_tracking.records['during-upload'].weight, 165.1);
  networkWeights.useWeightStore.getState().removeEntry('during-upload');
  await sync.syncHistoryToCloud();
  assert.equal(networkDb.rows.get(owner(profileA)).weight_tracking.records['during-upload'], undefined);
  const failedDisk = runtime({ failDisk: true });
  const failedWeights = failedDisk.load('src/stores/useWeightStore.ts');
  await failedWeights.useWeightStore.persist.rehydrate();
  failedWeights.useWeightStore.getState().addEntry(entry('disk-error'));
  await assert.rejects(failedWeights.flushWeightStorage(), /full disk/);

  // Reproduce the restart report with a full legacy store, then let a stale
  // tab acknowledge an older mutation after a newer write from another tab.
  const legacy = entry('pre-update', 'lbs', '2026-11-02T14:00:00Z');
  const third = entry('nov-3', 'lbs', '2026-11-03T14:00:00Z');
  const fourth = entry('nov-4', 'lbs', '2026-11-04T14:00:00Z');
  const oldSnapshot = JSON.stringify({ version: 0, state: { entries: [legacy] } });
  const web = { indexedDB: new IDBFactory(), failDisk: true, disk: new Map([['weight-storage', oldSnapshot]]) };
  const openTab = async () => {
    const app = runtime(web);
    const { useWeightStore: store, flushWeightStorage: flush, ensureWeightHistoryLoaded } = app.load('src/stores/useWeightStore.ts');
    await ensureWeightHistoryLoaded();
    return { app, store, flush };
  };
  const tabA = await openTab();
  tabA.store.getState().addEntry(third);
  await tabA.flush();
  const ack = tabA.store.getState().pendingByOwner[profileA][third.id].mutationId;
  const tabB = await openTab();
  tabB.store.getState().updateEntry(third.id, { weight: 168.1 });
  tabB.store.getState().addEntry(fourth);
  await tabB.flush();
  tabA.store.getState().acknowledgeChanges(profileA, [ack]);
  await tabA.flush();
  const reopened = await openTab();
  let state = reopened.store.getState();
  assert.deepEqual(state.entries.map(e => e.id), [fourth.id, third.id, legacy.id]);
  assert.equal(state.pendingByOwner[profileA][third.id].entry.weight, 168.1);
  assert(state.pendingByOwner[profileA][fourth.id]);
  assert.equal(web.disk.get('weight-storage'), oldSnapshot, 'legacy recovery copy is unchanged');
  const restore = reopened.app.load('src/utils/weightRecovery.ts').restoreMissingWeights;
  const missing = entry('missing', 'lbs', '2026-11-01T14:00:00Z');
  assert.equal(await restore([missing, { ...third, id: 'same-day', weight: 155 }]), 1);
  assert.equal(await restore([missing]), 0);
  await assert.rejects(restore([{ ...missing, weight: 0 }]));
  state = (await openTab()).store.getState();
  assert.equal(state.entries.length, 4);
  assert.equal(state.entries.find(e => e.id === third.id).weight, 168.1);
  assert(!state.pendingByOwner[profileA][missing.id], 'local restore does not re-upload data');

  // The scheduler starts only after hydration, sends no historical weights,
  // and notices a new weigh-in even with no workout changes.
  const scheduled = runtime();
  const scheduledWeights = scheduled.load('src/stores/useWeightStore.ts').useWeightStore;
  await scheduledWeights.persist.rehydrate();
  await scheduled.load('src/stores/useHistoryStore.ts').useHistoryStore.persist.rehydrate();
  const stop = scheduled.load('src/services/historySync.ts').initializeHistorySync();
  assert([...scheduled.timers.values()].some(timer => timer.ms === 0));
  scheduledWeights.getState().addEntry(entry('scheduled'));
  assert([...scheduled.timers.values()].some(timer => timer.ms === 1500));
  stop();
  assert.equal(scheduled.timers.size, 0);

  // Older deployments may omit acknowledgements; retain the queue for retry.
  const oldServer = runtime({ fetcher: async () => ({ ok: true, json: async () => ({ ok: true, protocolVersion: 2, history }) }) });
  const oldWeights = oldServer.load('src/stores/useWeightStore.ts').useWeightStore;
  await oldWeights.persist.rehydrate();
  await oldServer.load('src/stores/useHistoryStore.ts').useHistoryStore.persist.rehydrate();
  oldWeights.getState().addEntry(entry('not-acknowledged'));
  await oldServer.load('src/services/historySync.ts').syncHistoryToCloud();
  assert(oldWeights.getState().pendingByOwner[profileA]['not-acknowledged']);

  console.log('PASS: prospective queue, imports, reload, profile isolation, offline retry, lost acknowledgements, concurrent edits, deletion, units/dates/DST, missing vs empty, validation, CAS retry, old clients, public denial/no disclosure, owner ambiguity/pinning, pagination, redacted errors. Synthetic data only; no network/database access.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
