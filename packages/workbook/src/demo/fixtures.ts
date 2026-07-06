import type { BranchCell } from "@repo/api/schemas/workbook-cells.schema";

import type { CommandCellLike, CommandFormat, RunnerCell } from "../cells";

// Cell factories shared by the package specs and the demo; hosts can deep-import
// them to test their own adapters against realistic programs.

export const markdownCell = (id: string, content = id): RunnerCell => ({
  id,
  type: "markdown",
  isCollapsed: false,
  content,
});

export const questionCell = (id: string, name: string, required = false): RunnerCell => ({
  id,
  type: "question",
  isCollapsed: false,
  name,
  question: { kind: "yes_no", text: name, required },
  isAnswered: false,
});

export const commandCell = (
  id: string,
  content = "battery",
  format: CommandFormat = "string",
): CommandCellLike => ({
  id,
  type: "command",
  payload: { format, content, name: id },
});

export const protocolCell = (
  id: string,
  protocolId = "5f1f9c1a-2c1e-4f6a-9d1b-00000000aaaa",
  version = 1,
): RunnerCell => ({
  id,
  type: "protocol",
  isCollapsed: false,
  payload: { protocolId, version, name: id },
});

export const macroCell = (
  id: string,
  macroId = `5f1f9c1a-2c1e-4f6a-9d1b-00000000bb${id.length}0`,
  language: "javascript" | "python" | "r" = "javascript",
): RunnerCell => ({
  id,
  type: "macro",
  isCollapsed: false,
  payload: { macroId, language, name: id },
});

export interface BranchPathSpec {
  id: string;
  goto?: string;
  condition?: {
    source: string;
    field: string;
    operator: "eq" | "neq" | "gt" | "lt" | "gte" | "lte";
    value: string;
  };
}

export const branchCell = (
  id: string,
  paths: BranchPathSpec[],
  defaultPathId?: string,
): BranchCell => ({
  id,
  type: "branch",
  isCollapsed: false,
  paths: paths.map((p) => ({
    id: p.id,
    label: p.id,
    color: "#000",
    conditions: p.condition
      ? [
          {
            id: `${p.id}_c`,
            sourceCellId: p.condition.source,
            field: p.condition.field,
            operator: p.condition.operator,
            value: p.condition.value,
          },
        ]
      : [],
    gotoCellId: p.goto,
  })),
  defaultPathId,
});
