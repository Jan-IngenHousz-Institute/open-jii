import type { CommandCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { resolveCommandPayload } from "@repo/api/transforms/command-payload";
import type { ResolvedCommand } from "@repo/api/transforms/command-payload";
import type {
  CommandResolutionFailure,
  CommandResolutionFailureCode,
} from "@repo/api/transforms/command-resolution";
import type { RuntimeCellOutputProvider } from "@repo/api/transforms/runtime-output";

export type MobileCommandResolutionFailureCode =
  | CommandResolutionFailureCode
  | "COMMAND_CELL_MISSING"
  | "COMMAND_PROVENANCE_MISSING";

export interface MobileCommandResolutionFailure extends Omit<CommandResolutionFailure, "code"> {
  code: MobileCommandResolutionFailureCode;
}

export type MobileCommandResolutionResult =
  | { ok: true; value: ResolvedCommand }
  | { ok: false; error: MobileCommandResolutionFailure };

interface ResolveMobileCommandOptions {
  commandCellId: string;
  cells: WorkbookCell[];
  targetDeviceId: string;
  workbookVersionId?: string;
  executionEpoch?: string;
  getRuntimeCellOutput: RuntimeCellOutputProvider;
}

/**
 * Mobile host adapter: locate the authored command cell and delegate exactly
 * once to the shared resolver. It never reads or rewrites the flow carrier.
 */
export function resolveMobileCommand({
  commandCellId,
  cells,
  targetDeviceId,
  workbookVersionId,
  executionEpoch,
  getRuntimeCellOutput,
}: ResolveMobileCommandOptions): MobileCommandResolutionResult {
  if (!workbookVersionId || !executionEpoch) {
    return {
      ok: false,
      error: { code: "COMMAND_PROVENANCE_MISSING", commandCellId, targetDeviceId },
    };
  }

  const commandCell = cells.find(
    (cell): cell is CommandCell => cell.id === commandCellId && cell.type === "command",
  );
  if (!commandCell) {
    return {
      ok: false,
      error: { code: "COMMAND_CELL_MISSING", commandCellId, targetDeviceId },
    };
  }

  return resolveCommandPayload({
    commandCell,
    cells,
    targetDeviceId,
    activeProvenance: { workbookVersionId, executionEpoch },
    getRuntimeCellOutput,
  });
}

export function commandFailureTranslationKey(code: MobileCommandResolutionFailureCode): string {
  return `measurementFlow:commandNode.resolution.${code}`;
}

/** Safe telemetry fields: identifiers and classifications only. */
export function commandFailureLogFields(
  operation: "direct" | "branch",
  failure: MobileCommandResolutionFailure,
  provenance?: { workbookVersionId?: string; executionEpoch?: string },
): Record<string, string | undefined> {
  return {
    operation,
    code: failure.code,
    commandCellId: failure.commandCellId,
    sourceCellId: failure.sourceCellId,
    targetDeviceId: failure.targetDeviceId,
    workbookVersionId: provenance?.workbookVersionId,
    executionEpoch: provenance?.executionEpoch,
  };
}
