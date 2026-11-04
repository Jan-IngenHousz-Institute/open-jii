import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import {
  DEVICE_LABEL_COLUMN,
  WellKnownColumnTypes,
} from "@repo/api/domains/experiment/data/experiment-data.schema";

const UNKNOWN_DEVICE = "Unknown device";

// Accept a display label or a registry struct from older reads.
export function deviceDisplayName(value: unknown): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    return UNKNOWN_DEVICE;
  }
  try {
    const parsed: unknown = JSON.parse(value);
    if (parsed !== null && typeof parsed === "object") {
      const serial = "serial_number" in parsed ? parsed.serial_number : undefined;
      return typeof serial === "string" && serial.trim().length > 0
        ? serial.trim()
        : UNKNOWN_DEVICE;
    }
    return value.trim();
  } catch {
    return value.trim();
  }
}

export function hasDeviceLabelColumn(columns: ExperimentDataColumn[]): boolean {
  return (
    columns.some((column) => column.name === DEVICE_LABEL_COLUMN) &&
    columns.some(
      (column) => column.name === "device" && column.type_text === WellKnownColumnTypes.DEVICE,
    )
  );
}
