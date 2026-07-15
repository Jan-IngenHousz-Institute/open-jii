import type { IDeviceDriver } from "../driver/driver-base";
import { GenericDeviceDriver } from "../driver/generic/driver";
import type { DeviceType } from "./types";

/**
 * Payload delivered to a device during onboarding. The shape of `config` is
 * owned by the caller (e.g. the platform's onboarding config document); this
 * package only defines how it reaches the device.
 */
export interface DeviceConfigDeliveryPayload {
  config: Record<string, unknown>;
  /** Identifier stored alongside the config on the device, e.g. the Thing name. */
  id?: string;
}

/**
 * Whether a device family can receive a stored configuration. MultispeQ has no
 * config command; its procedure is sent inline at measurement time.
 */
export function supportsConfigDelivery(deviceType: DeviceType): boolean {
  return deviceType !== "multispeq";
}

/**
 * Deliver an onboarding config to a connected device, platform-agnostically:
 * the driver may sit on Web Serial/BLE or a React Native transport alike.
 */
export async function deliverDeviceConfig(
  driver: IDeviceDriver,
  payload: DeviceConfigDeliveryPayload,
): Promise<void> {
  if (!(driver instanceof GenericDeviceDriver)) {
    throw new Error("Config delivery requires a generic-family device driver");
  }

  await driver.setConfig({ config: payload.config, id: payload.id });
}
