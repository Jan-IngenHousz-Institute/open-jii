const { withAndroidManifest } = require("expo/config-plugins");

const optionalFeatures = ["android.hardware.screen.portrait", "android.hardware.wifi"];

module.exports = (config) =>
  withAndroidManifest(config, (config) => {
    const { manifest } = config.modResults;
    const otherFeatures = (manifest["uses-feature"] ?? []).filter(
      (feature) => !optionalFeatures.includes(feature.$?.["android:name"]),
    );

    manifest["uses-feature"] = [
      ...otherFeatures,
      ...optionalFeatures.map((name) => ({
        $: { "android:name": name, "android:required": "false" },
      })),
    ];

    return config;
  });
