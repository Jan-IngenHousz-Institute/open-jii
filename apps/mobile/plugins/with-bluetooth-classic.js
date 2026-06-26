const { withAndroidManifest, withInfoPlist } = require("expo/config-plugins");

const withBluetoothClassic = (
  config,
  { peripheralUsageDescription, alwaysUsageDescription, protocols } = {},
) => {
  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothPeripheralUsageDescription =
      peripheralUsageDescription ?? "Allow $(PRODUCT_NAME) to check bluetooth peripheral info";
    config.modResults.NSBluetoothAlwaysUsageDescription =
      alwaysUsageDescription ?? "Allow $(PRODUCT_NAME) to always use bluetooth info";
    // Only declare MFi External Accessory protocols when the caller supplies
    // real vendor-issued IDs. A bogus default would advertise false MFi support.
    if (protocols && protocols.length > 0) {
      config.modResults.UISupportedExternalAccessoryProtocols = protocols;
    } else {
      delete config.modResults.UISupportedExternalAccessoryProtocols;
    }
    return config;
  });

  config = withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    manifest["uses-permission"] = manifest["uses-permission"] ?? [];

    const upsert = (attrs) => {
      manifest["uses-permission"] = manifest["uses-permission"].filter(
        (p) => p.$?.["android:name"] !== attrs["android:name"],
      );
      manifest["uses-permission"].push({ $: attrs });
    };

    // Legacy (Android <= 11). Drop on 12+ so we don't request unnecessary perms.
    upsert({
      "android:name": "android.permission.BLUETOOTH",
      "android:maxSdkVersion": "30",
    });
    upsert({
      "android:name": "android.permission.BLUETOOTH_ADMIN",
      "android:maxSdkVersion": "30",
    });

    // Android 12+ Bluetooth runtime permissions.
    upsert({ "android:name": "android.permission.BLUETOOTH_CONNECT" });
    upsert({ "android:name": "android.permission.BLUETOOTH_ADVERTISE" });

    // neverForLocation: scanning here doesn't derive physical location, so we
    // don't trigger the location permission prompt on Android 12+.
    upsert({
      "android:name": "android.permission.BLUETOOTH_SCAN",
      "android:usesPermissionFlags": "neverForLocation",
    });

    return config;
  });

  return config;
};

module.exports = withBluetoothClassic;
