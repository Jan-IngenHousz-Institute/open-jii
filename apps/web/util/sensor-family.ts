import type { SensorFamily } from "@repo/api";
import { zSensorFamily } from "@repo/api";

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
  ambit: "Ambit",
};

/**
 * Families that are not yet available for selection.
 */
const DISABLED_FAMILIES: ReadonlySet<SensorFamily> = new Set(["ambit"]);

/**
 * Selectable sensor family options derived from the API enum.
 * Adding a new value to `zSensorFamily` automatically surfaces it here —
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
