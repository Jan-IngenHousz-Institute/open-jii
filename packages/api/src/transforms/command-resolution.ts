import type { ResolvedCommand } from "./command-payload";

export const COMMAND_RESOLUTION_FAILURE_CODES = [
  "STATIC_COMMAND_INVALID",
  "COMMAND_SOURCE_MISSING",
  "COMMAND_SOURCE_INELIGIBLE",
  "COMMAND_SOURCE_NOT_EARLIER",
  "COMMAND_FIELD_EMPTY",
  "COMMAND_OUTPUT_MISSING",
  "COMMAND_OUTPUT_DUPLICATE",
  "COMMAND_OUTPUT_INVALID",
  "COMMAND_SOURCE_STALE",
  "DEVICE_OUTPUT_MISSING",
  "DEVICE_OUTPUT_DUPLICATE",
  "SOURCE_DEVICE_FAILED",
  "COMMAND_FIELD_MISSING",
  "COMMAND_VALUE_NOT_STRING",
  "COMMAND_VALUE_EMPTY",
] as const;

export type CommandResolutionFailureCode = (typeof COMMAND_RESOLUTION_FAILURE_CODES)[number];

/** Safe diagnostic context: identifiers only, never output data or commands. */
export interface CommandResolutionFailure {
  code: CommandResolutionFailureCode;
  commandCellId: string;
  sourceCellId?: string;
  field?: string;
  targetDeviceId?: string;
}

export type CommandResolutionResult =
  | { ok: true; value: ResolvedCommand }
  | { ok: false; error: CommandResolutionFailure };
