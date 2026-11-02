const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const ts = require('typescript');
const { inspectText, scan } = require('./check-secrets.cjs');

(async () => {
  const fakeKey = ['sk', 'or', 'v1', 'a'.repeat(64)].join('-');
  const badName = ['EXPO', 'PUBLIC', 'OPENROUTER', 'API', 'KEY'].join('_');
  assert.equal(inspectText(fakeKey, 'app.js').length, 1);
  assert.equal(inspectText(`process.env.${badName}`, 'app.js', true).length, 1);
  assert.equal(inspectText('process.env.EXPO_PUBLIC_API_URL', 'app.js', true).length, 0);
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'circuit-security-'));
  try {
    fs.mkdirSync(path.join(root, 'dist'));
    fs.writeFileSync(path.join(root, '.env.local'), `${badName}=${fakeKey}`);
    fs.writeFileSync(path.join(root, 'dist', 'app.js'), `const value = "${fakeKey}";`);
    const result = scan(root, 'dist');
    assert(result.findings.some(x => x.rule.startsWith('Public secret variable')));
    assert(result.findings.some(x => x.rule === 'OpenRouter credential'));
    assert(result.findings.some(x => x.rule === 'Configured private environment value in bundle'));
    assert(!JSON.stringify(result).includes(fakeKey));
    fs.writeFileSync(path.join(root, '.env.local'), '');
    fs.writeFileSync(path.join(root, 'dist', 'app.js'), 'console.log("safe")');
    assert.equal(scan(root, 'dist').findings.length, 0);
    assert.throws(() => scan(root, 'missing'));
  } finally {
    // Only the exact temporary test directory created above; no project data.
    assert.equal(path.dirname(fs.realpathSync(root)), fs.realpathSync(os.tmpdir()));
    assert(path.basename(root).startsWith('circuit-security-'));
    fs.rmSync(root, { recursive: true, force: true });
  }
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/services/openrouter/request.ts'), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText;
  const mod = { exports: {} };
  new Function('exports', 'module', code)(mod.exports, mod);
  const oldFetch = global.fetch;
  let networkCalls = 0;
  global.fetch = async () => { networkCalls++; throw new Error('Unexpected network request'); };
  try {
    assert.equal(mod.exports.AI_FEATURES_AVAILABLE, false);
    await assert.rejects(mod.exports.requestAICompletion({}), /temporarily paused/);
    assert.equal(networkCalls, 0);
  } finally { global.fetch = oldFetch; }
  console.log('Security regression checks passed: source, env, bundle, redaction, fail-closed AI without network.');
})().catch(error => { console.error(error.message); process.exitCode = 1; });
