import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn, ExperimentDataFilter } from "@repo/api/domains/experiment/experiment.schema";

import { FilterChipItem } from "./filter-chip-item";

const stringColumn: ExperimentDataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };
const columns: ExperimentDataColumn[] = [stringColumn];

const baseFilter: ExperimentDataFilter = { column: "label", operator: "equals", value: "hello" };

describe("FilterChipItem", () => {
  it("renders the compact chip face when not expanded", async () => {
    const onSelect = vi.fn();
    render(
      <FilterChipItem
        filter={baseFilter}
        column={stringColumn}
        columns={columns}
        expanded={false}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={vi.fn()}
        onSelect={onSelect}
        onRemove={vi.fn()}
      />,
    );

    expect(screen.getByText("hello")).toBeInTheDocument();
    await userEvent.setup().click(screen.getByText("label"));
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it("renders the expanded filter row when expanded", () => {
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [], truncated: false },
    });
    render(
      <FilterChipItem
        filter={baseFilter}
        column={stringColumn}
        columns={columns}
        expanded
        experimentId="exp-1"
        tableName="raw_data"
        onChange={vi.fn()}
        onSelect={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    // The expanded row exposes the column selector and the remove button.
    expect(screen.getAllByRole("combobox").length).toBeGreaterThan(0);
    expect(screen.getByRole("button", { name: "dataFilters.removeFilter" })).toBeInTheDocument();
  });
});
