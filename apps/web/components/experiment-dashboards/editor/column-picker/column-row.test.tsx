import { fireDrag, stubBoundingRect } from "@/test/drag";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { DataColumn } from "@repo/api/schemas/experiment.schema";

import { ColumnRow } from "./column-row";

const column: DataColumn = { name: "temperature", type_name: "DOUBLE", type_text: "DOUBLE" };

function setup(
  opts: {
    isLast?: boolean;
    draggedIndex?: number | null;
    dropInsertIndex?: number | null;
    column?: DataColumn | undefined;
    index?: number;
  } = {},
) {
  const onDragStart = vi.fn();
  const onDragOverRow = vi.fn();
  const onDropRow = vi.fn();
  const onDragEnd = vi.fn();
  const onRemove = vi.fn();
  const result = render(
    <ColumnRow
      name="temperature"
      index={opts.index ?? 0}
      column={"column" in opts ? opts.column : column}
      isLast={opts.isLast ?? true}
      draggedIndex={opts.draggedIndex ?? null}
      dropInsertIndex={opts.dropInsertIndex ?? null}
      rowRef={() => undefined}
      onDragStart={onDragStart}
      onDragOverRow={onDragOverRow}
      onDropRow={onDropRow}
      onDragEnd={onDragEnd}
      onRemove={onRemove}
    />,
  );
  // ColumnRow's outer element is the draggable row; reach for it directly so
  // event-listener identity matches when fireEvent fires on it below.
  const row = result.container.firstChild;
  if (!(row instanceof HTMLElement)) {
    throw new Error("expected ColumnRow to render an HTMLElement as its root");
  }
  return { ...result, row, onRemove, onDragStart, onDragOverRow, onDropRow, onDragEnd };
}

describe("ColumnRow", () => {
  it("renders the column name and its type badge", () => {
    setup();
    expect(screen.getByText("temperature")).toBeInTheDocument();
    expect(screen.getByText("DOUBLE")).toBeInTheDocument();
  });

  it("omits the type badge when no column metadata is available", () => {
    setup({ column: undefined });
    expect(screen.getByText("temperature")).toBeInTheDocument();
    expect(screen.queryByText("DOUBLE")).not.toBeInTheDocument();
  });

  it("invokes onRemove with the column name when the remove button is clicked", async () => {
    const user = userEvent.setup();
    const { onRemove } = setup();
    await user.click(screen.getByRole("button", { name: /columnPicker.remove/ }));
    expect(onRemove).toHaveBeenCalledWith("temperature");
  });

  it("exposes a drag handle labelled by the column name (a11y)", () => {
    setup();
    expect(screen.getByLabelText(/columnPicker.dragHandle/)).toBeInTheDocument();
  });

  it("invokes onDragStart when the row starts being dragged", () => {
    const { row, onDragStart } = setup();
    fireDrag.start(row);
    expect(onDragStart).toHaveBeenCalledTimes(1);
  });

  it("emits index when the pointer is in the upper half of the row", () => {
    const { row, onDragOverRow } = setup({ index: 2 });
    stubBoundingRect(row, { top: 0, height: 100 }); // midpoint = 50
    fireDrag.over(row, { clientY: 10 });
    expect(onDragOverRow).toHaveBeenLastCalledWith(2);
  });

  it("emits index+1 when the pointer is in the lower half of the row", () => {
    const { row, onDragOverRow } = setup({ index: 2 });
    stubBoundingRect(row, { top: 0, height: 100 }); // midpoint = 50
    fireDrag.over(row, { clientY: 90 });
    expect(onDragOverRow).toHaveBeenLastCalledWith(3);
  });

  it("highlights the top edge when this row is the drop insertion target", () => {
    const { row } = setup({ index: 1, dropInsertIndex: 1, draggedIndex: 0 });
    expect(row.className).toContain("border-t-2");
  });

  it("highlights the bottom edge when this is the last row and the drop is after it", () => {
    const { row } = setup({ index: 0, isLast: true, dropInsertIndex: 1, draggedIndex: null });
    expect(row.className).toContain("border-b-2");
  });

  it("dims the row while it is the one being dragged", () => {
    const { row } = setup({ index: 0, draggedIndex: 0 });
    expect(row.className).toContain("opacity-40");
  });

  it("invokes onDropRow with the computed insertion point on drop", () => {
    const { row, onDropRow } = setup({ index: 1 });
    stubBoundingRect(row, { top: 32, height: 32 });
    fireDrag.drop(row, { clientY: 60 });
    expect(onDropRow).toHaveBeenCalled();
  });

  it("invokes onDragEnd when the drag interaction ends", () => {
    const { row, onDragEnd } = setup();
    fireDrag.end(row);
    expect(onDragEnd).toHaveBeenCalledTimes(1);
  });
});
