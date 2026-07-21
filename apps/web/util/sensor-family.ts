import type { SensorFamily } from "@repo/api/domains/protocol/protocol.schema";
import { zSensorFamily } from "@repo/api/domains/protocol/protocol.schema";

export interface SensorFamilyOption {
  value: SensorFamily;
  label: string;
  disabled: boolean;
}

/**
 * Display labels for each sensor family.
 * Keyed by the values defined in `zSensorFamily` from @repo/api.
 */
const SENSOR_FAMILY_LABELS: Record<SensorFamily, string> = {
  generic: "Generic",
  multispeq: "MultispeQ",
  ambyte: "Ambyte",
  minipar: "MiniPAR",
  ambit: "Ambit",
};

/**
 * Families that are not available for local connection (Ambyte is an
 * MQTT-only gateway; its data arrives via ingest, never a local port).
 */
const DISABLED_FAMILIES: ReadonlySet<SensorFamily> = new Set(["ambyte"]);

/**
 * Selectable sensor family options derived from the API enum.
 * Adding a new value to `zSensorFamily` automatically surfaces it here;
 * just add its label to `SENSOR_FAMILY_LABELS` and optionally disable it.
 */
export const SENSOR_FAMILY_OPTIONS: SensorFamilyOption[] = zSensorFamily.options.map((value) => ({
  value,
  label: SENSOR_FAMILY_LABELS[value],
  disabled: DISABLED_FAMILIES.has(value),
}));

/**
 * Get the display label for a sensor family value.
 */
export function getSensorFamilyLabel(family: SensorFamily): string {
  return SENSOR_FAMILY_LABELS[family];
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
