const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const ts = require('typescript');
const { PGlite } = require('@electric-sql/pglite');
const { IDBFactory } = require('fake-indexeddb');
const { createHash } = require('node:crypto');
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

// Execute the handler's actual SQL in an isolated in-memory PostgreSQL.
async function verifyDatabase() {
  const db = new PGlite();
  try {
    await db.exec(`CREATE TABLE circuit_app_state(singleton boolean primary key, profile jsonb);
      CREATE TABLE circuit_history_snapshots(owner_hash text primary key, weight_tracking jsonb, history jsonb DEFAULT '{"sessions":[]}',
        session_count int DEFAULT 0, workout_summary jsonb, source_updated_at timestamptz, server_updated_at timestamptz);
      CREATE TABLE circuit_workout_sessions(owner_hash text,status text,workout_name text,workout_at timestamptz,duration_seconds int,rpe int,notes text,session jsonb);
      CREATE TABLE circuit_weight_entries(sync_id text unique,source_entry_id text,measured_at timestamptz,weight numeric(8,3) not null,
        unit text not null,notes text,entry_snapshot jsonb,client_updated_at timestamptz,deleted_at timestamptz,updated_at timestamptz default now());`);
    await db.query('INSERT INTO circuit_app_state VALUES (true,$1)', [JSON.stringify({ id: profileA })]);
    const original = entry('imported-from-snapshot','lbs','2026-11-03T13:00:00Z');
    const record = { ...original, localDate: '2026-11-03', updatedAt: original.date, mutationId: 'm1', timeZone: 'America/New_York' };
    await db.query('INSERT INTO circuit_history_snapshots(owner_hash, weight_tracking) VALUES ($1,$2)', [owner(profileA),
      JSON.stringify({ records: { original: record, repeat: { ...record, id:'repeat', updatedAt:'2026-11-03T14:00:00Z' } } })]);
    await db.exec(fs.readFileSync(path.join(root,'db/weight-sync.sql'),'utf8'));
    function sql(parts,...params) {
      const query = parts.reduce((out,p,i) => out+(i?'$'+i:'')+p,'');
      const execute = async client => (await client.query(query,params)).rows;
      return { execute, then(onOk,onError) { return execute(db).then(onOk,onError); } };
    }
    sql.transaction = queries => db.transaction(async tx => {
      const rows=[]; for(const q of queries) rows.push(await q.execute(tx)); return rows;
    });
    const app = runtime({sql});
    const api=app.load('api/weights.ts').default;
    const headers={'content-type':'application/json',host:'circuit.example',origin:'https://circuit.example'};
    const post=(body={}, extra={})=>request(api,{method:'POST',headers:{...headers,...extra},body:{profileId:profileA,...body}});
    const denied = await post();
    assert.equal(denied.status,401); assert(!denied.body.days);
    const cookie=denied.headers['Set-Cookie'].split(';')[0];
    assert.match(denied.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
    await db.query('INSERT INTO circuit_weight_devices(fingerprint,owner_hash) VALUES ($1,$2)',[denied.body.deviceCode,owner(profileA)]);
    assert.equal((await post({profileId:profileB},{cookie})).status,401);
    assert.equal((await post({}, {cookie: '__Host-circuit-weight-device='+denied.body.deviceCode})).status,401);
    assert.equal((await post({}, {cookie,origin:'https://outsider.example'})).status,403);
    const sync=async body=>{const reply=await post(body,{cookie});assert.equal(reply.status,200);return reply.body;};
    let snapshot=await sync({});
    assert.equal(snapshot.days.length,1); assert.equal(snapshot.days[0].entry.id,'repeat');
    const next=change('new',{localDate:'2026-11-04',entry:entry('new','lbs','2026-11-04T12:00:00Z'),changedAt:'2026-11-04T12:00:00Z'});
    const legacy=change('legacy',{localDate:'2026-11-02',entry:entry('legacy','lbs','2026-11-02T12:00:00Z')});
    snapshot=await sync({changes:[next],seeds:[legacy]});
    assert.deepEqual(snapshot.acknowledged,[next.mutationId]);
    assert.deepEqual(snapshot.days.map(d=>d.localDate),['2026-11-04','2026-11-03','2026-11-02']);
    await sync({changes:[next],seeds:[legacy]});
    const fresh=runtime();
    const freshStore=fresh.load('src/stores/useWeightStore.ts').useWeightStore;
    await freshStore.persist.rehydrate();
    const reconcile=fresh.load('src/services/weightDatabase.ts').reconcileWeights;
    reconcile(profileA,await sync({}),[]);
    assert.equal(freshStore.getState().entries.length,3,'empty device hydrates from PostgreSQL');
    freshStore.getState().addEntry({...next.entry, weight:180});
    reconcile(profileA,snapshot,[]);
    assert.equal(freshStore.getState().entries[0].weight,180,'an in-flight read cannot overwrite an offline edit');
    const edit=freshStore.getState().pendingByOwner[profileA].new;
    reconcile(profileA,await sync({changes:[edit]}),[edit]);
    assert(!freshStore.getState().pendingByOwner[profileA].new);
    const newer={...next,changedAt:'2090-11-04T12:00:00Z',mutationId:'del',entry:null};
    await sync({changes:[newer]});
    snapshot=await sync({changes:[next],seeds:[next]});
    assert.equal(snapshot.days[0].entry,null,'neither retry nor legacy import can undo deletion');
    reconcile(profileA,snapshot,[]);
    assert.equal(freshStore.getState().entries.length,2);
    const reader=app.load('api/workout-context.ts').default;
    assert.equal((await request(reader,{method:'GET',headers:{host:'circuit-five.vercel.app'}})).status,404);
    const context=await request(reader,{method:'GET',headers:{host},url:'/?weightLimit=1'});
    assert.equal(context.body.weightTracking.totalEntries,2);
    assert.equal(context.body.weightTracking.entries[0].id,'repeat');
    assert.equal(context.body.weightTracking.nextOffset,1);
  } finally {await db.close();}
}

async function main() {
  const math = runtime().load('src/utils/weightSync.ts');

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

  await verifyDatabase();

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

  console.log('PASS: PostgreSQL weight writes and reads, device approval, migration, retries, deletion, no duplicate dates, offline queue, legacy import and restart.');
}
main().catch(error => { console.error(error); process.exitCode = 1; });
