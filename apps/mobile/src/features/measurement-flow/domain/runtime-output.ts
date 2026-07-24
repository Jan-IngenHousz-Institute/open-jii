import type { FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import type {
  OutputProvenance,
  RuntimeCellOutput,
  RuntimeDeviceResult,
} from "@repo/api/transforms/runtime-output";

export type MobileProducerKind = "protocol" | "command" | "macro";

export type DeviceProducerOutcome =
  | { device: { id: string; name?: string }; data: unknown }
  | { device: { id: string; name?: string }; error: string };

interface MobileDeviceProducerResult {
  device?: { id: string; name?: string };
  result: unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/** Remove display/runtime metadata that is never part of resolver data. */
function withoutDisplayMetadata(value: unknown): unknown {
  if (!isRecord(value)) return value;
  const {
    family: _family,
    deviceName: _deviceName,
    executionTime: _time,
    messages: _messages,
    ...data
  } = value;
  return data;
}

/** Match the existing output-cell/namespace shape without carrying UI fields. */
export function normalizeMobileProducerData(kind: MobileProducerKind, raw: unknown): unknown {
  if (kind === "command") {
    const value = isRecord(raw) ? raw : { response: raw };
    return withoutDisplayMetadata(value);
  }

  if (kind === "protocol" && isRecord(raw) && raw.sample != null) {
    const first = Array.isArray(raw.sample) ? raw.sample[0] : raw.sample;
    return withoutDisplayMetadata(first);
  }

  return withoutDisplayMetadata(raw);
}

export function producerKindFor(
  cellId: string,
  cells: WorkbookCell[],
  flowNodes: FlowNode[],
): MobileProducerKind | undefined {
  const cell = cells.find((candidate) => candidate.id === cellId);
  if (cell?.type === "protocol" || cell?.type === "command" || cell?.type === "macro") {
    return cell.type;
  }

  const node = flowNodes.find((candidate) => candidate.id === cellId);
  if (node?.type === "analysis") return "macro";
  if (node?.type === "measurement") {
    return (node.content as { command?: unknown } | undefined)?.command ? "command" : "protocol";
  }
  return undefined;
}

export function deviceOutputFromScanResults(
  results: MobileDeviceProducerResult[],
  kind: Exclude<MobileProducerKind, "macro">,
  provenance: OutputProvenance,
): RuntimeCellOutput | undefined {
  if (results.length === 0 || results.some((entry) => !entry.device?.id)) return undefined;

  return {
    scope: "device",
    provenance,
    deviceResults: results.flatMap((entry) =>
      entry.device
        ? [
            {
              deviceId: entry.device.id,
              ...(entry.device.name ? { deviceLabel: entry.device.name } : {}),
              data: normalizeMobileProducerData(kind, entry.result),
            },
          ]
        : [],
    ),
  };
}

export function sharedMacroOutput(data: unknown, provenance: OutputProvenance): RuntimeCellOutput {
  return {
    scope: "shared",
    provenance,
    data: normalizeMobileProducerData("macro", data),
  };
}

export function mergeDeviceMacroOutput(
  current: RuntimeCellOutput | undefined,
  device: { id: string; name?: string },
  data: unknown,
  provenance: OutputProvenance,
): RuntimeCellOutput {
  const prior: RuntimeDeviceResult[] =
    current?.scope === "device" &&
    current.provenance.workbookVersionId === provenance.workbookVersionId &&
    current.provenance.executionEpoch === provenance.executionEpoch
      ? current.deviceResults.filter((result) => result.deviceId !== device.id)
      : [];

  return {
    scope: "device",
    provenance,
    deviceResults: [
      ...prior,
      {
        deviceId: device.id,
        ...(device.name ? { deviceLabel: device.name } : {}),
        data: normalizeMobileProducerData("macro", data),
      },
    ],
  };
}

export function mergeDeviceProducerOutput(
  current: RuntimeCellOutput | undefined,
  kind: MobileProducerKind,
  outcomes: DeviceProducerOutcome[],
  provenance: OutputProvenance,
): RuntimeCellOutput {
  const replacedIds = new Set(outcomes.map((outcome) => outcome.device.id));
  const prior: RuntimeDeviceResult[] =
    current?.scope === "device" &&
    current.provenance.workbookVersionId === provenance.workbookVersionId &&
    current.provenance.executionEpoch === provenance.executionEpoch
      ? current.deviceResults.filter((result) => !replacedIds.has(result.deviceId))
      : [];

  return {
    scope: "device",
    provenance,
    deviceResults: [
      ...prior,
      ...outcomes.map(
        (outcome): RuntimeDeviceResult => ({
          deviceId: outcome.device.id,
          ...(outcome.device.name ? { deviceLabel: outcome.device.name } : {}),
          ...("error" in outcome
            ? { error: outcome.error }
            : { data: normalizeMobileProducerData(kind, outcome.data) }),
        }),
      ),
    ],
  };
}
