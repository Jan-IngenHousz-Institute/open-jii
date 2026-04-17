// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Enable package exports for Better Auth
config.resolver.unstable_enablePackageExports = true;

config.resolver.assetExts.push("txt");
config.resolver.sourceExts.push("sql");

module.exports = withNativeWind(config);
