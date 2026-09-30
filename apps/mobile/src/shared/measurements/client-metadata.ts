import * as Application from "expo-application";
import * as ExpoDevice from "expo-device";
import { Platform } from "react-native";

/**
 * The publishing phone, as opposed to the `device_*` fields which describe the
 * sensor. `client_` matches the `client_id` the IoT rule already stamps on the
 * envelope for the broker-authenticated thing name.
 */
export interface ClientMetadata {
  client_model?: string;
  client_manufacturer?: string;
  client_os?: string;
  client_os_version?: string;
  client_app_version?: string;
}

/**
 * Phone and OS provenance for a measurement. Every field is best-effort: a
 * value the platform will not report is omitted rather than invented, so the
 * envelope never carries a placeholder that reads like a real reading.
 */
export function getClientMetadata(): ClientMetadata {
  // Expo's Android osName comes from BASE_OS, which can be a build fingerprint.
  const osName = Platform.OS === "android" ? "Android" : ExpoDevice.osName;

  return {
    ...(ExpoDevice.modelName ? { client_model: ExpoDevice.modelName } : {}),
    ...(ExpoDevice.manufacturer ? { client_manufacturer: ExpoDevice.manufacturer } : {}),
    ...(osName ? { client_os: osName } : {}),
    ...(ExpoDevice.osVersion ? { client_os_version: ExpoDevice.osVersion } : {}),
    ...(Application.nativeApplicationVersion
      ? { client_app_version: Application.nativeApplicationVersion }
      : {}),
  };
}
