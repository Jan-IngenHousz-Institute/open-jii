import { PermissionsAndroid, Platform } from "react-native";
import { keepTruthy } from "~/shared/utils/keep-truthy";

function getRequiredBluetoothPermissions() {
  const isAndroidPre12 =
    Platform.OS === "android" && typeof Platform.Version === "number" && Platform.Version < 31;
  return keepTruthy([
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
    PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
    isAndroidPre12 && PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
  ]);
}

export async function requestBluetoothPermission() {
  if (Platform.OS === "ios") {
    return true;
  }

  if (Platform.OS !== "android") {
    return false;
  }

  const requiredPermissions = getRequiredBluetoothPermissions();
  const results = await PermissionsAndroid.requestMultiple(requiredPermissions);
  const grantedPermissionsCount = Object.values(results).filter(
    (r) => r === PermissionsAndroid.RESULTS.GRANTED,
  ).length;

  return grantedPermissionsCount === requiredPermissions.length;
}

export async function hasBluetoothPermission() {
  if (Platform.OS === "ios") {
    return true;
  }

  if (Platform.OS !== "android") {
    return false;
  }

  const requiredPermissions = getRequiredBluetoothPermissions();
  for (const permission of requiredPermissions) {
    if (!(await PermissionsAndroid.check(permission))) {
      return false;
    }
  }
  return true;
}
