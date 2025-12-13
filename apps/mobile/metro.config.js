// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = withNativeWind(getDefaultConfig(projectRoot), {
  input: "./global.css",
  // Use JS wrapper so Metro can load config without TS support in CI/EAS
  configPath: "./tailwind.config.js",
});

// Ensure Metro can resolve workspace packages
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

config.resolver.assetExts.push("txt");

module.exports = config;
