const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// ─── Local SDK link ──────────────────────────────────────────────────────────
// The app's package.json points @contentful/optimization-react-native at a
// local file: path, which npm turns into a symlink.  Metro needs extra config
// to follow the symlink into the SDK monorepo and resolve its dependencies.

const sdkMonorepo = '/Users/akfreas/freelance/contentful/optimization';
const sdkPackage = path.join(sdkMonorepo, 'platforms/javascript/react-native');
const appNodeModules = path.resolve(__dirname, 'node_modules');

// ─── watchFolders ────────────────────────────────────────────────────────────
// Metro only bundles files inside the project root or watchFolders.  We add
// the entire SDK monorepo so that the SDK dist, its workspace siblings
// (optimization-core), and pnpm-stored transitive deps are all reachable.
config.watchFolders = [sdkMonorepo];

// ─── Condition names ─────────────────────────────────────────────────────────
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

// ─── Module resolution ───────────────────────────────────────────────────────
// Native modules (react, react-native, AsyncStorage, etc.) MUST be singletons
// – only one copy in the bundle.  Everything else the SDK needs lives in the
// pnpm store, reachable through the SDK package's own node_modules symlinks.
//
// Strategy: use a custom resolveRequest that
//   1. Forces singleton native deps to always come from the app.
//   2. For any other module, tries the default resolver first.
//   3. If the default resolver fails AND the request originates from inside the
//      SDK monorepo, retries resolution from the SDK package's node_modules.
//
// This avoids the need to manually enumerate every SDK transitive dependency.

const SINGLETONS = [
  'react',
  'react-native',
  'react/jsx-runtime',
  'react/jsx-dev-runtime',
  'react-native-get-random-values',
  '@react-native-async-storage/async-storage',
  '@react-native-clipboard/clipboard',
  '@react-native-community/netinfo',
];

// Pre-resolve singleton paths once at config time.
const singletonMap = {};
for (const name of SINGLETONS) {
  try {
    singletonMap[name] = path.dirname(
      require.resolve(path.join(name, 'package.json'), { paths: [appNodeModules] }),
    );
  } catch {
    // Optional peer dep not installed – skip.
  }
}

// Helper: given a file path inside the pnpm store, walk up to find the nearest
// node_modules directory so we can use it as a resolution root.
function findNearestNodeModules(from) {
  let dir = from;
  while (dir !== path.parse(dir).root) {
    const candidate = path.join(dir, 'node_modules');
    if (fs.existsSync(candidate)) return candidate;
    dir = path.dirname(dir);
  }
  return null;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  // 1. Singletons – always from the app's node_modules.
  if (singletonMap[moduleName]) {
    return context.resolveRequest(
      { ...context, originModulePath: path.join(appNodeModules, '_virtual.js') },
      moduleName,
      platform,
    );
  }

  // 2. Try the default resolution first.
  try {
    return context.resolveRequest(context, moduleName, platform);
  } catch (defaultError) {
    // 3. If the file requesting the module lives inside the SDK monorepo,
    //    retry resolution from the SDK package's node_modules (follows pnpm
    //    symlinks automatically because we resolve the real path).
    if (context.originModulePath.includes(sdkMonorepo)) {
      try {
        // Try from the SDK package's own node_modules first.
        return context.resolveRequest(
          { ...context, originModulePath: path.join(sdkPackage, 'dist', '_virtual.js') },
          moduleName,
          platform,
        );
      } catch {
        // Some transitive deps (e.g. inside es-iterator-helpers) resolve from
        // a deeper pnpm store path.  Find the nearest node_modules relative
        // to the real path of the requesting file.
        try {
          const realOrigin = fs.realpathSync(context.originModulePath);
          const nm = findNearestNodeModules(path.dirname(realOrigin));
          if (nm) {
            return context.resolveRequest(
              { ...context, originModulePath: path.join(nm, '_virtual.js') },
              moduleName,
              platform,
            );
          }
        } catch {
          // Fall through to rethrow the original error.
        }
      }
    }

    throw defaultError;
  }
};

module.exports = config;
