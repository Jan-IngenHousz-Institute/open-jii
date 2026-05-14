import { PermissionsAndroid, Platform } from "react-native";

import { keepTruthy } from "../utils/keep-truthy";

export async function requestBluetoothPermission() {
  if (Platform.OS === "ios") {
    return true;
  }

  if (Platform.OS !== "android") {
    return false;
  }

  const requiredPermissions = keepTruthy([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    Platform.Version < 31 && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);

  const results = await PermissionsAndroid.requestMultiple(requiredPermissions);
  const grantedPermissionsCount = Object.values(results).filter(
    (r) => r === PermissionsAndroid.RESULTS.GRANTED,
  ).length;

  return grantedPermissionsCount === requiredPermissions.length;
}
