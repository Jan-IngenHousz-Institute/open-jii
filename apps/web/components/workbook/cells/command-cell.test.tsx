import { render, screen, userEvent } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import type { CommandCell } from "@repo/api/schemas/workbook-cells.schema";

import { CommandCellComponent } from "./command-cell";

function inlineCell(overrides: Partial<CommandCell["payload"]> = {}): CommandCell {
  return {
    id: "cmd-1",
    type: "command",
    isCollapsed: false,
    payload: { format: "string", content: "battery", ...overrides },
  };
}

describe("CommandCellComponent", () => {
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
    expect(screen.getByLabelText("Command format")).toBeInTheDocument();

    rerender(
      <CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} readOnly />,
    );
    expect(screen.queryByLabelText("Command format")).not.toBeInTheDocument();
  });
});
