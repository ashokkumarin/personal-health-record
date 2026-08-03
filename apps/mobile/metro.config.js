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

// react-native and its peer "react" both need to resolve to the exact same
// copy everywhere in the bundle, or you get a split-instance crash
// ("ReactSharedInternals.S is undefined" — one React version's internals
// shape applied to another's module). Which physical directory that is
// (hoisted to the workspace root, or nested under apps/mobile) depends on
// npm's hoisting outcome for the current dependency graph, which can shift
// between installs (see root package.json's "overrides" and
// docs/deployment.md#dependency-hoisting-across-two-major-react-versions) —
// so resolve both dynamically via require.resolve() instead of a hardcoded
// path, which silently breaks the instant hoisting changes again.
config.resolver.extraNodeModules = {
  react: path.dirname(require.resolve("react/package.json", { paths: [projectRoot, workspaceRoot] })),
  "react-native": path.dirname(
    require.resolve("react-native/package.json", { paths: [projectRoot, workspaceRoot] })
  ),
};

// @phr/shared is `"type": "module"` with only a `main` field — no dual
// CJS/ESM `exports` map. Metro's package-exports-aware resolution (the
// default since Expo SDK 52) can't interop with that shape correctly and
// silently resolves its named exports to undefined ("Cannot read property
// 'default'/'S' of undefined" at bundle-eval time, no component stack).
// Falling back to legacy main-field resolution avoids the whole problem.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
