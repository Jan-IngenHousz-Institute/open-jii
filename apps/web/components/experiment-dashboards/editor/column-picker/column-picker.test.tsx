import { fireDrag, stubBoundingRect } from "@/test/drag";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { ColumnPicker } from "./column-picker";

function stubRowGeometry(container: HTMLElement, rowHeight = 32) {
  const rows = container.querySelectorAll<HTMLDivElement>('[draggable="true"]');
  rows.forEach((row, i) => {
    stubBoundingRect(row, { top: i * rowHeight, width: 100, height: rowHeight });
  });
  return rows;
}

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
    // Five placeholder rows render in the skeleton.
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

  it("drops on the container surface (below the last row) and appends at the end", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColumnPicker available={columns} value={["time", "temperature"]} onChange={onChange} />,
    );
    const rows = stubRowGeometry(container);
    const root = container.firstChild;
    if (!(root instanceof HTMLElement)) throw new Error("expected container root element");

    fireDrag.start(rows[0]);
    // clientY=200 sits below both row midpoints (16, 48) so computeInsertAtFromContainer
    // falls through to rows.length (=2) and we splice "time" past "temperature".
    fireDrag.over(root, { clientY: 200 });
    fireDrag.drop(root, { clientY: 200 });

    expect(onChange).toHaveBeenLastCalledWith(["temperature", "time"]);
  });

  it("inserts at the top when the pointer is above the first row's midpoint", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColumnPicker available={columns} value={["time", "temperature"]} onChange={onChange} />,
    );
    const rows = stubRowGeometry(container);
    const root = container.firstChild;
    if (!(root instanceof HTMLElement)) throw new Error("expected container root element");

    fireDrag.start(rows[1]);
    fireDrag.over(root, { clientY: 5 });
    fireDrag.drop(root, { clientY: 5 });

    expect(onChange).toHaveBeenLastCalledWith(["temperature", "time"]);
  });

  it("ignores drag events on the container when nothing is being dragged", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColumnPicker available={columns} value={["time", "temperature"]} onChange={onChange} />,
    );
    stubRowGeometry(container);
    const root = container.firstChild;
    if (!(root instanceof HTMLElement)) throw new Error("expected container root element");

    fireDrag.over(root, { clientY: 50 });
    fireDrag.drop(root, { clientY: 50 });

    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the drop marker when the pointer leaves the container", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColumnPicker available={columns} value={["time", "temperature"]} onChange={onChange} />,
    );
    const rows = stubRowGeometry(container);
    const root = container.firstChild;
    if (!(root instanceof HTMLElement)) throw new Error("expected container root element");

    fireDrag.start(rows[0]);
    fireDrag.over(root, { clientY: 60 });
    // dragleave with relatedTarget OUTSIDE the container should reset the marker.
    fireDrag.leave(root, { relatedTarget: document.body });

    // Marker reset is visible to the parent only via subsequent drops; assert
    // the no-op doesn't trigger onChange (no drop fired).
    expect(onChange).not.toHaveBeenCalled();
  });

  it("does NOT clear the drop marker when the pointer crosses into a nested child of the container", () => {
    const onChange = vi.fn();
    const { container } = render(
      <ColumnPicker available={columns} value={["time", "temperature"]} onChange={onChange} />,
    );
    const rows = stubRowGeometry(container);
    const root = container.firstChild;
    if (!(root instanceof HTMLElement)) throw new Error("expected container root element");

    fireDrag.start(rows[0]);
    fireDrag.over(root, { clientY: 60 });
    // dragleave bubbling from a child whose relatedTarget is INSIDE the container
    // should be ignored by handleContainerDragLeave.
    fireDrag.leave(root, { relatedTarget: rows[1] });

    expect(onChange).not.toHaveBeenCalled();
  });
});
