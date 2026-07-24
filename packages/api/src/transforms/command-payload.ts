import { parse as parseYaml } from "yaml";

import type { CommandFormat } from "../domains/experiment/experiment.schema";
import { isReferencedCommandPayload } from "../domains/workbook/command-source.schema";
import type { CommandCell, WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import type { CommandResolutionFailureCode, CommandResolutionResult } from "./command-resolution";
import { findOutputCellByProducer } from "./output-lookup";
import { hasMatchingProvenance, isRuntimeCellOutput } from "./runtime-output";
import type { OutputProvenance, RuntimeCellOutputProvider } from "./runtime-output";

export interface InlineCommand {
  format: CommandFormat;
  content: string;
}

export type ResolvedCommand = string | Record<string, unknown> | unknown[];

/**
 * Resolve an inline command payload into what the device driver expects.
 * `string` is sent raw (e.g. `hello`, `battery`); `json`/`yaml` parse into a
 * protocol-shaped object/array. Throws on malformed JSON/YAML so callers can
 * surface a useful error instead of sending garbage to the device.
 */
export function resolveInlineCommand({ format, content }: InlineCommand): ResolvedCommand {
  switch (format) {
    case "string":
      return content;
    case "json":
      return JSON.parse(content) as ResolvedCommand;
    case "yaml":
      return parseYaml(content) as ResolvedCommand;
    default:
      throw new Error(`Unknown command format: ${String(format)}`);
  }
}

/** Non-throwing variant for editor validation. */
export function validateInlineCommand({
  format,
  content,
}: InlineCommand): { ok: true; value: ResolvedCommand } | { ok: false; error: string } {
  if (content.trim().length === 0) {
    return { ok: false, error: "Command content is required" };
  }
  try {
    return { ok: true, value: resolveInlineCommand({ format, content }) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid command content" };
  }
}

export interface ResolveCommandPayloadOptions {
  commandCell: CommandCell;
  cells: WorkbookCell[];
  targetDeviceId?: string;
  activeProvenance: OutputProvenance;
  getRuntimeCellOutput: RuntimeCellOutputProvider;
}

const ELIGIBLE_SOURCE_TYPES = new Set<WorkbookCell["type"]>([
  "protocol",
  "command",
  "macro",
  "question",
]);

function failed(
  code: CommandResolutionFailureCode,
  context: Omit<Extract<CommandResolutionResult, { ok: false }>["error"], "code">,
): CommandResolutionResult {
  return { ok: false, error: { code, ...context } };
}

function dataRecord(data: unknown): Record<string, unknown> | undefined {
  return data !== null && typeof data === "object" && !Array.isArray(data)
    ? (data as Record<string, unknown>)
    : undefined;
}

function hasOwn(value: object, key: PropertyKey): boolean {
  return Object.prototype.hasOwnProperty.call(value, key);
}

/**
 * Pure, host-neutral command resolver. Static payloads preserve the existing
 * string/JSON/YAML behavior. Dynamic payloads fail closed before dispatch when
 * source order, runtime provenance, scope, device identity, or value shape is
 * invalid. Expected failures are values and never include raw output/commands.
 */
export function resolveCommandPayload({
  commandCell,
  cells,
  targetDeviceId,
  activeProvenance,
  getRuntimeCellOutput,
}: ResolveCommandPayloadOptions): CommandResolutionResult {
  const baseContext = { commandCellId: commandCell.id };

  if (!isReferencedCommandPayload(commandCell.payload)) {
    try {
      return { ok: true, value: resolveInlineCommand(commandCell.payload) };
    } catch {
      return failed("STATIC_COMMAND_INVALID", baseContext);
    }
  }

  const sourceCellId = commandCell.payload.ref.sourceCellId.trim();
  const field = commandCell.payload.ref.field;
  const context = { ...baseContext, sourceCellId: sourceCellId || undefined, field };

  if (field.trim().length === 0) return failed("COMMAND_FIELD_EMPTY", context);
  if (sourceCellId.length === 0) return failed("COMMAND_SOURCE_MISSING", context);

  const authoredCells = cells.filter((cell) => cell.type !== "output");
  const source = authoredCells.find((cell) => cell.id === sourceCellId);
  if (!source) return failed("COMMAND_SOURCE_MISSING", context);
  if (!ELIGIBLE_SOURCE_TYPES.has(source.type)) {
    return failed("COMMAND_SOURCE_INELIGIBLE", context);
  }

  const commandIndex = authoredCells.findIndex((cell) => cell.id === commandCell.id);
  const sourceIndex = authoredCells.findIndex((cell) => cell.id === sourceCellId);
  if (commandIndex < 0 || sourceIndex < 0 || sourceIndex >= commandIndex) {
    return failed("COMMAND_SOURCE_NOT_EARLIER", context);
  }

  const outputCell = findOutputCellByProducer(cells, sourceCellId);
  if (!outputCell.ok) return failed("COMMAND_OUTPUT_DUPLICATE", context);

  let rawOutput: unknown;
  try {
    rawOutput = getRuntimeCellOutput(sourceCellId);
  } catch {
    return failed("COMMAND_OUTPUT_INVALID", context);
  }
  if (rawOutput === undefined) return failed("COMMAND_OUTPUT_MISSING", context);
  if (!isRuntimeCellOutput(rawOutput)) return failed("COMMAND_OUTPUT_INVALID", context);
  if (!hasMatchingProvenance(rawOutput.provenance, activeProvenance)) {
    return failed("COMMAND_SOURCE_STALE", context);
  }

  let data: unknown;
  if (rawOutput.scope === "shared") {
    data = rawOutput.data;
  } else {
    const seenDeviceIds = new Set<string>();
    for (const result of rawOutput.deviceResults) {
      if (seenDeviceIds.has(result.deviceId)) {
        return failed("DEVICE_OUTPUT_DUPLICATE", { ...context, targetDeviceId });
      }
      seenDeviceIds.add(result.deviceId);
    }

    const deviceResult = rawOutput.deviceResults.find(
      (result) => result.deviceId === targetDeviceId,
    );
    if (!deviceResult) {
      return failed("DEVICE_OUTPUT_MISSING", { ...context, targetDeviceId });
    }
    if (deviceResult.error !== undefined) {
      return failed("SOURCE_DEVICE_FAILED", { ...context, targetDeviceId });
    }
    if (!hasOwn(deviceResult, "data")) {
      return failed("COMMAND_OUTPUT_INVALID", { ...context, targetDeviceId });
    }
    data = deviceResult.data;
  }

  const record = dataRecord(data);
  if (!record) return failed("COMMAND_OUTPUT_INVALID", { ...context, targetDeviceId });
  if (!hasOwn(record, field)) {
    return failed("COMMAND_FIELD_MISSING", { ...context, targetDeviceId });
  }

  const value = record[field];
  if (typeof value !== "string") {
    return failed("COMMAND_VALUE_NOT_STRING", { ...context, targetDeviceId });
  }
  if (value.trim().length === 0) {
    return failed("COMMAND_VALUE_EMPTY", { ...context, targetDeviceId });
  }

  return { ok: true, value };
}
