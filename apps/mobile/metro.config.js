const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// npm workspaces monorepo: watch the whole workspace and let Metro resolve
// packages hoisted to the root node_modules (see Expo's monorepo docs).
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// react-native itself gets hoisted to the workspace root (nothing else in
// the monorepo depends on it), but its own peer "react" doesn't — apps/web
// needs React 18, so apps/mobile keeps its own nested react@19 alongside it.
// Metro's default per-file nearest-node_modules walk means react-native's
// (root-hoisted) files find the root's React 18 instead of the sibling
// React 19 next to them, splitting the bundle across two React instances
// ("ReactSharedInternals.S is undefined" — React 19's internals shape
// applied to a React 18 module). Force these to one canonical copy.
config.resolver.extraNodeModules = {
  react: path.resolve(projectRoot, "node_modules/react"),
  "react-native": path.resolve(workspaceRoot, "node_modules/react-native"),
};

// @phr/shared is `"type": "module"` with only a `main` field — no dual
// CJS/ESM `exports` map. Metro's package-exports-aware resolution (the
// default since Expo SDK 52) can't interop with that shape correctly and
// silently resolves its named exports to undefined ("Cannot read property
// 'default'/'S' of undefined" at bundle-eval time, no component stack).
// Falling back to legacy main-field resolution avoids the whole problem.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
