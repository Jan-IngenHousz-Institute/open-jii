// Learn more: https://docs.expo.dev/guides/monorepos/
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const { getPostHogExpoConfig } = require("posthog-react-native/metro");

// PostHog's serializer tags each bundle so its uploaded source map can unminify stack traces.
const config = getPostHogExpoConfig(__dirname, { getDefaultConfig });

// Enable package exports for Better Auth
config.resolver.unstable_enablePackageExports = true;

config.resolver.assetExts.push("txt");
config.resolver.sourceExts.push("sql");

module.exports = withNativeWind(config, { input: "./global.css" });
