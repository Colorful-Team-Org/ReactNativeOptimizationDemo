#!/usr/bin/env node
// Interactive setup for the ReactNativeOptimizationDemo repo.
// Idempotent: running with all defaults accepted leaves files untouched.

const fs = require('fs');
const path = require('path');
const readline = require('readline');
const { spawnSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(ROOT, '.env');
const BASE_DIR = path.join(ROOT, 'ContentfulDemoBase');
const OPT_DIR = path.join(ROOT, 'ContentfulDemoOptimized');

const ENV_VARS = [
  { key: 'CONTENTFUL_SPACE_ID', label: 'Contentful Space ID' },
  { key: 'CONTENTFUL_ACCESS_TOKEN', label: 'Contentful Delivery API access token', secret: true },
  { key: 'CONTENTFUL_ENVIRONMENT', label: 'Contentful environment', fallback: 'master' },
  { key: 'OPTIMIZATION_CLIENT_ID', label: 'Optimization client ID (UUID)' },
  { key: 'OPTIMIZATION_ENVIRONMENT', label: 'Optimization environment', fallback: 'main' },
];

const OPT_PACKAGES = [
  { name: '@contentful/optimization-react-native', subpath: 'packages/react-native-sdk' },
  { name: '@contentful/optimization-core', subpath: 'packages/universal/core-sdk' },
  { name: '@contentful/optimization-preview', subpath: 'packages/universal/preview-sdk' },
  { name: '@contentful/optimization-api-client', subpath: 'packages/universal/api-client' },
  { name: '@contentful/optimization-api-schemas', subpath: 'packages/universal/api-schemas' },
];

const NPM_PRIMARY_PACKAGE = '@contentful/optimization-react-native';
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
const ask = (q) => new Promise((resolve) => rl.question(q, (a) => resolve(a)));

// ANSI colors. Disabled automatically when stdout is not a TTY or NO_COLOR is set.
const useColor = process.stdout.isTTY && !process.env.NO_COLOR;
const wrap = (open, close) => (s) => useColor ? `\x1b[${open}m${s}\x1b[${close}m` : String(s);
const c = {
  reset: '\x1b[0m',
  bold: wrap(1, 22),
  dim: wrap(2, 22),
  italic: wrap(3, 23),
  underline: wrap(4, 24),
  red: wrap(31, 39),
  green: wrap(32, 39),
  yellow: wrap(33, 39),
  blue: wrap(34, 39),
  magenta: wrap(35, 39),
  cyan: wrap(36, 39),
  gray: wrap(90, 39),
};

function log(msg) { process.stdout.write(msg + '\n'); }
function logTitle(msg) { log('\n' + c.bold(c.magenta(msg))); }
function logSection(title) { log('\n' + c.bold(c.cyan(`— ${title} —`))); }
function logHint(msg) { log(c.dim(msg)); }
function warn(msg) { process.stdout.write(`  ${c.yellow('!')} ${c.yellow(msg)}\n`); }
function ok(msg) { process.stdout.write(`  ${c.green('✓')} ${msg}\n`); }
function fail(msg) { process.stdout.write(`  ${c.red('✖')} ${c.red(msg)}\n`); }
function okInline() { process.stdout.write(c.green('ok') + '\n'); }
function failInline() { process.stdout.write(c.red('fail') + '\n'); }

function parseDotenv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const out = {};
  for (const rawLine of fs.readFileSync(filePath, 'utf8').split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    out[key] = val;
  }
  return out;
}

function serializeDotenv(vars) {
  return ENV_VARS.map(({ key }) => `${key}=${vars[key] ?? ''}`).join('\n') + '\n';
}

function loadExistingEnv() {
  if (fs.existsSync(ENV_PATH)) return parseDotenv(ENV_PATH);
  // Migrate from per-project .env files if present.
  return {
    ...parseDotenv(path.join(BASE_DIR, '.env')),
    ...parseDotenv(path.join(OPT_DIR, '.env')),
  };
}

function maskSecret(v) {
  if (!v) return '';
  if (v.length <= 8) return '•'.repeat(v.length);
  return v.slice(0, 4) + '…' + v.slice(-4);
}

async function promptVars(initial) {
  const vars = { ...initial };
  logSection('Environment variables');
  logHint('Press enter to keep the existing value shown in [brackets].');
  for (const v of ENV_VARS) {
    const current = vars[v.key] ?? v.fallback ?? '';
    const shown = v.secret ? maskSecret(current) : current;
    const suffix = current ? ` ${c.dim(`[${shown}]`)}` : '';
    while (true) {
      const answer = (await ask(`${c.bold(v.label)}${suffix}${c.dim(':')} `)).trim();
      const value = answer || current;
      if (!value) { fail(`${v.key} is required`); continue; }
      vars[v.key] = value;
      break;
    }
  }
  return vars;
}

async function validateEnv(vars) {
  let allOk = true;

  process.stdout.write(`  ${c.gray('·')} Checking Contentful space + token… `);
  try {
    const spaceRes = await fetch(
      `https://cdn.contentful.com/spaces/${encodeURIComponent(vars.CONTENTFUL_SPACE_ID)}?access_token=${encodeURIComponent(vars.CONTENTFUL_ACCESS_TOKEN)}`,
    );
    if (spaceRes.status === 200) {
      okInline();
    } else if (spaceRes.status === 401) {
      failInline();
      fail('Contentful access token rejected (401). Check CONTENTFUL_ACCESS_TOKEN.');
      allOk = false;
    } else if (spaceRes.status === 404) {
      failInline();
      fail('Contentful space not found (404). Check CONTENTFUL_SPACE_ID.');
      allOk = false;
    } else {
      failInline();
      fail(`Contentful returned HTTP ${spaceRes.status}.`);
      allOk = false;
    }
  } catch (err) {
    failInline();
    fail(`Could not reach cdn.contentful.com: ${err.message}`);
    allOk = false;
  }

  if (allOk) {
    process.stdout.write(`  ${c.gray('·')} Checking Contentful environment… `);
    try {
      const envRes = await fetch(
        `https://cdn.contentful.com/spaces/${encodeURIComponent(vars.CONTENTFUL_SPACE_ID)}/environments/${encodeURIComponent(vars.CONTENTFUL_ENVIRONMENT)}/content_types?access_token=${encodeURIComponent(vars.CONTENTFUL_ACCESS_TOKEN)}&limit=1`,
      );
      if (envRes.status === 200) {
        okInline();
      } else if (envRes.status === 404) {
        failInline();
        fail(`Contentful environment "${vars.CONTENTFUL_ENVIRONMENT}" not found in space. Check CONTENTFUL_ENVIRONMENT.`);
        allOk = false;
      } else {
        failInline();
        fail(`Contentful env probe returned HTTP ${envRes.status}.`);
        allOk = false;
      }
    } catch (err) {
      failInline();
      fail(`Could not reach cdn.contentful.com: ${err.message}`);
      allOk = false;
    }
  }

  process.stdout.write(`  ${c.gray('·')} Checking Optimization client ID format… `);
  if (UUID_RE.test(vars.OPTIMIZATION_CLIENT_ID)) {
    okInline();
  } else {
    failInline();
    fail('OPTIMIZATION_CLIENT_ID must be a UUID.');
    allOk = false;
  }

  process.stdout.write(`  ${c.gray('·')} Checking Optimization environment… `);
  if (vars.OPTIMIZATION_ENVIRONMENT && /^[A-Za-z0-9_-]+$/.test(vars.OPTIMIZATION_ENVIRONMENT)) {
    okInline();
  } else {
    failInline();
    fail('OPTIMIZATION_ENVIRONMENT must be a non-empty identifier.');
    allOk = false;
  }

  return allOk;
}

async function promptEnvUntilValid(initial) {
  let vars = await promptVars(initial);
  while (true) {
    const isValid = await validateEnv(vars);
    if (isValid) return vars;
    log('\n' + c.yellow('Fix the values above.'));
    vars = await promptVars(vars);
  }
}

function writeFileIfChanged(filePath, content) {
  if (fs.existsSync(filePath) && fs.readFileSync(filePath, 'utf8') === content) return false;
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, content);
  return true;
}

function detectSdkMode(pkgJson) {
  const entry = pkgJson.dependencies?.[NPM_PRIMARY_PACKAGE];
  if (!entry) return { mode: 'latest', value: 'latest' };
  if (entry.startsWith('file:')) return { mode: 'filesystem', value: entry.slice(5).replace(/\/packages\/react-native-sdk\/?$/, '') };
  if (entry === 'latest') return { mode: 'latest', value: 'latest' };
  return { mode: 'specific', value: entry };
}

async function promptSdkSource(current) {
  logSection('Optimization SDK source');
  log(`  ${c.bold(c.blue('1)'))} Latest published release on npm`);
  log(`  ${c.bold(c.blue('2)'))} A specific release version or commit hash`);
  log(`  ${c.bold(c.blue('3)'))} A local checkout of the optimization monorepo`);
  const defaultChoice = current.mode === 'filesystem' ? '3' : current.mode === 'specific' ? '2' : '1';
  const choice = ((await ask(`${c.bold('Choose')} ${c.dim('[1/2/3]')} ${c.dim(`[${defaultChoice}]`)}${c.dim(':')} `)).trim() || defaultChoice);

  if (choice === '1') {
    return { mode: 'latest', value: 'latest' };
  }

  if (choice === '2') {
    const existing = current.mode === 'specific' ? current.value : '';
    const suffix = existing ? ` ${c.dim(`[${existing}]`)}` : '';
    while (true) {
      const raw = (await ask(`${c.bold('Version')} ${c.dim('(e.g. 0.1.0-alpha12)')} or commit hash${suffix}${c.dim(':')} `)).trim() || existing;
      if (!raw) { fail('Value is required.'); continue; }
      // Commit hashes get a github ref; everything else is used verbatim (npm semver).
      const value = /^[0-9a-f]{7,40}$/i.test(raw)
        ? `github:contentful/optimization#${raw}`
        : raw;
      return { mode: 'specific', value };
    }
  }

  if (choice === '3') {
    const existing = current.mode === 'filesystem' ? current.value : '/Users/you/github/optimization';
    while (true) {
      const raw = (await ask(`${c.bold('Absolute path to the optimization repo')} ${c.dim(`[${existing}]`)}${c.dim(':')} `)).trim() || existing;
      const resolved = path.resolve(raw.replace(/^~/, process.env.HOME || ''));
      const rnPkg = path.join(resolved, 'packages/react-native-sdk/package.json');
      if (!fs.existsSync(rnPkg)) {
        fail(`No packages/react-native-sdk/package.json at ${resolved}.`);
        continue;
      }
      return { mode: 'filesystem', value: resolved };
    }
  }

  fail('Invalid choice.');
  return promptSdkSource(current);
}

function buildOptPackageJson(prev, sdk) {
  const next = JSON.parse(JSON.stringify(prev));
  next.dependencies = next.dependencies || {};

  // Remove any existing optimization-* file refs first so mode switches stay clean.
  for (const p of OPT_PACKAGES) delete next.dependencies[p.name];

  if (sdk.mode === 'filesystem') {
    for (const p of OPT_PACKAGES) {
      next.dependencies[p.name] = `file:${path.join(sdk.value, p.subpath)}`;
    }
  } else {
    next.dependencies[NPM_PRIMARY_PACKAGE] = sdk.value;
  }

  // Preserve the ordering convention: optimization-* entries come first.
  const ordered = {};
  for (const p of OPT_PACKAGES) if (next.dependencies[p.name]) ordered[p.name] = next.dependencies[p.name];
  for (const [k, v] of Object.entries(next.dependencies)) if (!(k in ordered)) ordered[k] = v;
  next.dependencies = ordered;

  return next;
}

function buildOptMetroConfig(sdk) {
  if (sdk.mode !== 'filesystem') {
    return `const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro resolves the "browser" condition for packages like \`diary\`
// that ship Node-only code in their default export
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

module.exports = config;
`;
  }

  return `const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Local SDK paths — set by scripts/setup.js
const sdkRoot = ${JSON.stringify(sdk.value)};
const reactNativeSdk = path.join(sdkRoot, 'packages/react-native-sdk');
const coreSdk = path.join(sdkRoot, 'packages/universal/core-sdk');
const previewSdk = path.join(sdkRoot, 'packages/universal/preview-sdk');
const apiClient = path.join(sdkRoot, 'packages/universal/api-client');
const apiSchemas = path.join(sdkRoot, 'packages/universal/api-schemas');

// Ensure Metro resolves the "browser" condition for packages like \`diary\`
// that ship Node-only code in their default export
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

// Watch the local SDK directories so Metro picks up changes
config.watchFolders = [reactNativeSdk, coreSdk, previewSdk, apiClient, apiSchemas];

// Force Metro to resolve shared dependencies from the app's node_modules
// (prevents duplicate react/react-native) and resolve workspace packages
// from the local monorepo
const appNodeModules = path.resolve(__dirname, 'node_modules');
config.resolver.extraNodeModules = {
  react: path.resolve(appNodeModules, 'react'),
  'react-native': path.resolve(appNodeModules, 'react-native'),
  'react-native-get-random-values': path.resolve(appNodeModules, 'react-native-get-random-values'),
  '@react-native-async-storage/async-storage': path.resolve(appNodeModules, '@react-native-async-storage/async-storage'),
  '@react-native-clipboard/clipboard': path.resolve(appNodeModules, '@react-native-clipboard/clipboard'),
  '@react-native-community/netinfo': path.resolve(appNodeModules, '@react-native-community/netinfo'),
  'react-native-safe-area-context': path.resolve(appNodeModules, 'react-native-safe-area-context'),
  '@contentful/optimization-core': coreSdk,
  '@contentful/optimization-preview': previewSdk,
  '@contentful/optimization-api-client': apiClient,
  '@contentful/optimization-api-schemas': apiSchemas,
};

// Block resolution from the SDK's pnpm node_modules for shared dependencies
// by ensuring the app's node_modules is checked first, while still allowing
// SDK-internal dependencies to resolve from the SDK's own node_modules
config.resolver.nodeModulesPaths = [
  appNodeModules,
  path.join(reactNativeSdk, 'node_modules'),
  path.join(coreSdk, 'node_modules'),
  path.join(previewSdk, 'node_modules'),
  path.join(apiClient, 'node_modules'),
  path.join(apiSchemas, 'node_modules'),
];

module.exports = config;
`;
}

function runCmd(cmd, args, cwd, { label } = {}) {
  const rel = path.relative(ROOT, cwd) || '.';
  log(`\n${c.green('$')} ${c.bold(label || `${cmd} ${args.join(' ')}`)}  ${c.dim(`(cwd: ${rel})`)}`);
  const res = spawnSync(cmd, args, { cwd, stdio: 'inherit', env: process.env });
  if (res.status !== 0) {
    throw new Error(`${cmd} ${args.join(' ')} failed with status ${res.status}`);
  }
}

async function main() {
  logTitle('⚡ ReactNativeOptimizationDemo setup');

  // 1. Env vars
  const initialEnv = loadExistingEnv();
  const finalEnv = await promptEnvUntilValid(initialEnv);

  const envContent = serializeDotenv(finalEnv);
  const envChanged = writeFileIfChanged(ENV_PATH, envContent);
  if (envChanged) ok(`${c.bold('Wrote')} ${c.cyan(path.relative(ROOT, ENV_PATH))}`);
  else ok(`${c.cyan(path.relative(ROOT, ENV_PATH))} ${c.dim('unchanged')}`);

  // 2. SDK source selection
  const optPkgPath = path.join(OPT_DIR, 'package.json');
  const optPkg = JSON.parse(fs.readFileSync(optPkgPath, 'utf8'));
  const currentSdk = detectSdkMode(optPkg);
  const sdk = await promptSdkSource(currentSdk);

  const nextOptPkg = buildOptPackageJson(optPkg, sdk);
  const nextOptPkgContent = JSON.stringify(nextOptPkg, null, 2) + '\n';
  const pkgChanged = writeFileIfChanged(optPkgPath, nextOptPkgContent);
  if (pkgChanged) ok(`${c.bold('Updated')} ${c.cyan('ContentfulDemoOptimized/package.json')}`);
  else ok(`${c.cyan('ContentfulDemoOptimized/package.json')} ${c.dim('unchanged')}`);

  const metroPath = path.join(OPT_DIR, 'metro.config.js');
  const metroChanged = writeFileIfChanged(metroPath, buildOptMetroConfig(sdk));
  if (metroChanged) ok(`${c.bold('Updated')} ${c.cyan('ContentfulDemoOptimized/metro.config.js')}`);
  else ok(`${c.cyan('ContentfulDemoOptimized/metro.config.js')} ${c.dim('unchanged')}`);

  // 3. Install dependencies
  logSection('Install dependencies');
  runCmd('npm', ['install'], BASE_DIR, { label: 'npm install (ContentfulDemoBase)' });
  runCmd('npm', ['install'], OPT_DIR, { label: 'npm install (ContentfulDemoOptimized)' });

  // 4. Build (expo prebuild is idempotent)
  logSection('Build');
  runCmd('npx', ['expo', 'prebuild'], OPT_DIR, { label: 'expo prebuild (ContentfulDemoOptimized)' });

  log('\n' + c.bold(c.green('✅ Setup complete.')));
  log('\n' + c.bold('Next steps:'));
  log(`  ${c.cyan('npm run start:base')}                ${c.dim('Base app (Expo Go)')}`);
  log(`  ${c.cyan('npm run start:optimized')}           ${c.dim('Optimized app (iOS native build)')}`);
  log(`  ${c.cyan('npm run start:optimized:android')}   ${c.dim('Optimized app (Android native build)')}`);
}

main()
  .catch((err) => { fail(err.message); process.exitCode = 1; })
  .finally(() => rl.close());
