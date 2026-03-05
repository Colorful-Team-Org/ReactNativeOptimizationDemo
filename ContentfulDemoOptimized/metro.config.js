const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Local SDK paths
const sdkRoot = '/Users/alexander.freas/github/optimization';
const reactNativeSdk = path.join(sdkRoot, 'packages/react-native-sdk');
const coreSdk = path.join(sdkRoot, 'packages/universal/core-sdk');
const apiClient = path.join(sdkRoot, 'packages/universal/api-client');
const apiSchemas = path.join(sdkRoot, 'packages/universal/api-schemas');

// Ensure Metro resolves the "browser" condition for packages like `diary`
// that ship Node-only code in their default export
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

// Watch the local SDK directories so Metro picks up changes
config.watchFolders = [reactNativeSdk, coreSdk, apiClient, apiSchemas];

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
  path.join(apiClient, 'node_modules'),
  path.join(apiSchemas, 'node_modules'),
];

module.exports = config;
