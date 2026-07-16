import {
  createBranchCell,
  createMacroCell,
  createMarkdownCell,
  createOutputCell,
  createProtocolCell,
  createQuestionCell,
} from "@/test/factories";
import { server } from "@/test/msw/server";
import { assertExists, render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";
import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { WorkbookEditor, createDefaultCell, reorderCellsWithGluedOutput } from "./workbook-editor";

vi.mock("./workbook-code-editor", () => ({
  WorkbookCodeEditor: ({ value }: { value: string }) => (
    <pre data-testid="code-editor">{value}</pre>
  ),
}));

function renderEditor(overrides: Partial<Parameters<typeof WorkbookEditor>[0]> = {}) {
  const onCellsChange = vi.fn();
  const props = { cells: [] as WorkbookCell[], onCellsChange, ...overrides };
  return { ...render(<WorkbookEditor {...props} />), onCellsChange, props };
}

// Distinguishes the trailing AddCellButton from sidebar buttons that share labels.
function trailingAddRegion() {
  const region = screen.getByText("Add new").parentElement;
  assertExists(region, "trailing AddCellButton region not found");
  return region;
}

function findDeleteButtonForCellWith(text: string) {
  const btn = Array.from(document.querySelectorAll("svg.lucide-trash-2"))
    .find((svg) => {
      const wrapper = svg.closest("[class*='text-card-foreground']");
      return wrapper && within(wrapper as HTMLElement).queryByText(text);
    })
    ?.closest("button");
  assertExists(btn, `delete button for cell containing "${text}" not found`);
  return btn;
}

beforeEach(() => {
  // Pickers query these on mount.
  server.mount(contract.protocols.listProtocols, { body: [] });
  server.mount(contract.macros.listMacros, { body: [] });
});

describe("createDefaultCell", () => {
  it("creates a markdown cell with empty content", () => {
    const cell = createDefaultCell("markdown");
    expect(cell.type).toBe("markdown");
    expect(cell).toMatchObject({ type: "markdown", content: "", isCollapsed: false });
    expect(cell.id).toBeDefined();
  });

  it("throws for question type — question cells go through the picker for naming", () => {
    expect(() => createDefaultCell("question")).toThrow(/question picker/i);
  });

  it("creates an output cell with empty producedBy", () => {
    const cell = createDefaultCell("output");
    expect(cell).toMatchObject({ type: "output", producedBy: "", isCollapsed: false });
  });

  it("creates a command cell defaulting to an empty string payload", () => {
    const cell = createDefaultCell("command");
    expect(cell).toMatchObject({
      type: "command",
      payload: { format: "string", content: "" },
      isCollapsed: false,
    });
    expect(cell.id).toBeDefined();
  });

  it("creates a branch cell with one default path and condition", () => {
    const cell = createDefaultCell("branch");
    if (cell.type !== "branch") throw new Error("unexpected");
    expect(cell.paths).toHaveLength(1);
    expect(cell.paths[0].label).toBe("Path 1");
    expect(cell.paths[0].conditions[0]).toMatchObject({
      sourceCellId: "",
      field: "",
      operator: "eq",
      value: "",
    });
  });

  it("generates unique IDs for each cell", () => {
    expect(createDefaultCell("markdown").id).not.toBe(createDefaultCell("markdown").id);
  });

  it("throws for protocol type", () => {
    expect(() => createDefaultCell("protocol")).toThrow(/protocol picker/i);
  });

  it("throws for macro type", () => {
    expect(() => createDefaultCell("macro")).toThrow(/macro picker/i);
  });
});

describe("WorkbookEditor — empty state", () => {
  it("shows the empty workbook prompt and add buttons when not readOnly", () => {
    renderEditor();
    expect(screen.getByText("Empty workbook")).toBeInTheDocument();
    expect(screen.getByText("Add a cell to get started")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /markdown/i })).toBeInTheDocument();
  });

  it("shows the readOnly empty message and no add buttons", () => {
    renderEditor({ readOnly: true });
    expect(screen.getByText("This workbook has no cells.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /markdown/i })).not.toBeInTheDocument();
  });

  it("adds a markdown cell at index 0 when the empty-state Markdown button is clicked", async () => {
    const user = userEvent.setup();
    const { onCellsChange } = renderEditor();

    await user.click(screen.getByRole("button", { name: /markdown/i }));

    expect(onCellsChange).toHaveBeenCalledTimes(1);
    const next = onCellsChange.mock.calls[0][0] as WorkbookCell[];
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe("markdown");
  });

  it("adds a question cell when the user names it through the question picker", async () => {
    const user = userEvent.setup();
    const { onCellsChange } = renderEditor();

    await user.click(screen.getByRole("button", { name: /question/i }));
    await user.type(screen.getByRole("textbox", { name: /question name/i }), "Soil moisture");
    await user.click(screen.getByRole("button", { name: /^create$/i }));

    const next = onCellsChange.mock.calls[0][0] as WorkbookCell[];
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe("question");
    if (next[0].type === "question") {
      expect(next[0].name).toBe("Soil moisture");
    }
  });

  it("adds a branch cell when Branch is clicked", async () => {
    const user = userEvent.setup();
    const { onCellsChange } = renderEditor();

    await user.click(screen.getByRole("button", { name: /branch/i }));

    const next = onCellsChange.mock.calls[0][0] as WorkbookCell[];
    expect(next[0].type).toBe("branch");
  });
});

describe("WorkbookEditor — header gating", () => {
  it("does not render the header when onConnect/onRunAll are missing", () => {
    renderEditor({ cells: [createMarkdownCell()] });
    expect(screen.queryByRole("button", { name: /run all/i })).not.toBeInTheDocument();
  });

  it("renders the header when onConnect and onRunAll are provided", () => {
    renderEditor({
      cells: [createMarkdownCell()],
      title: "My Workbook",
      onConnect: vi.fn(),
      onRunAll: vi.fn(),
    });
    expect(screen.getByRole("button", { name: /run all/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear all/i })).toBeInTheDocument();
  });
});

describe("WorkbookEditor — cell rendering", () => {
  it("assigns sequential execution numbers to executable cells only", () => {
    const cells: WorkbookCell[] = [
      createMarkdownCell({ id: "md" }),
      createProtocolCell({
        id: "p",
        payload: { protocolId: "proto-1", version: 1, name: "Proto" },
      }),
      createQuestionCell({ id: "q" }),
      createMacroCell({
        id: "m",
        payload: { macroId: "macro-1", language: "python", name: "Macro" },
      }),
      createBranchCell({ id: "b" }),
      createOutputCell({ id: "o", producedBy: "p" }),
    ];

    renderEditor({ cells });

    expect(screen.getByText("[1]")).toBeInTheDocument();
    expect(screen.getByText("[2]")).toBeInTheDocument();
    expect(screen.getByText("[3]")).toBeInTheDocument();
    expect(screen.getByText("[4]")).toBeInTheDocument();
    expect(screen.queryByText("[5]")).not.toBeInTheDocument();
  });

  it("uses runtime executionOrder when provided", () => {
    const protocol = createProtocolCell({
      id: "p",
      payload: { protocolId: "proto-1", version: 1, name: "Proto" },
    });

    renderEditor({
      cells: [protocol],
      executionStates: { p: { status: "completed", executionOrder: [7, 9] } },
    });

    expect(screen.getByText("[9]")).toBeInTheDocument();
    expect(screen.queryByText("[1]")).not.toBeInTheDocument();
  });

  it("hides all add-cell buttons when readOnly", () => {
    renderEditor({
      cells: [createMarkdownCell({ id: "md" })],
      readOnly: true,
    });
    expect(screen.queryByText("Add new")).not.toBeInTheDocument();
  });

  it("adds a cell at the end when the trailing Markdown button is clicked", async () => {
    const user = userEvent.setup();
    const { onCellsChange } = renderEditor({
      cells: [createMarkdownCell({ id: "first" })],
    });

    // Sidebar exposes "Markdown" too; scope to the trailing AddCellButton.
    await user.click(within(trailingAddRegion()).getByRole("button", { name: /markdown/i }));

    const next = onCellsChange.mock.calls[0][0] as WorkbookCell[];
    expect(next).toHaveLength(2);
    expect(next[0].id).toBe("first");
    expect(next[1].type).toBe("markdown");
  });
});

describe("WorkbookEditor — sidebar minimap", () => {
  it("renders the sidebar with an item for each cell", () => {
    const cells: WorkbookCell[] = [
      createMarkdownCell({ id: "md", content: "<p>Hi</p>" }),
      createQuestionCell({
        id: "q",
        name: "soil_moisture",
        question: { kind: "open_ended", text: "Why?", required: false },
      }),
    ];
    renderEditor({ cells });

    expect(screen.getAllByText(/Markdown/).length).toBeGreaterThanOrEqual(2);
    // The sidebar now shows the question's name (its data column) as the row
    // title, with the type conveyed by the icon/color — so "soil_moisture"
    // appears in both the sidebar and the cell header. "Question" still shows
    // in the add-cell picker.
    expect(screen.getAllByText(/soil_moisture/).length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/^Question$/).length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText(/Why\?/).length).toBeGreaterThanOrEqual(1);
  });
});

describe("WorkbookEditor — delete flow", () => {
  it("removes a cell when its CellWrapper delete button is clicked", async () => {
    const user = userEvent.setup();
    const cells: WorkbookCell[] = [
      createMarkdownCell({ id: "keep", content: "<p>Keep</p>" }),
      createMarkdownCell({ id: "drop", content: "<p>Drop</p>" }),
    ];
    const { onCellsChange } = renderEditor({ cells });

    await user.click(findDeleteButtonForCellWith("Drop"));

    const next = onCellsChange.mock.calls[0][0] as WorkbookCell[];
    expect(next).toHaveLength(1);
    expect(next[0].id).toBe("keep");
  });

  it("clears the source question's answer when its output cell is deleted", async () => {
    const user = userEvent.setup();
    const question = createQuestionCell({
      id: "q",
      question: { kind: "open_ended", text: "Q?", required: false },
      isAnswered: true,
      answer: "yes",
    });
    const output = createOutputCell({
      id: "o",
      producedBy: "q",
      data: { answer: "yes" },
    });
    const { onCellsChange } = renderEditor({ cells: [question, output] });

    await user.click(screen.getByTitle("output.clear"));

    const next = onCellsChange.mock.calls[0][0] as WorkbookCell[];
    expect(next).toHaveLength(1);
    expect(next[0].type).toBe("question");
    if (next[0].type !== "question") throw new Error("unexpected");
    expect(next[0].isAnswered).toBe(false);
    expect(next[0].answer).toBeUndefined();
  });
});

// Typed so downstream `.find` / `.filter` calls don't trip no-unsafe-* lint rules.
function lastCellsArg(onCellsChange: ReturnType<typeof vi.fn>): WorkbookCell[] {
  const calls = onCellsChange.mock.calls as WorkbookCell[][][];
  if (calls.length === 0) throw new Error("onCellsChange was not called");
  return calls[calls.length - 1][0];
}

describe("WorkbookEditor — answer auto-creates an output cell", () => {
  it("appends an output cell after a question cell when the user submits an answer", async () => {
    const user = userEvent.setup();
    const cells: WorkbookCell[] = [
      createQuestionCell({
        id: "q-1",
        question: { kind: "open_ended", text: "Soil moisture?", required: false },
      }),
    ];
    const { onCellsChange } = renderEditor({ cells });

    const runBtn = screen.getByRole("button", { name: /run question/i });
    await user.click(runBtn);

    const dialogInput = screen.getByPlaceholderText(/type your answer/i);
    await user.type(dialogInput, "moist");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(onCellsChange).toHaveBeenCalled());

    const last = lastCellsArg(onCellsChange);
    const question = last.find((c) => c.id === "q-1");
    const output = last.find((c) => c.type === "output");
    expect(question?.type).toBe("question");
    if (question?.type === "question") {
      expect(question.isAnswered).toBe(true);
      expect(question.answer).toBe("moist");
    }
    expect(output).toBeDefined();
    if (output?.type === "output") {
      expect(output.producedBy).toBe("q-1");
      expect(output.data).toEqual({ answer: "moist" });
    }
  });

  it("updates an existing output cell when the question is re-answered", async () => {
    const user = userEvent.setup();
    const cells: WorkbookCell[] = [
      createQuestionCell({
        id: "q-1",
        question: { kind: "open_ended", text: "Soil moisture?", required: false },
        isAnswered: true,
        answer: "old",
      }),
      createOutputCell({ id: "o-1", producedBy: "q-1", data: { answer: "old" } }),
    ];
    const { onCellsChange } = renderEditor({ cells });

    await user.click(screen.getByRole("button", { name: /run question/i }));

    const dialogInput = screen.getByDisplayValue("old");
    await user.clear(dialogInput);
    await user.type(dialogInput, "new");
    await user.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => expect(onCellsChange).toHaveBeenCalled());

    const last = lastCellsArg(onCellsChange);
    const outputs = last.filter(
      (c): c is Extract<WorkbookCell, { type: "output" }> => c.type === "output",
    );
    expect(outputs).toHaveLength(1);
    expect(outputs[0].id).toBe("o-1");
    expect(outputs[0].data).toEqual({ answer: "new" });
  });
});

describe("reorderCellsWithGluedOutput", () => {
  // q0 owns out0; q1 owns out1.
  const q0 = createQuestionCell({ id: "q0" });
  const out0 = createOutputCell({ id: "out0", producedBy: "q0" });
  const q1 = createQuestionCell({ id: "q1" });
  const out1 = createOutputCell({ id: "out1", producedBy: "q1" });
  const ids = (cells: WorkbookCell[]) => cells.map((c) => c.id);

  it("carries the glued output cell when moving a question forward", () => {
    const q2 = createQuestionCell({ id: "q2" });
    const out2 = createOutputCell({ id: "out2", producedBy: "q2" });
    const cells = [q0, out0, q1, out1, q2, out2];
    // Drop q0 before q2's original slot (raw insertion index 4).
    const result = reorderCellsWithGluedOutput(cells, 0, 4);
    expect(ids(result)).toEqual(["q1", "out1", "q0", "out0", "q2", "out2"]);
  });

  it("carries the glued output cell when moving a question to the end", () => {
    const cells = [q0, out0, q1, out1];
    const result = reorderCellsWithGluedOutput(cells, 0, cells.length);
    expect(ids(result)).toEqual(["q1", "out1", "q0", "out0"]);
  });

  it("moves a question backward with its output", () => {
    const cells = [q0, out0, q1, out1];
    const result = reorderCellsWithGluedOutput(cells, 2, 0);
    expect(ids(result)).toEqual(["q1", "out1", "q0", "out0"]);
  });

  it("moves a lone cell (no output) without disturbing others", () => {
    const md = createMarkdownCell({ id: "md" });
    const cells = [md, q0, out0];
    const result = reorderCellsWithGluedOutput(cells, 0, cells.length);
    expect(ids(result)).toEqual(["q0", "out0", "md"]);
  });
});
