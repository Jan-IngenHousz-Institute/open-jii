import type { IDeviceDriver } from "../driver/driver-base";
import type { DeviceType } from "./types";
import { DEVICE_TRANSPORT_SUPPORT } from "./types";

/**
 * Payload delivered to a device during onboarding. The shape of `config` is
 * owned by the caller (e.g. the platform's onboarding config document); this
 * package only defines how it reaches the device. On the wire it becomes
 * `{"command":"SET_CONFIG","params":{"config":...,"id":...}}`.
 */
export interface DeviceConfigDeliveryPayload {
  config: Record<string, unknown>;
  /** Identifier stored alongside the config on the device, e.g. the Thing name. */
  id?: string;
}

/**
 * Whether a device family can receive a stored configuration, from the same
 * registry that declares transport support.
 */
export function supportsConfigDelivery(deviceType: DeviceType): boolean {
  return DEVICE_TRANSPORT_SUPPORT[deviceType].supportsStoredConfig;
}

/**
 * Deliver an onboarding config to a connected device, platform-agnostically:
 * the driver may sit on Web Serial/BLE or a React Native transport alike. Any
 * driver exposing the optional IDeviceDriver.setConfig can receive it.
 */
export async function deliverDeviceConfig(
  driver: IDeviceDriver,
  payload: DeviceConfigDeliveryPayload,
): Promise<void> {
  if (!driver.setConfig) {
    throw new Error("The connected device's driver does not support stored configuration");
  }

  await driver.setConfig(payload);
}
