import { DEVICE_PROFILES } from "@repo/api/domains/device/device-profile";
import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";

export interface SensorFamilyOption {
  value: SensorFamily;
  label: string;
  disabled: boolean;
}

/** Display label for the generic family, which has no product name. */
const GENERIC_LABEL = "Generic";

/**
 * Families not offered as a local-connection target in this authoring selector.
 * Ambyte is presented as a gateway; its measurement data arrives via ingest.
 * (Web protocol testing separately preserves a generic-driver compatibility
 * path for existing Ambyte-family protocols.)
 */
const DISABLED_FAMILIES: ReadonlySet<SensorFamily> = new Set(["ambyte"]);

/**
 * Selectable sensor family options derived from the API enum.
 * Adding a new value to `zSensorFamily` automatically surfaces it here;
 * its label comes from the shared product profile, so only the disable set may
 * need attention.
 */
export const SENSOR_FAMILY_OPTIONS: SensorFamilyOption[] = zSensorFamily.options.map((value) => ({
  value,
  label: getSensorFamilyLabel(value),
  disabled: DISABLED_FAMILIES.has(value),
}));

/**
 * Get the display label for a sensor family value. The canonical product
 * spelling comes from the shared `@repo/api` profile; `generic` has no product
 * name and falls back to a neutral label.
 */
export function getSensorFamilyLabel(family: SensorFamily): string {
  return DEVICE_PROFILES[family].productName ?? GENERIC_LABEL;
}

/**
 * Badge color class for a sensor family. Unknown values fall back to the
 * neutral badge, so this accepts the raw `family` string carried on a protocol.
 */
export function getSensorFamilyBadgeColor(family: string): string {
  switch (family) {
    case "multispeq":
      return "bg-badge-published";
    case "ambyte":
    case "ambit":
      return "bg-badge-active";
    case "minipar":
      return "bg-badge-stale";
    default:
      return "bg-badge-archived";
  }
}
