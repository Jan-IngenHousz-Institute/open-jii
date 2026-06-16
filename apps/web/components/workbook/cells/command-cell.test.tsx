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

  it("shows the selected command in the picker trigger", () => {
    renderCommand({ payload: { command: "battery" } });
    expect(screen.getByRole("combobox", { name: /select a command/i })).toHaveTextContent(
      "battery",
    );
  });

  it("falls back to the command label as the header name", () => {
    renderCommand({ payload: { command: "battery" } });
    expect(screen.getByText("Battery")).toBeInTheDocument();
  });

  it("prefers a custom name over the command label", () => {
    renderCommand({ payload: { command: "hello", name: "Handshake" } });
    expect(screen.getByText("Handshake")).toBeInTheDocument();
  });

  it("lets the user pick a different known command", async () => {
    const user = userEvent.setup();
    const { onUpdate } = renderCommand({ payload: { command: "hello" } });

    await user.click(screen.getByRole("combobox", { name: /select a command/i }));
    await user.click(await screen.findByText("battery"));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    const updated = onUpdate.mock.calls[0][0] as CommandCell;
    expect(updated.payload.command).toBe("battery");
  });

  it("filters commands via the search box", async () => {
    const user = userEvent.setup();
    renderCommand();

    await user.click(screen.getByRole("combobox", { name: /select a command/i }));
    await user.type(screen.getByPlaceholderText(/search commands/i), "device");

    expect(await screen.findByText("device_info")).toBeInTheDocument();
    expect(screen.queryByText("battery")).not.toBeInTheDocument();
  });

  it("runs the cell when the run button is clicked", async () => {
    const user = userEvent.setup();
    const { onRun } = renderCommand();

    await user.click(screen.getByRole("button", { name: /run/i }));
    expect(onRun).toHaveBeenCalledTimes(1);
  });

  it("renders the command read-only without a picker", () => {
    renderCommand({ payload: { command: "battery" } }, { readOnly: true });
    expect(screen.queryByRole("combobox", { name: /select a command/i })).not.toBeInTheDocument();
    expect(screen.getByText("battery")).toBeInTheDocument();
  });
});
