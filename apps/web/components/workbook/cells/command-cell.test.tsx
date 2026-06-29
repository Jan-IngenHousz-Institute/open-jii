import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach } from "vitest";

import type { CommandCell } from "@repo/api/schemas/workbook-cells.schema";

import { CommandCellComponent } from "./command-cell";

function makeCommandCell(overrides: Partial<CommandCell> = {}): CommandCell {
  return {
    id: "cmd-1",
    type: "command",
    isCollapsed: false,
    payload: { command: "hello" },
    ...overrides,
  };
}

function renderCommand(
  overrides: Partial<CommandCell> = {},
  props: Partial<React.ComponentProps<typeof CommandCellComponent>> = {},
) {
  const onUpdate = vi.fn();
  const onDelete = vi.fn();
  const onRun = vi.fn();
  const cell = makeCommandCell(overrides);
  const result = render(
    <CommandCellComponent
      cell={cell}
      onUpdate={onUpdate}
      onDelete={onDelete}
      onRun={onRun}
      {...props}
    />,
  );
  return { ...result, onUpdate, onDelete, onRun, cell };
}

describe("CommandCellComponent", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the command editor in edit mode", () => {
    renderCommand({ payload: { command: "battery" } });
    // CodeMirror is not interactively testable in jsdom; assert the editor surface.
    // The i18n mock returns the key verbatim, so we match on the translation key.
    expect(screen.getByLabelText("command.editorAriaLabel")).toBeInTheDocument();
  });

  it("falls back to the command label as the header name", () => {
    renderCommand({ payload: { command: "battery" } });
    expect(screen.getByText("Battery")).toBeInTheDocument();
  });

  it("prefers a custom name over the command label", () => {
    renderCommand({ payload: { command: "hello", name: "Handshake" } });
    expect(screen.getByText("Handshake")).toBeInTheDocument();
  });

  it("uses a custom (non-known) command as the header name", () => {
    renderCommand({ payload: { command: "set_led_delay+1" } });
    // Appears both in the cell header and inside the editor surface.
    expect(screen.getAllByText("set_led_delay+1").length).toBeGreaterThan(0);
  });

  it("runs the cell when the run button is clicked", async () => {
    const user = userEvent.setup();
    const { onRun } = renderCommand();

    await user.click(screen.getByRole("button", { name: /run/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("renders the command read-only without an editor", () => {
    renderCommand({ payload: { command: "battery" } }, { readOnly: true });
    expect(screen.queryByLabelText("command.editorAriaLabel")).not.toBeInTheDocument();
    expect(screen.getByText("battery")).toBeInTheDocument();
  });
});
