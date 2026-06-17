import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { AddColumnPopover } from "./add-column-popover";

const remaining: DataColumn[] = [
  { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
];

describe("AddColumnPopover", () => {
  it("renders the addColumn trigger button", () => {
    render(<AddColumnPopover remaining={remaining} onAdd={vi.fn()} />);
    expect(screen.getByRole("button", { name: /columnPicker.addColumn/ })).toBeInTheDocument();
  });

  it("opens the command list with the searchable input on click", async () => {
    const user = userEvent.setup();
    render(<AddColumnPopover remaining={remaining} onAdd={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /columnPicker.addColumn/ }));
    expect(screen.getByPlaceholderText("columnPicker.searchPlaceholder")).toBeInTheDocument();
  });

  it("lists every remaining column and its type badge", async () => {
    const user = userEvent.setup();
    render(<AddColumnPopover remaining={remaining} onAdd={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: /columnPicker.addColumn/ }));
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("temperature")).toBeInTheDocument();
    expect(screen.getByText("TIMESTAMP")).toBeInTheDocument();
  });

  it("calls onAdd with the chosen column name and closes the popover", async () => {
    const user = userEvent.setup();
    const onAdd = vi.fn();
    render(<AddColumnPopover remaining={remaining} onAdd={onAdd} />);
    await user.click(screen.getByRole("button", { name: /columnPicker.addColumn/ }));
    await user.click(screen.getByRole("option", { name: /temperature/ }));
    expect(onAdd).toHaveBeenCalledWith("temperature");
    // Popover closes; the search input should no longer be rendered.
    expect(screen.queryByPlaceholderText("columnPicker.searchPlaceholder")).not.toBeInTheDocument();
  });
});
