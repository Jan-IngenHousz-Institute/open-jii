import * as Application from "expo-application";
import * as ExpoDevice from "expo-device";

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
  return {
    ...(ExpoDevice.modelName ? { client_model: ExpoDevice.modelName } : {}),
    ...(ExpoDevice.manufacturer ? { client_manufacturer: ExpoDevice.manufacturer } : {}),
    ...(ExpoDevice.osName ? { client_os: ExpoDevice.osName } : {}),
    ...(ExpoDevice.osVersion ? { client_os_version: ExpoDevice.osVersion } : {}),
    ...(Application.nativeApplicationVersion
      ? { client_app_version: Application.nativeApplicationVersion }
      : {}),
  };
}
