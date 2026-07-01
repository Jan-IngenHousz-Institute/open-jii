import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { FilterValueInput } from "./value-input";

const stringColumn: ExperimentDataColumn = {
  name: "label",
  type_name: "STRING",
  type_text: "STRING",
};
const numericColumn: ExperimentDataColumn = {
  name: "value",
  type_name: "DOUBLE",
  type_text: "DOUBLE",
};
const timestampColumn: ExperimentDataColumn = {
  name: "ts",
  type_name: "TIMESTAMP",
  type_text: "TIMESTAMP",
};

function mountDistinct() {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("FilterValueInput", () => {
  it("renders the date range input when operator is between on a temporal column", () => {
    render(
      <FilterValueInput
        column={timestampColumn}
        operator="between"
        value={[]}
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByRole("button", { name: "dataFilters.pickRange" })).toBeInTheDocument();
  });

  it("renders the numeric range input when operator is between on a numeric column", () => {
    render(
      <FilterValueInput
        column={numericColumn}
        operator="between"
        value={[]}
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByPlaceholderText("dataFilters.rangeFrom")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("dataFilters.rangeTo")).toBeInTheDocument();
  });

  it("uses the categorical multi-select for in operator on a categorical column", () => {
    mountDistinct();
    render(
      <FilterValueInput
        column={stringColumn}
        operator="in"
        value={[]}
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("dataFilters.pickValues");
  });

  it("falls back to comma-separated input for in operator on numeric columns", () => {
    render(
      <FilterValueInput
        column={numericColumn}
        operator="in"
        value={[]}
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(
      screen.getByPlaceholderText("dataFilters.placeholderCommaSeparated"),
    ).toBeInTheDocument();
  });

  it("renders the date-time picker for temporal scalar operators", () => {
    render(
      <FilterValueInput
        column={timestampColumn}
        operator="equals"
        value=""
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByRole("button", { name: "dataFilters.pickDate" })).toBeInTheDocument();
  });

  it("renders the numeric input for numeric scalar operators", () => {
    render(
      <FilterValueInput
        column={numericColumn}
        operator="equals"
        value=""
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByRole("spinbutton")).toBeInTheDocument();
  });

  it("uses the substring placeholder for contains operator on unclassified columns", () => {
    render(
      <FilterValueInput
        column={undefined}
        operator="contains"
        value=""
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByPlaceholderText("dataFilters.placeholderSubstring")).toBeInTheDocument();
  });

  it("renders the categorical single-select for equals on a categorical column", () => {
    mountDistinct();
    render(
      <FilterValueInput
        column={stringColumn}
        operator="equals"
        value=""
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("dataFilters.pickValue");
  });

  it("falls back to a generic text input when column is unknown", () => {
    render(
      <FilterValueInput
        column={undefined}
        operator="equals"
        value=""
        onChange={vi.fn()}
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    expect(screen.getByPlaceholderText("dataFilters.placeholderValue")).toBeInTheDocument();
  });
});
