# @contentful/optimization-react-native: Dependency Packaging Issue

## Summary

The `@contentful/optimization-react-native` SDK (v0.1.0-alpha) lists `react`, `react-native`, and several React Native native modules as regular `dependencies` in its `package.json`. This causes npm to install **duplicate, nested copies** of these packages inside the SDK's own `node_modules`, leading to runtime crashes in consuming apps. These packages should be declared as `peerDependencies` only.

---

## The Problem

### Current SDK `package.json` (v0.1.0-alpha)

```json
{
  "dependencies": {
    "@react-native-async-storage/async-storage": "^2.1.0",
    "@react-native-clipboard/clipboard": "^1.15.0",
    "react": "^18.3.1",
    "react-native": "^0.76.9",
    "react-native-get-random-values": "^2.0.0",
    ...
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-native": ">=0.70.0",
    "@react-native-community/netinfo": ">=9.0.0"
  }
}
```

`react` and `react-native` appear in **both** `dependencies` and `peerDependencies`. When npm resolves this, the `dependencies` entry takes precedence.

### What Happens at Install Time

When a consuming app uses React 19 and React Native 0.81 (current stable as of early 2026):

1. The SDK declares `"react": "^18.3.1"` as a dependency. The app has `react@19.1.0`, which does **not** satisfy `^18.x`.
2. npm cannot hoist the app's React to satisfy the SDK, so it installs a **nested** `react@18.3.1` at `node_modules/@contentful/optimization-react-native/node_modules/react`.
3. The same happens for `react-native` -- a nested `react-native@0.76.9` is installed alongside the app's `react-native@0.81.5`.

The resulting `node_modules` tree:

```
node_modules/
  react@19.1.0                          <-- app's copy
  react-native@0.81.5                   <-- app's copy (matches native binary)
  @contentful/optimization-react-native/
    node_modules/
      react@18.3.1                      <-- SDK's nested copy
      react-native@0.76.9              <-- SDK's nested copy (does NOT match native binary)
```

### What Happens at Runtime

Metro resolves `require('react-native')` calls from the SDK's code to the nested `react-native@0.76.9`, because that's the closest match in the module resolution hierarchy. However, the **native binary** was compiled with React Native 0.81.5. When the 0.76.9 JS code tries to access TurboModules like `PlatformConstants`, the module interfaces don't match, and the app crashes:

```
Invariant Violation: TurboModuleRegistry.getEnforcing(...):
'PlatformConstants' could not be found.
Verify that a module by this name is registered in the native binary.
```

This is a fatal error that prevents the app from starting.

### Secondary Issue: Native Module Dependencies

The SDK also lists `@react-native-clipboard/clipboard` and `@react-native-async-storage/async-storage` as regular dependencies. These are **native modules** -- they contain compiled Objective-C/Swift/Java code that must be linked into the app's native binary. Listing them as regular dependencies means:

- Consumers using Expo Go cannot run the app at all (Expo Go doesn't include these native modules). They must create a custom development build, which adds friction.
- The SDK controls which version is installed rather than letting the app manage native module versions for compatibility with its React Native version.

---

## Recommended Fix

### SDK `package.json` Changes

Move `react`, `react-native`, and all native modules from `dependencies` to `peerDependencies`. Keep them in `devDependencies` for local SDK development and testing.

```json
{
  "name": "@contentful/optimization-react-native",
  "dependencies": {
    "es-iterator-helpers": "^1.2.1",
    "es-toolkit": "^1.39.10",
    "react-native-uuid": "^2.0.3",
    "zod": "^4.1.5",
    "@contentful/optimization-core": "0.1.0-alpha"
  },
  "peerDependencies": {
    "react": ">=18.0.0",
    "react-native": ">=0.70.0",
    "@react-native-async-storage/async-storage": ">=2.0.0",
    "@react-native-clipboard/clipboard": ">=1.15.0",
    "@react-native-community/netinfo": ">=9.0.0",
    "react-native-get-random-values": ">=1.11.0"
  },
  "peerDependenciesMeta": {
    "@react-native-community/netinfo": {
      "optional": true
    }
  },
  "devDependencies": {
    "react": "^19.0.0",
    "react-native": "^0.81.0",
    "@react-native-async-storage/async-storage": "^2.2.0",
    "@react-native-clipboard/clipboard": "^1.16.0",
    "@react-native-community/netinfo": "^11.0.0",
    "react-native-get-random-values": "~1.11.0"
  }
}
```

### Classification Rules

| Category | Where to declare | Examples | Rationale |
|----------|-----------------|----------|-----------|
| Host-provided singletons | `peerDependencies` + `devDependencies` | `react`, `react-native` | The app **must** provide exactly one copy. The native binary must match the JS version. Duplicates cause runtime crashes. |
| Native modules | `peerDependencies` + `devDependencies` | `async-storage`, `clipboard`, `netinfo`, `get-random-values` | These contain compiled native code linked into the app binary. The app must control which version is installed. |
| Pure JS utilities | `dependencies` | `zod`, `es-toolkit`, `es-iterator-helpers`, `react-native-uuid` | No native code. Safe for the SDK to bundle and version independently. |
| Internal packages | `dependencies` | `@contentful/optimization-core` | Owned by the SDK; no conflict risk. |

### Why `peerDependencies`

- **`peerDependencies`** tell npm: "I need this package, but the consuming app must provide it." npm will warn (or error in strict mode) if the app doesn't have a compatible version, but it will **never install a nested copy**.
- **`devDependencies`** provide the packages during SDK development (building, testing, type-checking) but are **not installed** when a consumer runs `npm install`.
- **`dependencies`** should only contain packages the SDK fully owns -- pure JS code that doesn't interact with the native binary and won't conflict with the host app.

---

## Current Workaround for Consuming Apps

Until the SDK is updated, consuming apps must add a Metro resolver override to force a single copy of `react` and `react-native`:

```js
// metro.config.js
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

const appNodeModules = path.resolve(__dirname, 'node_modules');
config.resolver.extraNodeModules = {
  react: path.resolve(appNodeModules, 'react'),
  'react-native': path.resolve(appNodeModules, 'react-native'),
};

module.exports = config;
```

Additionally, consuming apps must use a custom Expo development build (`expo-dev-client` + `npx expo run:ios`) rather than Expo Go, because `@react-native-clipboard/clipboard` is not included in the Expo Go runtime.

This workaround should not be necessary once the SDK's dependency declarations are corrected.

---

## Reproduction Steps

1. Create a new Expo app with React Native 0.81+ and React 19+
2. Install `@contentful/optimization-react-native@0.1.0-alpha`
3. Wrap the app in `<OptimizationRoot>`
4. Run `npx expo run:ios`
5. Observe the `PlatformConstants` crash

---

## References

- [npm docs: peerDependencies](https://docs.npmjs.com/cli/v10/configuring-npm/package-json#peerdependencies)
- [React Native: Creating a Native Module Library](https://reactnative.dev/docs/the-new-architecture/create-module-library)
- [React Native: Libraries](https://reactnative.dev/docs/libraries)
