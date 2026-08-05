import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

interface QuestionPanelValue {
  answerType: "TEXT" | "SELECT" | "NUMBER" | "BOOLEAN";
  validationMessage?: string;
  options?: string[];
  required: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function mergePanelDataIntoWorkbookCell(
  cell: WorkbookCell,
  data: Record<string, unknown>,
): WorkbookCell {
  switch (cell.type) {
    case "protocol":
      return typeof data.protocolId === "string" && data.protocolId
        ? { ...cell, payload: { ...cell.payload, protocolId: data.protocolId } }
        : cell;
    case "macro":
      return typeof data.macroId === "string" && data.macroId
        ? { ...cell, payload: { ...cell.payload, macroId: data.macroId } }
        : cell;
    case "command": {
      const command = data.command;
      if (
        !isRecord(command) ||
        (command.format !== "string" && command.format !== "json" && command.format !== "yaml") ||
        typeof command.content !== "string"
      ) {
        return cell;
      }
      return {
        ...cell,
        payload: { ...cell.payload, format: command.format, content: command.content },
      };
    }
    case "markdown":
      return typeof data.description === "string" ? { ...cell, content: data.description } : cell;
    case "question": {
      const spec = data.stepSpecification;
      if (!isRecord(spec) || typeof spec.answerType !== "string") return cell;
      const value = spec as unknown as QuestionPanelValue;
      const text = value.validationMessage ?? cell.question.text;
      const required = Boolean(value.required);
      switch (value.answerType) {
        case "BOOLEAN":
          return { ...cell, question: { kind: "yes_no", text, required } };
        case "NUMBER":
          return { ...cell, question: { kind: "number", text, required } };
        case "SELECT":
          return {
            ...cell,
            question: { kind: "multi_choice", text, required, options: value.options ?? [] },
          };
        case "TEXT":
          return { ...cell, question: { kind: "open_ended", text, required } };
        default:
          return cell;
      }
    }
    default:
      return cell;
  }
}

export function mergePanelTitleIntoWorkbookCell(cell: WorkbookCell, title: string): WorkbookCell {
  switch (cell.type) {
    case "protocol":
      return { ...cell, payload: { ...cell.payload, name: title } };
    case "macro":
      return { ...cell, payload: { ...cell.payload, name: title } };
    case "command":
      return { ...cell, payload: { ...cell.payload, name: title } };
    case "question":
      return { ...cell, name: title };
    case "parallel":
      return { ...cell, name: title };
    default:
      return cell;
  }
}
