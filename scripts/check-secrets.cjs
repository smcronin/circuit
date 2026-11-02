#!/usr/bin/env node
// Emit locations and rule names only. Never emit matching credential values.
const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const publicCredentialName = /\b(?:EXPO_PUBLIC_|NEXT_PUBLIC_|VITE_|REACT_APP_|PUBLIC_)[A-Z0-9_]*(?:API_KEY|SECRET|PASSWORD|PRIVATE_KEY|ACCESS_TOKEN|DATABASE_URL)\b/g;
const SECRET_RULES = [
  ['OpenRouter credential', /sk-or-v1-[a-zA-Z0-9_-]{20,}/g],
  ['OpenAI credential', /sk-(?:proj-|svcacct-)[a-zA-Z0-9_-]{20,}/g],
  ['Anthropic credential', /sk-ant-[a-zA-Z0-9_-]{20,}/g],
  ['GitHub credential', /(?:gh[pousr]_[a-zA-Z0-9]{30,}|github_pat_[a-zA-Z0-9_]{30,})/g],
  ['Private key', /-----BEGIN (?:RSA |EC |OPENSSH |DSA )?PRIVATE KEY-----/g],
  ['Database credential URL', /postgres(?:ql)?:\/\/[^\s:/"']+:[^\s@"']+@[^\s"']+/g],
];
const EXCLUDED = new Set(['.git', 'node_modules', '.expo', '.vercel', 'dist', 'web-build', 'coverage', 'tmp', 'temp', '.next']);

function inspectText(text, file, publicReferences = false) {
  const findings = [];
  const rules = publicReferences ? [...SECRET_RULES, ['Public secret variable', publicCredentialName]] : SECRET_RULES;
  for (const [rule, pattern] of rules) {
    pattern.lastIndex = 0;
    for (const match of text.matchAll(pattern)) {
      findings.push({ file, line: text.slice(0, match.index).split('\n').length, rule });
    }
  }
  return findings;
}

function walk(dir, exclude = EXCLUDED) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    if (entry.isSymbolicLink() || exclude.has(entry.name)) return [];
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full, exclude) : entry.isFile() ? [full] : [];
  });
}

function readEnv(root) {
  const env = { ...process.env };
  for (const file of fs.readdirSync(root).filter(name => /^\.env(?:\.|$)/.test(name))) {
    if (!fs.lstatSync(path.join(root, file)).isFile()) continue;
    const content = fs.readFileSync(path.join(root, file), 'utf8');
    for (const line of content.split(/\r?\n/)) {
      const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
      if (!match) continue;
      // Keep every local value for bundle comparison, even when another file overrides it.
      env[`${match[1]}:${file}`] = match[2].replace(/^(['"])(.*)\1$/, '$2');
    }
  }
  return env;
}

function scan(root, bundle) {
  const findings = [];
  const env = readEnv(root);
  for (const [name, value] of Object.entries(env)) {
    publicCredentialName.lastIndex = 0;
    if (value && publicCredentialName.test(name.split(':')[0])) findings.push({ file: 'environment', line: 0, rule: `Public secret variable: ${name}` });
  }
  let files;
  if (bundle) {
    const out = path.resolve(root, bundle);
    if (!fs.existsSync(out) || !fs.statSync(out).isDirectory()) throw new Error('Bundle output directory missing');
    files = walk(out, new Set());
    if (!files.length) throw new Error('Bundle output is empty');
  } else {
    try {
      files = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
        .split('\0').filter(Boolean).map(file => path.join(root, file));
    } catch {
      // Vercel source downloads may omit .git. Scan source without requiring Git.
      files = walk(root).filter(file => !path.basename(file).startsWith('.env'));
    }
  }
  const privateValues = Object.entries(env).filter(([name, value]) =>
    /(?:SECRET|PASSWORD|PRIVATE_KEY|API_KEY|ACCESS_TOKEN|DATABASE_URL|POSTGRES_URL)/i.test(name)
    && typeof value === 'string' && value.length >= 12
  ).map(([, value]) => value);
  for (const file of new Set(files)) {
    if (!fs.existsSync(file) || !fs.lstatSync(file).isFile()) continue;
    const rel = path.relative(root, file).replaceAll('\\', '/');
    if (!bundle && rel.split('/').some(part => EXCLUDED.has(part))) continue;
    const bytes = fs.readFileSync(file);
    const content = bytes.toString('utf8');
    const executable = /\.(?:[cm]?[jt]sx?|json|html|ya?ml|sh|ps1)$/i.test(file);
    findings.push(...inspectText(content, rel, Boolean(bundle) || executable));
    if (bundle && privateValues.some(value => content.includes(value))) findings.push({ file: rel, line: 0, rule: 'Configured private environment value in bundle' });
  }
  return { files: files.length, findings };
}

if (require.main === module) {
  try {
    const arg = process.argv.indexOf('--bundle');
    if (arg !== -1 && !process.argv[arg + 1]) throw new Error('Bundle directory required');
    const result = scan(process.cwd(), arg === -1 ? undefined : process.argv[arg + 1]);
    if (result.findings.length) {
      for (const finding of result.findings) console.error(`${finding.file}:${finding.line}: ${finding.rule}`);
      console.error(`Security gate FAILED: ${result.findings.length} finding(s). No credential values printed.`);
      process.exitCode = 1;
    } else console.log(`Security gate passed (${result.files} files; ${arg === -1 ? 'source and public environment' : 'built artifacts'}).`);
  } catch {
    console.error('Security gate could not complete. Release blocked; inspect file access and scanner setup.');
    process.exitCode = 1;
  }
}

module.exports = { inspectText, scan };
