import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn, ExperimentDataFilter } from "@repo/api/domains/experiment/experiment.schema";

import { FilterChipList } from "./filter-chip-list";

const stringColumn: ExperimentDataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };
const columns: ExperimentDataColumn[] = [stringColumn];

const baseFilter: ExperimentDataFilter = { column: "label", operator: "equals", value: "hello" };

function mountDistinct() {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("FilterChipList", () => {
  it("renders a row per filter plus the add-filter trigger", () => {
    mountDistinct();
    render(
      <FilterChipList
        value={[baseFilter, { ...baseFilter, value: "world" }]}
        onChange={vi.fn()}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    expect(screen.getByText("hello")).toBeInTheDocument();
    expect(screen.getByText("world")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dataFilters.addFilter" })).toBeInTheDocument();
  });

  it("emits a list with the filter removed and re-indexes the remaining items", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChipList
        value={[baseFilter, { ...baseFilter, value: "world" }]}
        onChange={onChange}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    const removeButtons = screen.getAllByRole("button", { name: "dataFilters.removeFilterOn" });
    await user.click(removeButtons[0]);

    expect(onChange).toHaveBeenLastCalledWith([{ ...baseFilter, value: "world" }]);
  });

  it("expands a chip into its filter row when its face is clicked", async () => {
    mountDistinct();
    const user = userEvent.setup();
    render(
      <FilterChipList
        value={[baseFilter]}
        onChange={vi.fn()}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    await user.click(screen.getByText("hello"));
    // The expanded row exposes the remove-filter button.
    expect(screen.getByRole("button", { name: "dataFilters.removeFilter" })).toBeInTheDocument();
  });

  it("opens the AddFilterPopover when the user clicks the add trigger", async () => {
    mountDistinct();
    const user = userEvent.setup();
    render(
      <FilterChipList
        value={[baseFilter]}
        onChange={vi.fn()}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    await user.click(screen.getByRole("button", { name: "dataFilters.addFilter" }));

    // Popover shows the column search input; it's distinct from the chip face.
    expect(
      screen.getByPlaceholderText("dataFilters.filterByColumnPlaceholder"),
    ).toBeInTheDocument();
  });

  it("clears the expanded index when the actively-expanded chip is removed", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChipList
        value={[baseFilter, { ...baseFilter, value: "world" }]}
        onChange={onChange}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    // Expand the first chip, then remove it via the expanded row's button.
    await user.click(screen.getByText("hello"));
    await user.click(screen.getByRole("button", { name: "dataFilters.removeFilter" }));

    expect(onChange).toHaveBeenLastCalledWith([{ ...baseFilter, value: "world" }]);
  });

  it("shifts the expanded index down when a chip below it is removed", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterChipList
        value={[baseFilter, { ...baseFilter, value: "world" }]}
        onChange={onChange}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );

    // Expand the second chip, then remove the first chip (compact row).
    await user.click(screen.getByText("world"));
    const removeChipFaceButtons = screen.getAllByRole("button", {
      name: "dataFilters.removeFilterOn",
    });
    await user.click(removeChipFaceButtons[0]);

    expect(onChange).toHaveBeenLastCalledWith([{ ...baseFilter, value: "world" }]);
  });
});
