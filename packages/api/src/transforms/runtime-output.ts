/** Provenance required for every runtime value eligible for command resolution. */
export interface OutputProvenance {
  workbookVersionId: string;
  executionEpoch: string;
}

export interface SharedRuntimeCellOutput {
  scope: "shared";
  provenance: OutputProvenance;
  data: unknown;
}

export interface RuntimeDeviceResult {
  deviceId: string;
  deviceLabel?: string;
  data?: unknown;
  error?: string;
}

export interface DeviceRuntimeCellOutput {
  scope: "device";
  provenance: OutputProvenance;
  deviceResults: RuntimeDeviceResult[];
}

/**
 * Host-neutral runtime output. Scope is explicit even for a one-device run, so
 * callers never infer shared/device semantics from optional fields.
 */
export type RuntimeCellOutput = SharedRuntimeCellOutput | DeviceRuntimeCellOutput;

export type RuntimeCellOutputProvider = (sourceCellId: string) => RuntimeCellOutput | undefined;

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value: Record<string, unknown>, allowed: ReadonlySet<string>): boolean {
  return Object.keys(value).every((key) => allowed.has(key));
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

const PROVENANCE_KEYS = new Set(["workbookVersionId", "executionEpoch"]);
const SHARED_OUTPUT_KEYS = new Set(["scope", "provenance", "data"]);
const DEVICE_OUTPUT_KEYS = new Set(["scope", "provenance", "deviceResults"]);
const DEVICE_RESULT_KEYS = new Set(["deviceId", "deviceLabel", "data", "error"]);

export function isOutputProvenance(value: unknown): value is OutputProvenance {
  if (!isRecord(value) || !hasOnlyKeys(value, PROVENANCE_KEYS)) return false;
  return (
    typeof value.workbookVersionId === "string" &&
    value.workbookVersionId.length > 0 &&
    typeof value.executionEpoch === "string" &&
    value.executionEpoch.length > 0
  );
}

/**
 * Defensive validation for host adapters and persisted/cast state. Explicit
 * envelopes are strict while values inside `data` remain arbitrary.
 */
export function isRuntimeCellOutput(value: unknown): value is RuntimeCellOutput {
  if (!isRecord(value) || !isOutputProvenance(value.provenance)) return false;

  if (value.scope === "shared") {
    return hasOnlyKeys(value, SHARED_OUTPUT_KEYS) && hasOwn(value, "data");
  }

  if (value.scope !== "device" || !hasOnlyKeys(value, DEVICE_OUTPUT_KEYS)) return false;
  if (!Array.isArray(value.deviceResults)) return false;
  return value.deviceResults.every((result) => {
    if (!isRecord(result) || !hasOnlyKeys(result, DEVICE_RESULT_KEYS)) return false;
    return (
      typeof result.deviceId === "string" &&
      result.deviceId.length > 0 &&
      (result.deviceLabel === undefined || typeof result.deviceLabel === "string") &&
      (result.error === undefined || typeof result.error === "string")
    );
  });
}

export function hasMatchingProvenance(actual: OutputProvenance, active: OutputProvenance): boolean {
  return (
    actual.workbookVersionId === active.workbookVersionId &&
    actual.executionEpoch === active.executionEpoch
  );
}

/** Adapt a host-owned current-cycle question answer into the common contract. */
export function runtimeOutputFromQuestionAnswer(
  answer: unknown,
  provenance: OutputProvenance,
): SharedRuntimeCellOutput {
  return { scope: "shared", provenance, data: { answer } };
}
