const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { IDBFactory } = require('fake-indexeddb');
const root = path.resolve(__dirname, '..');

function runtime({ database = new IDBFactory(), disk = new Map(), fetcher, native = false } = {}) {
  const cache = new Map();
  const user = require('zustand').create(() => ({ profile: { id: 'history-regression-profile' } }));
  user.persist = { hasHydrated: () => true, onFinishHydration: () => () => {} };
  function load(file) {
    file = path.resolve(root, file);
    if (!path.extname(file)) file += '.ts';
    if (cache.has(file)) return cache.get(file).exports;
    const module = { exports: {} }; cache.set(file, module);
    const localRequire = name => {
      if (name === 'react-native') return { Platform: { OS: native ? 'ios' : 'web' }, AppState: { addEventListener: () => ({ remove() {} }) } };
      if (name === '@react-native-async-storage/async-storage') return { getItem: async key => disk.get(key) ?? null, setItem: async () => { throw new DOMException('Full', 'QuotaExceededError'); } };
      if (name === '@/stores/useUserStore') return { useUserStore: user };
      if (name.startsWith('@/')) return load('src/' + name.slice(2));
      if (name.startsWith('.')) return load(path.resolve(path.dirname(file), name));
      return require(name);
    };
    const source = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, esModuleInterop: true } }).outputText;
    new Function('module', 'exports', 'require', 'indexedDB', 'fetch', 'window', source)(
      module, module.exports, localRequire, database, fetcher, { addEventListener() {}, removeEventListener() {} });
    return module.exports;
  }
  return { load, disk, database };
}

const math = runtime().load('src/utils/historyMerge.ts');
function session(id, date = '2026-10-19') {
  return { id, workoutId: id, status: 'completed', startedAt: date + 'T12:00:00Z', completedAt: date + 'T12:30:00Z', completedItems: 1, totalItems: 1, percentComplete: 100, actualDurationWorked: 1800, estimatedCaloriesBurned: 200,
    workout: { id, name: `Regression ${id}`, createdAt: date + 'T10:00:00Z', circuits: [], warmUp: { exercises: [] }, coolDown: { exercises: [] } } };
}
const data = sessions => ({ history: math.historyFromSessions(sessions), deletedSessions: {} });
const ids = value => Array.from(value.history.sessions, s => s.id).sort();

async function unit() {
  const completed = { ...session('same'), feedback: { notes: 'Keep this', rpe: 7, updatedAt: '2026-10-19T13:00:00Z' } };
  const partial = { ...session('same'), status: 'stopped_early', completedAt: undefined, stoppedAt: '2026-10-19T12:10:00Z', actualDurationWorked: 600 };
  const merged = math.mergeHistory(data([completed]), data([partial]));
  assert.equal(merged.history.sessions.length, 1);
  assert.equal(merged.history.sessions[0].status, 'completed');
  assert.equal(merged.history.sessions[0].feedback.notes, 'Keep this');
  assert.equal(merged.history.totalMinutesWorked, 30);
  const removed = math.mergeHistory(merged, { ...data([]), deletedSessions: { same: '2026-10-19T14:00:00Z' } });
  assert.equal(math.mergeHistory(removed, data([completed])).history.sessions.length, 0);
  const gps = { ...completed, ride: { points: [{ lat: 1, lon: 2 }] } };
  assert.equal(math.mergeHistory(data([gps]), data([{ ...gps, ride: { points: [] } }])).history.sessions[0].ride.points.length, 1);

  // Real IndexedDB transactions (fake-indexeddb implements the IndexedDB API),
  // two independent app runtimes, and a full legacy localStorage write path.
  const disk = new Map([['history-storage', JSON.stringify({ state: data([session('oct8', '2026-10-08')]), version: 0 })]]);
  const database = new IDBFactory();
  const a = runtime({ database, disk });
  const b = runtime({ database, disk });
  const first = a.load('src/stores/useHistoryStore.ts').useHistoryStore;
  const second = b.load('src/stores/useHistoryStore.ts').useHistoryStore;
  await Promise.all([first.persist.rehydrate(), second.persist.rehydrate()]);
  first.getState().addSession(session('friday', '2026-10-16'));
  second.getState().addSession(session('sunday', '2026-10-18'));
  await Promise.all([a.load('src/services/historyStorage.ts').flushHistoryStorage(), b.load('src/services/historyStorage.ts').flushHistoryStorage()]);
  const c = runtime({ database, disk });
  const reloaded = c.load('src/stores/useHistoryStore.ts').useHistoryStore;
  await reloaded.persist.rehydrate();
  assert.deepEqual(ids(reloaded.getState()), ['friday', 'oct8', 'sunday']);
  assert.equal(JSON.parse(disk.get('history-storage')).state.history.sessions.length, 1, 'legacy backup retained');
  reloaded.getState().addSession(partial);
  reloaded.getState().addSession(completed);
  reloaded.getState().removeSession('friday');
  await c.load('src/services/historyStorage.ts').flushHistoryStorage();
  first.getState().addSession(session('monday'));
  await a.load('src/services/historyStorage.ts').flushHistoryStorage();
  await reloaded.persist.rehydrate();
  assert.deepEqual(ids(reloaded.getState()), ['monday', 'oct8', 'same', 'sunday']);
  const huge = session('large'); huge.workout.description = 'x'.repeat(6 * 1024 * 1024);
  reloaded.getState().addSession(huge);
  await c.load('src/services/historyStorage.ts').flushHistoryStorage();
  const d = runtime({ database, disk });
  const largeReload = d.load('src/stores/useHistoryStore.ts').useHistoryStore;
  await largeReload.persist.rehydrate();
  assert.equal(largeReload.getState().getSessionById('large').workout.description.length, 6 * 1024 * 1024);

  let cloud = data([session('cloud-only')]);
  let offline = false;
  const network = runtime({ fetcher: async (_url, opts) => {
    if (offline) throw new Error('Offline');
    const payload = JSON.parse(opts.body);
    cloud = math.mergeHistory(cloud, payload);
    return { ok: true, json: async () => ({ ok: true, protocolVersion: 2, ...cloud }) };
  } });
  const store = network.load('src/stores/useHistoryStore.ts').useHistoryStore;
  await store.persist.rehydrate();
  store.getState().addSession(session('local-only'));
  const sync = network.load('src/services/historySync.ts');
  await sync.syncHistoryToCloud();
  assert.deepEqual(ids(store.getState()), ['cloud-only', 'local-only']);
  offline = true;
  store.getState().addSession(session('offline'));
  assert.equal(await sync.persistWorkoutHistory(), true, 'offline save is durable locally');
  assert.equal(network.load('src/stores/useHistorySaveStore.ts').useHistorySaveStore.getState().cloud, 'error');
  offline = false;
  await sync.syncHistoryToCloud();
  assert.deepEqual(ids(cloud), ['cloud-only', 'local-only', 'offline']);

  let release;
  let requestCount = 0;
  let concurrentCloud = data([]);
  const gate = new Promise(resolve => { release = resolve; });
  const delayed = runtime({ fetcher: async (_url, opts) => {
    const payload = JSON.parse(opts.body);
    if (++requestCount === 1) await gate;
    concurrentCloud = math.mergeHistory(concurrentCloud, payload);
    return { ok: true, json: async () => ({ ok: true, protocolVersion: 2, ...concurrentCloud }) };
  } });
  const delayedStore = delayed.load('src/stores/useHistoryStore.ts').useHistoryStore;
  await delayedStore.persist.rehydrate();
  delayedStore.getState().addSession(session('first-upload'));
  const delayedSync = delayed.load('src/services/historySync.ts');
  const firstUpload = delayedSync.syncHistoryToCloud();
  delayedStore.getState().addSession(completed);
  const finishing = delayedSync.persistWorkoutHistory();
  release();
  await firstUpload;
  assert.equal(await finishing, true);
  assert.deepEqual(ids(concurrentCloud), ['first-upload', 'same']);
  assert.equal(concurrentCloud.history.sessions.find(s => s.id === 'same').feedback.notes, 'Keep this');

  const failed = runtime({ native: true, fetcher: async () => { throw new Error('Offline'); } });
  const failedStore = failed.load('src/stores/useHistoryStore.ts').useHistoryStore;
  await failedStore.persist.rehydrate();
  failedStore.getState().addSession(session('not-saved'));
  assert.equal(await failed.load('src/services/historySync.ts').persistWorkoutHistory(), false, 'never report success when both destinations fail');
  console.log('PASS: duplicate completion, feedback, deletion, GPS, concurrent tabs, migration, >5 MiB history, reload, cloud readback, offline retry, in-flight completion save, total save failure');
}

async function integration() {
  if (!process.env.CIRCUIT_TEST_DATABASE_URL) return;
  process.env.DATABASE_URL = process.env.CIRCUIT_TEST_DATABASE_URL;
  const crypto = require('node:crypto');
  const profileId = 'circuit-regression-' + crypto.randomUUID();
  const owner = crypto.createHash('sha256').update(profileId).digest('hex');
  const { neon } = require('@neondatabase/serverless');
  const sql = neon(process.env.CIRCUIT_TEST_DATABASE_URL);
  const handler = runtime().load('api/history-sync.ts').default;
  async function post(payload, v = 2) {
    let status, result;
    await handler({ method: 'POST', headers: {}, body: { profileId, protocolVersion: v, ...payload } }, {
      setHeader() {}, status(n) { status = n; return this; }, json(body) { result = body; return this; }, end() {},
    });
    assert.equal(status, 200, JSON.stringify(result));
    return result;
  }
  try {
    await post(data([session('base')]));
    await Promise.all([post(data([session('friday')])), post(data([session('sunday')]))]);
    const stale = await post(data([session('base')]));
    assert.deepEqual(ids(stale), ['base', 'friday', 'sunday']);
    await post({ ...data([]), deletedSessions: { friday: new Date().toISOString() } });
    await post(data([session('friday')]), 1);
    const final = await post(data([]));
    assert.deepEqual(ids(final), ['base', 'sunday']);
    const archived = await sql`SELECT e.revision, jsonb_array_length(e.session_versions) AS count,
      (SELECT count(*) FROM jsonb_array_elements(e.session_versions) v LEFT JOIN circuit_workout_versions w
       ON w.owner_hash = e.owner_hash AND w.session_id = v->>'id' AND w.content_hash = v->>'hash' WHERE w.session_id IS NULL) AS missing
      FROM circuit_history_sync_events e WHERE e.owner_hash = ${owner} ORDER BY e.revision`;
    assert.ok(archived.length >= 5);
    assert.ok(archived.every(r => Number(r.missing) === 0), 'every archived manifest is reconstructable');
    console.log('PASS: Neon real transactions, concurrent CAS retry, stale legacy writes, explicit deletion, exact revision reconstruction', JSON.stringify(archived));
  } finally {
    // Only this newly generated disposable test profile is removed.
    await sql.transaction([
      sql`DELETE FROM circuit_history_sync_events WHERE owner_hash = ${owner}`,
      sql`DELETE FROM circuit_workout_versions WHERE owner_hash = ${owner}`,
      sql`DELETE FROM circuit_history_snapshots WHERE owner_hash = ${owner}`,
    ]);
  }
}
unit().then(integration).catch(error => { console.error(error); process.exitCode = 1; });
