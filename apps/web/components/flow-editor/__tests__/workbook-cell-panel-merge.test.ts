import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import {
  mergePanelDataIntoWorkbookCell,
  mergePanelTitleIntoWorkbookCell,
} from "../workbook-cell-panel-merge";

describe("workbook cell panel merge", () => {
  it("updates a protocol reference while preserving version, name, and UI state", () => {
    const cell: WorkbookCell = {
      id: "p1",
      type: "protocol",
      isCollapsed: true,
      payload: {
        protocolId: "11111111-1111-1111-1111-111111111111",
        version: 7,
        name: "Original",
      },
    };
    expect(
      mergePanelDataIntoWorkbookCell(cell, {
        protocolId: "22222222-2222-2222-2222-222222222222",
      }),
    ).toEqual({
      ...cell,
      payload: {
        ...cell.payload,
        protocolId: "22222222-2222-2222-2222-222222222222",
      },
    });
  });

  it("updates question configuration without losing its answer state", () => {
    const cell: WorkbookCell = {
      id: "q1",
      type: "question",
      isCollapsed: true,
      name: "leaf_colour",
      question: { kind: "open_ended", text: "Colour?", required: false },
      answer: "green",
      isAnswered: true,
    };
    expect(
      mergePanelDataIntoWorkbookCell(cell, {
        stepSpecification: {
          answerType: "SELECT",
          validationMessage: "Pick a colour",
          required: true,
          options: ["green", "yellow"],
        },
      }),
    ).toEqual({
      ...cell,
      question: {
        kind: "multi_choice",
        text: "Pick a colour",
        required: true,
        options: ["green", "yellow"],
      },
    });
  });

  it("updates author-facing titles without reconstructing payloads", () => {
    const cell: WorkbookCell = {
      id: "m1",
      type: "macro",
      isCollapsed: false,
      payload: {
        macroId: "11111111-1111-1111-1111-111111111111",
        language: "python",
        name: "Old",
      },
    };
    expect(mergePanelTitleIntoWorkbookCell(cell, "New")).toEqual({
      ...cell,
      payload: { ...cell.payload, name: "New" },
    });
  });

  it("preserves a raw overlong protocol title in the draft payload", () => {
    const rawTitle = "p".repeat(65);
    const cell: WorkbookCell = {
      id: "p1",
      type: "protocol",
      isCollapsed: false,
      payload: {
        protocolId: "11111111-1111-1111-1111-111111111111",
        version: 1,
        name: "Old",
      },
    };

    expect(mergePanelTitleIntoWorkbookCell(cell, rawTitle)).toMatchObject({
      payload: { name: rawTitle },
    });
  });
});
