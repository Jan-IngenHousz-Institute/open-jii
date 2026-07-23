import type { Device } from "~/shared/types/device";

import type { DevicePresentation } from "@repo/api/transforms/device-presentation";
import { presentDevice } from "@repo/api/transforms/device-presentation";
import type { DeviceIdentity } from "@repo/iot";

const MAC_LIKE = /^(?:[0-9a-f]{2}[:-]){2,}[0-9a-f]{2}$/iu;

function usableName(value: string | undefined, stableId: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === stableId || MAC_LIKE.test(trimmed)) return undefined;
  return trimmed;
}

/**
 * Adapt mobile's transport record plus its best-effort identity handshake to
 * the shared structural presenter. The adapter never infers a product before
 * identity is available; a failed handshake therefore remains name-first or
 * falls back to Unknown device + the transport identifier.
 */
export function presentMobileDevice(device: Device, identity?: DeviceIdentity): DevicePresentation {
  const identityId = identity?.deviceId?.trim();
  const id = identityId && identityId.length > 0 ? identityId : device.id;
  return presentDevice({
    name: usableName(identity?.name, id) ?? usableName(device.name, device.id),
    family: identity?.family,
    roles: ["measurement-device"],
    id,
  });
}

export function mobileDevicePrimaryLabel(
  presentation: DevicePresentation,
  unknownDeviceLabel: string,
): string {
  return presentation.provenance === "fallback" ? unknownDeviceLabel : presentation.primary;
}

interface AttributionLabels {
  unknownDevice: string;
  identifier: (id: string) => string;
}

/**
 * Keep unnamed device actions attributable without making the stable ID the
 * primary display name. Named devices stay concise; product and unknown
 * fallbacks retain their identifier as secondary inline context.
 */
export function mobileDeviceAttributedLabel(
  presentation: DevicePresentation,
  labels: AttributionLabels,
): string {
  const primary = mobileDevicePrimaryLabel(presentation, labels.unknownDevice);
  return presentation.provenance !== "name" && presentation.id
    ? `${primary} (${labels.identifier(presentation.id)})`
    : primary;
}

interface SecondaryLabels {
  measurementDevice: string;
  identifier: (id: string) => string;
}

/** Product, role, and stable identifier context, deduplicated and ordered. */
export function mobileDeviceSecondaryParts(
  presentation: DevicePresentation,
  labels: SecondaryLabels,
): string[] {
  const parts: string[] = [];
  if (
    presentation.productName &&
    presentation.productName.localeCompare(presentation.primary, undefined, {
      sensitivity: "accent",
    }) !== 0
  ) {
    parts.push(presentation.productName);
  }
  if (presentation.roles.includes("measurement-device")) parts.push(labels.measurementDevice);
  if (presentation.id) parts.push(labels.identifier(presentation.id));
  return parts;
}
