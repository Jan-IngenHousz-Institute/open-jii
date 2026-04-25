const { withInfoPlist, AndroidConfig } = require("expo/config-plugins");

const withBluetoothClassic = (
  config,
  { peripheralUsageDescription, alwaysUsageDescription, protocols } = {},
) => {
  // iOS: set plist keys for External Accessory / Bluetooth usage
  config = withInfoPlist(config, (config) => {
    config.modResults.NSBluetoothPeripheralUsageDescription =
      peripheralUsageDescription ??
      "Allow $(PRODUCT_NAME) to check bluetooth peripheral info";
    config.modResults.NSBluetoothAlwaysUsageDescription =
      alwaysUsageDescription ??
      "Allow $(PRODUCT_NAME) to always use bluetooth info";
    config.modResults.UISupportedExternalAccessoryProtocols =
      protocols ?? ["com.apple.m1"];
    return config;
  });

  // Android: Bluetooth Classic permissions
  config = AndroidConfig.Permissions.withPermissions(config, [
    "android.permission.BLUETOOTH",
    "android.permission.BLUETOOTH_ADMIN",
    "android.permission.ACCESS_FINE_LOCATION",
    "android.permission.BLUETOOTH_CONNECT",
    "android.permission.BLUETOOTH_SCAN",
    "android.permission.BLUETOOTH_ADVERTISE",
  ]);

  return config;
};

module.exports = withBluetoothClassic;
