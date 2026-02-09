const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro resolves the "browser" condition for packages like `diary`
// that ship Node-only code in their default export
config.resolver.unstable_conditionNames = [
  'browser',
  'require',
  'react-native',
];

// The Optimization SDK incorrectly lists react and react-native as regular
// dependencies instead of only peer dependencies. This causes npm to install
// nested copies (react-native@0.76.9, react@18.3.1) inside the SDK's
// node_modules, which conflict with the app's versions (0.81.5, 19.1.0).
// Force Metro to always resolve these from the app's root node_modules so
// there is only one copy of each in the bundle.
const appNodeModules = path.resolve(__dirname, 'node_modules');
config.resolver.extraNodeModules = {
  react: path.resolve(appNodeModules, 'react'),
  'react-native': path.resolve(appNodeModules, 'react-native'),
};

module.exports = config;
