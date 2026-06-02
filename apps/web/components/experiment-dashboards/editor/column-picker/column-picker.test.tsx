import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { ColumnPicker } from "./column-picker";

const columns: DataColumn[] = [
  { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
  { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" },
  { name: "humidity", type_name: "DOUBLE", type_text: "DOUBLE" },
];

describe("ColumnPicker", () => {
  it("shows the skeleton while loading with no columns available yet", () => {
    const { container } = render(
      <ColumnPicker available={[]} value={undefined} onChange={vi.fn()} isLoading />,
    );
    expect(container.querySelectorAll("div.flex.h-8").length).toBe(5);
  });

  it("falls back to every available column in natural order when value is undefined", () => {
    render(<ColumnPicker available={columns} value={undefined} onChange={vi.fn()} />);
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.getByText("temperature")).toBeInTheDocument();
    expect(screen.getByText("humidity")).toBeInTheDocument();
  });

  it("renders only the columns listed in `value`", () => {
    render(<ColumnPicker available={columns} value={["humidity"]} onChange={vi.fn()} />);
    expect(screen.getByText("humidity")).toBeInTheDocument();
    expect(screen.queryByText("time")).not.toBeInTheDocument();
  });

  it("shows the empty state hint when value is an empty array", () => {
    render(<ColumnPicker available={columns} value={[]} onChange={vi.fn()} />);
    expect(screen.getByText("columnPicker.emptyState")).toBeInTheDocument();
  });

  it("emits the remaining names when a column row is removed", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <ColumnPicker available={columns} value={["time", "temperature"]} onChange={onChange} />,
    );
    const removeButtons = screen.getAllByRole("button", { name: /columnPicker.remove/ });
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenCalledWith(["temperature"]);
  });

  it("emits the appended name when a remaining column is added via the popover", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<ColumnPicker available={columns} value={["time"]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: /columnPicker.addColumn/ }));
    await user.click(screen.getByRole("option", { name: /humidity/ }));
    expect(onChange).toHaveBeenCalledWith(["time", "humidity"]);
  });

  it("filters out names in `value` that aren't in the available list", () => {
    render(
      <ColumnPicker available={columns} value={["time", "deleted_column"]} onChange={vi.fn()} />,
    );
    expect(screen.getByText("time")).toBeInTheDocument();
    expect(screen.queryByText("deleted_column")).not.toBeInTheDocument();
  });
});
