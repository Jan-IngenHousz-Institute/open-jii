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
  } as CommandCell;
}

describe("CommandCellComponent", () => {
  it("renders the command content in an editable field", () => {
    render(<CommandCellComponent cell={inlineCell()} onUpdate={vi.fn()} onDelete={vi.fn()} />);
    expect(screen.getByLabelText("Device command")).toHaveValue("battery");
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
    await user.type(screen.getByLabelText("Device command"), "h");
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
