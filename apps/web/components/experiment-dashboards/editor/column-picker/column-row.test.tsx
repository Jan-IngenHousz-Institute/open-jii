import { render, screen, userEvent } from "@/test/test-utils";
import { DndContext } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { ColumnRow } from "./column-row";

const column: ExperimentDataColumn = {
  name: "temperature",
  type_name: "DOUBLE",
  type_text: "DOUBLE",
};

function setup(opts: { column?: ExperimentDataColumn | undefined } = {}) {
  const onRemove = vi.fn();
  const result = render(
    <DndContext>
      <SortableContext items={["temperature"]} strategy={verticalListSortingStrategy}>
        <ColumnRow
          name="temperature"
          column={"column" in opts ? opts.column : column}
          onRemove={onRemove}
        />
      </SortableContext>
    </DndContext>,
  );
  return { ...result, onRemove };
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
});
