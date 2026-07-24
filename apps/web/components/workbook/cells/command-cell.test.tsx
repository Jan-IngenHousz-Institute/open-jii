import { render, screen, userEvent } from "@/test/test-utils";
import { beforeEach, describe, it, expect, vi } from "vitest";

import type { StaticCommandPayload } from "@repo/api/domains/workbook/command-source.schema";
import type { CommandCell, WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import { CommandCellComponent } from "./command-cell";

// Authoring is gated by the default-off flag. Existing tests run with it unset
// (read-only ref, unchanged static); the authoring describe flips it on.
let flagState: boolean | undefined;
vi.mock("posthog-js/react", () => ({
  useFeatureFlagEnabled: () => flagState,
}));

function inlineCell(overrides: Partial<StaticCommandPayload> = {}): CommandCell {
  return {
    id: "cmd-1",
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "battery", ...overrides },
  };
}

function refCell(): CommandCell {
  return {
    id: "cmd-ref",
    type: "command",
    isCollapsed: false,
    payload: { kind: "ref", ref: { sourceCellId: "macro-1", field: "toDevice" } },
  };
}

describe("CommandCellComponent", () => {
  beforeEach(() => {
    flagState = undefined; // flag off by default
  });

  it("renders the command content in an editable field", () => {
    render(<CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByRole("textbox")).toHaveValue("battery");
  });

  it("calls onUpdate when the command text changes", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(
      <CommandCellComponent
        cell={inlineCell({ content: "" })}
        onUpdate={onUpdate}
        onDelete={vi.fn()}
      />,
    );
    await user.type(screen.getByRole("textbox"), "h");
    expect(onUpdate).toHaveBeenCalled();
    const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
    expect(updated.payload).toMatchObject({ content: "h" });
  });

  it("shows a validation error for malformed JSON content", () => {
    render(
      <CommandCellComponent
        cell={inlineCell({ format: "json", content: "{not json" })}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );
    expect(screen.getByText(/.+/, { selector: "p.text-red-500" })).toBeInTheDocument();
  });

  it("toggles collapse through the cell wrapper", async () => {
    const user = userEvent.setup();
    const onUpdate = vi.fn();
    render(<CommandCellComponent cell={inlineCell()} onUpdate={onUpdate} onDelete={vi.fn()} />);

    const collapseBtn = document.querySelector("svg.lucide-chevron-down")?.closest("button");
    if (!collapseBtn) throw new Error("collapse toggle not found");
    await user.click(collapseBtn);

    expect(onUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "cmd-1", isCollapsed: true }),
    );
  });

  it("copies the command content to the clipboard", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", { value: { writeText }, configurable: true });

    render(
      <CommandCellComponent
        cell={inlineCell({ content: "battery" })}
        onUpdate={vi.fn()}
        onDelete={vi.fn()}
      />,
    );

    const copyBtn = document.querySelector("svg.lucide-copy")?.closest("button");
    if (!copyBtn) throw new Error("copy button not found");
    await user.click(copyBtn);

    expect(writeText).toHaveBeenCalledWith("battery");
  });

  it("hides the format selector in read-only mode", () => {
    const { rerender } = render(
      <CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />,
    );
    expect(screen.getByLabelText("cells.commandFormatAria")).toBeInTheDocument();

    rerender(
      <CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} readOnly />,
    );
    expect(screen.queryByLabelText("cells.commandFormatAria")).not.toBeInTheDocument();
  });

  describe("dynamic (ref) cell", () => {
    it("renders the reference source and field, not a static editor", () => {
      render(<CommandCellComponent cell={refCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByText("macro-1")).toBeInTheDocument();
      expect(screen.getByText("toDevice")).toBeInTheDocument();
      // No static command editor / format selector for a ref cell.
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
      expect(screen.queryByLabelText("cells.commandFormatAria")).not.toBeInTheDocument();
    });

    it("preserves the ref payload on collapse (never overwrites with static content)", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(<CommandCellComponent cell={refCell()} onUpdate={onUpdate} onDelete={vi.fn()} />);

      const collapseBtn = document.querySelector("svg.lucide-chevron-down")?.closest("button");
      if (!collapseBtn) throw new Error("collapse toggle not found");
      await user.click(collapseBtn);

      const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
      expect(updated.isCollapsed).toBe(true);
      // The reference is intact; it was NOT converted to a static payload.
      expect(updated.payload).toEqual({
        kind: "ref",
        ref: { sourceCellId: "macro-1", field: "toDevice" },
      });
    });

    it("offers no control that mutates a ref to static", () => {
      const onUpdate = vi.fn();
      render(<CommandCellComponent cell={refCell()} onUpdate={onUpdate} onDelete={vi.fn()} />);
      // No format selector and no editable textbox means no static-write path.
      expect(screen.queryByLabelText("cells.commandFormatAria")).not.toBeInTheDocument();
      expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    });

    const macroSource = (): WorkbookCell => ({
      id: "macro-1",
      type: "macro",
      isCollapsed: false,
      payload: { macroId: "22222222-2222-2222-2222-222222222222", language: "python", name: "M" },
    });

    // "Both flag states" = the two ways the flag reads as OFF: explicit false and
    // undefined (unresolved). In each, a ref is runnable + collapsible but the
    // structural actions (delete/edit/convert) are absent.
    it.each([[false], [undefined]])(
      "with the flag %s a ref is runnable but structurally locked (no delete/edit/convert)",
      async (flag) => {
        flagState = flag;
        const user = userEvent.setup();
        const onRun = vi.fn();
        const onDelete = vi.fn();
        render(
          <CommandCellComponent
            cell={refCell()}
            onUpdate={vi.fn()}
            onDelete={onDelete}
            onRun={onRun}
            allCells={[macroSource(), refCell()]}
          />,
        );

        // Run stays available and callable.
        await user.click(screen.getByRole("button", { name: /^Run/ }));
        expect(onRun).toHaveBeenCalledTimes(1);

        // No delete control, no mode toggle, no source/field editors.
        expect(document.querySelector("svg.lucide-trash-2")).toBeNull();
        expect(screen.queryByTestId("command-mode-dynamic")).not.toBeInTheDocument();
        expect(screen.queryByTestId("command-source")).not.toBeInTheDocument();
        expect(screen.queryByTestId("command-field")).not.toBeInTheDocument();
      },
    );

    it("with the flag off, a ref stays read-only but a broken ref still shows guidance", () => {
      const cells: WorkbookCell[] = [refCell()]; // source "macro-1" is missing
      render(
        <CommandCellComponent
          cell={refCell()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          allCells={cells}
        />,
      );
      expect(screen.queryByTestId("command-mode-dynamic")).not.toBeInTheDocument();
      expect(screen.getByTestId("command-ref-issue")).toBeInTheDocument();
    });
  });

  describe("authoring flag enabled", () => {
    const macroCell = (): WorkbookCell => ({
      id: "macro-1",
      type: "macro",
      isCollapsed: false,
      payload: {
        macroId: "22222222-2222-2222-2222-222222222222",
        language: "python",
        name: "Compute",
      },
    });
    const questionCell = (): WorkbookCell => ({
      id: "q-1",
      type: "question",
      isCollapsed: false,
      name: "Note",
      question: { kind: "open_ended", text: "?", required: false },
      isAnswered: false,
    });

    beforeEach(() => {
      flagState = true;
    });

    it("shows the Static/Dynamic mode toggle for a static cell", () => {
      render(<CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
      expect(screen.getByTestId("command-mode-static")).toBeInTheDocument();
      expect(screen.getByTestId("command-mode-dynamic")).toBeInTheDocument();
    });

    it("switching a static cell to Dynamic replaces the payload with an empty ref (no fallback)", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(
        <CommandCellComponent
          cell={inlineCell({ content: "battery" })}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
        />,
      );
      await user.click(screen.getByTestId("command-mode-dynamic"));
      const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
      expect(updated.payload).toEqual({ kind: "ref", ref: { sourceCellId: "", field: "" } });
    });

    it("switching a ref cell to Static replaces the payload with empty static content", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      render(
        <CommandCellComponent
          cell={refCell()}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          allCells={[macroCell(), refCell()]}
        />,
      );
      await user.click(screen.getByTestId("command-mode-static"));
      const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
      expect(updated.payload).toEqual({ format: "string", content: "" });
    });

    it("edits the field manually and never presents a JSON/YAML format selector in dynamic mode", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      const emptyField: CommandCell = {
        id: "cmd-ref",
        type: "command",
        isCollapsed: false,
        payload: { kind: "ref", ref: { sourceCellId: "macro-1", field: "" } },
      };
      render(
        <CommandCellComponent
          cell={emptyField}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          allCells={[macroCell(), emptyField]}
        />,
      );
      expect(screen.queryByLabelText("cells.commandFormatAria")).not.toBeInTheDocument();
      await user.type(screen.getByTestId("command-field"), "x");
      const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
      expect(updated.payload).toMatchObject({ kind: "ref", ref: { field: "x" } });
    });

    it("a question source exposes only `answer` (no free field input)", () => {
      const cell: CommandCell = {
        id: "cmd-ref",
        type: "command",
        isCollapsed: false,
        payload: { kind: "ref", ref: { sourceCellId: "q-1", field: "answer" } },
      };
      render(
        <CommandCellComponent
          cell={cell}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          allCells={[questionCell(), cell]}
        />,
      );
      expect(screen.getByTestId("command-field-question")).toBeInTheDocument();
      expect(screen.queryByTestId("command-field")).not.toBeInTheDocument();
    });

    const emptyRefCell = (): CommandCell => ({
      id: "cmd-ref",
      type: "command",
      isCollapsed: false,
      payload: { kind: "ref", ref: { sourceCellId: "", field: "" } },
    });
    const protocolCell = (): WorkbookCell => ({
      id: "p-1",
      type: "protocol",
      isCollapsed: false,
      payload: { protocolId: "33333333-3333-3333-3333-333333333333", version: 1 },
    });

    it("selecting a question in the source picker atomically authors { sourceCellId, field: answer }", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      const cell = emptyRefCell();
      render(
        <CommandCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          allCells={[questionCell(), cell]}
        />,
      );
      await user.click(screen.getByTestId("command-source"));
      await user.click(await screen.findByRole("option", { name: /Note/ }));

      const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
      expect(updated.payload).toEqual({
        kind: "ref",
        ref: { sourceCellId: "q-1", field: "answer" },
      });
    });

    it("selecting a non-question source after a question clears the retained `answer`", async () => {
      const user = userEvent.setup();
      const onUpdate = vi.fn();
      const cell: CommandCell = {
        id: "cmd-ref",
        type: "command",
        isCollapsed: false,
        payload: { kind: "ref", ref: { sourceCellId: "q-1", field: "answer" } },
      };
      render(
        <CommandCellComponent
          cell={cell}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          allCells={[questionCell(), protocolCell(), cell]}
        />,
      );
      await user.click(screen.getByTestId("command-source"));
      // The unnamed protocol renders a translated type label, not raw enum text.
      await user.click(
        await screen.findByRole("option", {
          name: /cells\.commandDynamic\.sourceType\.protocol/,
        }),
      );

      const updated = onUpdate.mock.lastCall?.[0] as CommandCell;
      expect(updated.payload).toEqual({
        kind: "ref",
        ref: { sourceCellId: "p-1", field: "" },
      });
    });

    it("renders a translated type fallback for an unnamed source (no raw enum)", async () => {
      const user = userEvent.setup();
      const cell = emptyRefCell();
      render(
        <CommandCellComponent
          cell={cell}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          allCells={[protocolCell(), cell]}
        />,
      );
      await user.click(screen.getByTestId("command-source"));
      const option = await screen.findByRole("option", {
        name: /cells\.commandDynamic\.sourceType\.protocol/,
      });
      // Both the name fallback and the suffix use the translation key; there is
      // no bare enum token rendered as the option's own text.
      expect(option.textContent).not.toMatch(/(^|\s)protocol(\s|$)/);
    });

    it("with authoring enabled a ref exposes delete plus the source/field editors and Run", () => {
      render(
        <CommandCellComponent
          cell={refCell()}
          onUpdate={vi.fn()}
          onDelete={vi.fn()}
          onRun={vi.fn()}
          allCells={[macroCell(), refCell()]}
        />,
      );
      expect(document.querySelector("svg.lucide-trash-2")).not.toBeNull();
      expect(screen.getByTestId("command-source")).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /^Run/ })).toBeInTheDocument();
    });

    it("a broken ref shows repair guidance and preserves the source id (never auto-repaired)", () => {
      // Source "macro-1" is absent from allCells -> SOURCE_MISSING.
      const onUpdate = vi.fn();
      render(
        <CommandCellComponent
          cell={refCell()}
          onUpdate={onUpdate}
          onDelete={vi.fn()}
          allCells={[refCell()]}
        />,
      );
      expect(screen.getByTestId("command-ref-issue")).toHaveTextContent(/missing|deleted/i);
      // The reference is never auto-repaired or dropped: no update is emitted.
      expect(onUpdate).not.toHaveBeenCalled();
    });
  });
});
