import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";
import { namespaceNameOf } from "@repo/api/domains/workbook/workbook-cells.schema";
import type {
  DynamicCommandIssueCode,
  DynamicCommandValidationIssue,
} from "@repo/api/transforms/dynamic-command-refs";
import { validateDynamicCommandReferences } from "@repo/api/transforms/dynamic-command-refs";

/**
 * Pure authoring helpers for dynamic command cells. They mirror the resolver /
 * publish validator eligibility rules (protocol/command/macro/question, earlier
 * in AUTHORED order excluding output cells) so the editor's picker and the
 * server never disagree. Nothing here mutates cells or resolves a value.
 */

/** Source cell types a dynamic command may reference (matches the resolver). */
const ELIGIBLE_SOURCE_TYPES = new Set<WorkbookCell["type"]>([
  "protocol",
  "command",
  "macro",
  "question",
]);

export interface CommandSourceOption {
  id: string;
  type: WorkbookCell["type"];
  /**
   * Author-given name for the source cell, or undefined when it is unnamed. The
   * UI shows a translated per-type fallback for the undefined case; this is never
   * derived from a resolved value. Callers must not render raw enum text.
   */
  name?: string;
}

/**
 * Translation KEY (workbook namespace) for a source cell's type. Used both for
 * the unnamed-source fallback and the visible type suffix, so no raw enum text
 * (`protocol`, `macro`, ...) is ever rendered.
 */
export const SOURCE_TYPE_LABEL_KEYS: Record<string, string> = {
  protocol: "cells.commandDynamic.sourceType.protocol",
  macro: "cells.commandDynamic.sourceType.macro",
  command: "cells.commandDynamic.sourceType.command",
  question: "cells.commandDynamic.sourceType.question",
};

/** Translation key for a source type, or a stable generic fallback key. */
export function sourceTypeLabelKey(type: string): string {
  return SOURCE_TYPE_LABEL_KEYS[type] ?? "cells.commandDynamic.sourceType.generic";
}

/**
 * Eligible sources for the command at `commandCellId`: every protocol/command/
 * macro/question cell that precedes it in authored document order (output cells
 * are excluded from the order relation, exactly as the resolver/validator do).
 */
export function eligibleCommandSources(
  cells: WorkbookCell[],
  commandCellId: string,
): CommandSourceOption[] {
  const authored = cells.filter((c) => c.type !== "output");
  const commandIndex = authored.findIndex((c) => c.id === commandCellId);
  if (commandIndex < 0) return [];
  return authored
    .slice(0, commandIndex)
    .filter((c) => ELIGIBLE_SOURCE_TYPES.has(c.type))
    .map((c) => {
      // An empty/whitespace name is omitted (left undefined) so the UI shows a
      // translated fallback rather than a blank label.
      const name = namespaceNameOf(c)?.trim();
      return { id: c.id, type: c.type, ...(name ? { name } : {}) };
    });
}

/**
 * Advisory top-level field suggestions for a chosen source. A question exposes
 * only `answer` (its runtime value is `{ answer }`, shared across devices).
 * Other sources suggest the top-level keys visible on their display output
 * cell(s); these are hints only and manual top-level names stay allowed.
 */
export function fieldSuggestions(cells: WorkbookCell[], sourceCellId: string): string[] {
  const source = cells.find((c) => c.id === sourceCellId && c.type !== "output");
  if (!source) return [];
  if (source.type === "question") return ["answer"];

  const keys = new Set<string>();
  for (const cell of cells) {
    if (cell.type !== "output" || cell.producedBy !== sourceCellId) continue;
    collectTopLevelKeys(cell.data, keys);
    for (const device of cell.deviceResults ?? []) collectTopLevelKeys(device.data, keys);
  }
  return [...keys];
}

function collectTopLevelKeys(data: unknown, into: Set<string>): void {
  if (data !== null && typeof data === "object" && !Array.isArray(data)) {
    for (const key of Object.keys(data)) into.add(key);
  }
}

/**
 * Translation KEY (workbook namespace) for each structural-issue code's repair
 * guidance. The helper never returns final English; callers translate the key,
 * so every locale owns the copy.
 */
export const DYNAMIC_COMMAND_ISSUE_KEYS: Record<DynamicCommandIssueCode, string> = {
  DYNAMIC_COMMAND_SOURCE_MISSING: "cells.commandDynamic.issue.sourceMissing",
  DYNAMIC_COMMAND_SOURCE_INELIGIBLE: "cells.commandDynamic.issue.sourceIneligible",
  DYNAMIC_COMMAND_SOURCE_NOT_EARLIER: "cells.commandDynamic.issue.sourceNotEarlier",
  DYNAMIC_COMMAND_FIELD_EMPTY: "cells.commandDynamic.issue.fieldEmpty",
  DYNAMIC_COMMAND_NODE_UNREACHABLE: "cells.commandDynamic.issue.nodeUnreachable",
  DYNAMIC_COMMAND_GRAPH_AMBIGUOUS: "cells.commandDynamic.issue.graphAmbiguous",
  DYNAMIC_COMMAND_INVALID_CARRIER: "cells.commandDynamic.issue.invalidCarrier",
};

/** Translation key for a code, or a stable generic fallback key for unknown codes. */
export function dynamicCommandIssueKey(code: string): string {
  const keys: Record<string, string | undefined> = DYNAMIC_COMMAND_ISSUE_KEYS;
  return keys[code] ?? "cells.commandDynamic.issue.generic";
}

export interface DynamicCommandRef {
  sourceCellId: string;
  field: string;
}

/**
 * The ref a source selection must persist atomically. A question source has
 * exactly one legal field, `answer`, so it is pinned together with the source
 * (whether the ref was empty or held a stale non-question field). Moving OFF a
 * question drops a retained `answer` so a question-only field is never kept as a
 * valid non-question choice; any other author-typed field is preserved.
 */
export function refForSourceSelection(
  cells: WorkbookCell[],
  currentRef: DynamicCommandRef,
  nextSourceId: string,
): DynamicCommandRef {
  const next = cells.find((c) => c.id === nextSourceId && c.type !== "output");
  if (next?.type === "question") return { sourceCellId: nextSourceId, field: "answer" };
  const prev = cells.find((c) => c.id === currentRef.sourceCellId && c.type !== "output");
  const clearStaleAnswer = prev?.type === "question" && currentRef.field === "answer";
  return { sourceCellId: nextSourceId, field: clearStaleAnswer ? "" : currentRef.field };
}

/**
 * The blocking structural issue for one ref command, if any, from the shared
 * validator. Returns `undefined` when the reference is structurally sound.
 * Never repairs or drops the reference; the id is preserved for diagnosis.
 */
export function refIssueForCommand(
  cells: WorkbookCell[],
  commandCellId: string,
): DynamicCommandValidationIssue | undefined {
  return validateDynamicCommandReferences(cells).find((i) => i.commandCellId === commandCellId);
}
