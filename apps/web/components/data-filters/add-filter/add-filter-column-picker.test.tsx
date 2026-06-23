import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { AddFilterColumnPicker } from "./add-filter-column-picker";

const numericColumn: ExperimentDataColumn = { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" };
const stringColumn: ExperimentDataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };
const timestampColumn: ExperimentDataColumn = {
  name: "ts",
  type_name: "TIMESTAMP",
  type_text: "TIMESTAMP",
};
const arrayColumn: ExperimentDataColumn = {
  name: "tags",
  type_name: "ARRAY",
  type_text: "ARRAY<STRING>",
};

describe("AddFilterColumnPicker", () => {
  it("groups columns under headings by column kind", () => {
    render(
      <AddFilterColumnPicker
        columns={[stringColumn, numericColumn, timestampColumn, arrayColumn]}
        onPick={vi.fn()}
      />,
    );

    expect(screen.getByText("dataFilters.kindTemporal")).toBeInTheDocument();
    expect(screen.getByText("dataFilters.kindNumeric")).toBeInTheDocument();
    expect(screen.getByText("dataFilters.kindCategorical")).toBeInTheDocument();
    expect(screen.getByText("dataFilters.kindComplex")).toBeInTheDocument();
  });

  it("invokes onPick with the column when an option is clicked", async () => {
    const onPick = vi.fn();
    render(<AddFilterColumnPicker columns={[stringColumn, numericColumn]} onPick={onPick} />);

    await userEvent.setup().click(screen.getByText("label"));
    expect(onPick).toHaveBeenCalledWith(stringColumn);
  });

  it("shows the empty state when no columns are filterable", () => {
    render(<AddFilterColumnPicker columns={[]} onPick={vi.fn()} />);
    expect(screen.getByText("dataFilters.noColumnsToFilter")).toBeInTheDocument();
  });

  it("renders the search input with the i18n placeholder", () => {
    render(<AddFilterColumnPicker columns={[stringColumn]} onPick={vi.fn()} />);
    expect(
      screen.getByPlaceholderText("dataFilters.filterByColumnPlaceholder"),
    ).toBeInTheDocument();
  });

  it("omits empty kind groups", () => {
    render(<AddFilterColumnPicker columns={[stringColumn]} onPick={vi.fn()} />);
    expect(screen.getByText("dataFilters.kindCategorical")).toBeInTheDocument();
    expect(screen.queryByText("dataFilters.kindTemporal")).not.toBeInTheDocument();
    expect(screen.queryByText("dataFilters.kindNumeric")).not.toBeInTheDocument();
  });
});
