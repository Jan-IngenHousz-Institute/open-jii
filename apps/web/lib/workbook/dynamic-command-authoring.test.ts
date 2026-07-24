import { describe, expect, it } from "vitest";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import {
  eligibleCommandSources,
  fieldSuggestions,
  refForSourceSelection,
  refIssueForCommand,
} from "./dynamic-command-authoring";

const uuid = "11111111-1111-1111-1111-111111111111";

function protocol(id: string, name?: string): WorkbookCell {
  return {
    id,
    type: "protocol",
    isCollapsed: false,
    payload: { protocolId: uuid, version: 1, name },
  };
}
function macro(id: string, name?: string): WorkbookCell {
  return {
    id,
    type: "macro",
    isCollapsed: false,
    payload: { macroId: uuid, language: "python", name },
  };
}
function question(id: string, name: string): WorkbookCell {
  return {
    id,
    type: "question",
    isCollapsed: false,
    name,
    question: { kind: "open_ended", text: "?", required: false },
    isAnswered: false,
  };
}
function markdown(id: string): WorkbookCell {
  return { id, type: "markdown", isCollapsed: false, content: "note" };
}
function output(id: string, producedBy: string, data?: unknown): WorkbookCell {
  return { id, type: "output", isCollapsed: false, producedBy, data };
}
function refCommand(id: string, sourceCellId: string, field: string): WorkbookCell {
  return {
    id,
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId, field } },
  };
}

describe("eligibleCommandSources", () => {
  it("lists only eligible cells that precede the command in authored order", () => {
    const cells = [
      protocol("p", "Scan"),
      markdown("md"),
      macro("m", "Compute"),
      question("q", "Note"),
      refCommand("cmd", "m", "value"),
      protocol("later", "Later"), // after the command -> excluded
    ];
    const sources = eligibleCommandSources(cells, "cmd");
    expect(sources.map((s) => s.id)).toEqual(["p", "m", "q"]);
    expect(sources.find((s) => s.id === "p")?.name).toBe("Scan");
  });

  it("excludes output cells from the order relation", () => {
    const cells = [protocol("p"), output("o", "p"), refCommand("cmd", "p", "value")];
    expect(eligibleCommandSources(cells, "cmd").map((s) => s.id)).toEqual(["p"]);
  });

  it("leaves name undefined for an unnamed source so the UI shows a translated fallback", () => {
    const cells = [protocol("p"), refCommand("cmd", "p", "value")];
    const source = eligibleCommandSources(cells, "cmd").find((s) => s.id === "p");
    expect(source?.name).toBeUndefined();
    expect(source?.type).toBe("protocol");
  });
});

describe("fieldSuggestions", () => {
  it("returns only 'answer' for a question source", () => {
    const cells = [question("q", "Note"), refCommand("cmd", "q", "answer")];
    expect(fieldSuggestions(cells, "q")).toEqual(["answer"]);
  });

  it("suggests top-level keys from the source's visible output", () => {
    const cells = [
      protocol("p"),
      output("o", "p", { toDevice: "x", battery: 90 }),
      refCommand("cmd", "p", ""),
    ];
    expect(fieldSuggestions(cells, "p").sort()).toEqual(["battery", "toDevice"]);
  });

  it("returns nothing for a missing source", () => {
    expect(fieldSuggestions([refCommand("cmd", "gone", "x")], "gone")).toEqual([]);
  });
});

describe("refIssueForCommand", () => {
  it("flags a missing source", () => {
    const issue = refIssueForCommand([refCommand("cmd", "gone", "value")], "cmd");
    expect(issue?.code).toBe("DYNAMIC_COMMAND_SOURCE_MISSING");
  });

  it("flags a later (not-earlier) source", () => {
    const cells = [refCommand("cmd", "m", "value"), macro("m")];
    expect(refIssueForCommand(cells, "cmd")?.code).toBe("DYNAMIC_COMMAND_SOURCE_NOT_EARLIER");
  });

  it("flags an ineligible source", () => {
    const cells = [markdown("md"), refCommand("cmd", "md", "value")];
    expect(refIssueForCommand(cells, "cmd")?.code).toBe("DYNAMIC_COMMAND_SOURCE_INELIGIBLE");
  });

  it("returns undefined for a sound reference", () => {
    const cells = [macro("m"), refCommand("cmd", "m", "value")];
    expect(refIssueForCommand(cells, "cmd")).toBeUndefined();
  });
});

describe("refForSourceSelection", () => {
  const cells = [macro("m", "Compute"), question("q", "Note"), protocol("p", "Scan")];

  it("pins a question source to `answer` from an empty ref", () => {
    expect(refForSourceSelection(cells, { sourceCellId: "", field: "" }, "q")).toEqual({
      sourceCellId: "q",
      field: "answer",
    });
  });

  it("pins a question source to `answer` even when a stale non-question field was set", () => {
    expect(refForSourceSelection(cells, { sourceCellId: "m", field: "toDevice" }, "q")).toEqual({
      sourceCellId: "q",
      field: "answer",
    });
  });

  it("clears a retained `answer` when moving OFF a question to a non-question source", () => {
    expect(refForSourceSelection(cells, { sourceCellId: "q", field: "answer" }, "m")).toEqual({
      sourceCellId: "m",
      field: "",
    });
  });

  it("preserves an author-typed field when switching between non-question sources", () => {
    expect(refForSourceSelection(cells, { sourceCellId: "m", field: "toDevice" }, "p")).toEqual({
      sourceCellId: "p",
      field: "toDevice",
    });
  });
});
