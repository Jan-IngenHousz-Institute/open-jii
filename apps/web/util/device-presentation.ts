import type { DisplayRole } from "@repo/api/domains/device/device-profile";
import type {
  DevicePresentation,
  DevicePresentationInput,
} from "@repo/api/transforms/device-presentation";
import { presentDevice } from "@repo/api/transforms/device-presentation";

/**
 * Web adapter over the shared, domain-pure {@link presentDevice} transform. The
 * transform returns structural tokens (an `unknown-device` fallback and known
 * display-role identifiers); this layer translates those tokens with the host's
 * i18next `t`. Canonical product spelling already comes from the shared profile,
 * so the primary product value is used verbatim.
 */

type TranslateFn = (key: string) => string;

const ROLE_KEYS: Record<DisplayRole, string> = {
  "measurement-device": "iot.deviceIdentity.role.measurementDevice",
  gateway: "iot.deviceIdentity.role.gateway",
};

export type { DevicePresentation, DevicePresentationInput };
export { presentDevice };

/**
 * Resolve the presenter's primary value to display copy: a name or canonical
 * product name is shown as-is, while the `unknown-device` fallback is localized.
 */
export function resolveDevicePrimaryLabel(present: DevicePresentation, t: TranslateFn): string {
  return present.provenance === "fallback" ? t("iot.deviceIdentity.unknown") : present.primary;
}

/** Translate the presenter's known display-role identifiers to secondary copy. */
export function resolveDeviceRoleLabels(present: DevicePresentation, t: TranslateFn): string[] {
  return present.roles.map((role) => t(ROLE_KEYS[role]));
}
