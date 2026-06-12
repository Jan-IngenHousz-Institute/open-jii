import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DataColumn, DataFilter } from "@repo/api/schemas/experiment.schema";

import { FilterChipBar } from "./filter-chip-bar";

const stringColumn: DataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };
const numericColumn: DataColumn = { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" };

const columns: DataColumn[] = [stringColumn, numericColumn];

function mountDistinct() {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("FilterChipBar", () => {
  it("renders one chip per filter and the add-filter trigger", () => {
    mountDistinct();
    const filters: DataFilter[] = [
      { column: "label", operator: "equals", value: "hello" },
      { column: "value", operator: "greater_than", value: 5 },
    ];
    render(
      <FilterChipBar
        value={filters}
        onChange={vi.fn()}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dataFilters.addFilter" })).toBeInTheDocument();
  });

  it("emits the list with the targeted filter removed", async () => {
    mountDistinct();
    const filters: DataFilter[] = [
      { column: "label", operator: "equals", value: "hello" },
      { column: "value", operator: "greater_than", value: 5 },
    ];
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChipBar
        value={filters}
        onChange={onChange}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    const removeButtons = screen.getAllByRole("button", { name: "dataFilters.removeFilterOn" });
    await user.click(removeButtons[1]);

    expect(onChange).toHaveBeenLastCalledWith([
      { column: "label", operator: "equals", value: "hello" },
    ]);
  });

  it("resolves the column metadata for struct sub-paths via the parent column name", () => {
    mountDistinct();
    const filters: DataFilter[] = [{ column: "label.value", operator: "equals", value: "hi" }];
    render(
      <FilterChipBar
        value={filters}
        onChange={vi.fn()}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    // The chip face shows the parent column name and the equals label.
    expect(screen.getByText("label")).toBeInTheDocument();
    expect(screen.getByText("is")).toBeInTheDocument();
  });

  it("emits a new list with the chip's operator change applied in place", async () => {
    mountDistinct();
    const filters: DataFilter[] = [
      { column: "label", operator: "equals", value: "hello" },
      { column: "value", operator: "greater_than", value: 5 },
    ];
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChipBar
        value={filters}
        onChange={onChange}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    // Open the first chip and swap to "contains" via the operator picker.
    await user.click(screen.getByText("hello"));
    const operatorPicker = screen.getAllByRole("combobox")[0];
    await user.click(operatorPicker);
    await user.click(await screen.findByRole("option", { name: "contains" }));
    await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));

    expect(onChange).toHaveBeenLastCalledWith([
      expect.objectContaining({ column: "label", operator: "contains" }),
      filters[1],
    ]);
  });

  it("appends a filter to the existing list when one is added via the popover", async () => {
    mountDistinct();
    const filters: DataFilter[] = [{ column: "label", operator: "equals", value: "hello" }];
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChipBar
        value={filters}
        onChange={onChange}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    await user.click(screen.getByRole("button", { name: "dataFilters.addFilter" }));
    await user.click(screen.getByText("value"));

    const numericInput = screen.getByRole("spinbutton");
    await user.type(numericInput, "42");
    await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));

    expect(onChange).toHaveBeenLastCalledWith([
      filters[0],
      expect.objectContaining({ column: "value", operator: "equals", value: 42 }),
    ]);
  });
});
