import { server } from "@/test/msw/server";
import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/experiment.schema";

import { ChipValue } from "./chip-value";

function renderValue(filter: ExperimentDataFilter, isContributor = false) {
  return render(
    <ChipValue
      filter={filter}
      isContributor={isContributor}
      fullWidth={false}
      parentColumn={filter.column}
    />,
  );
}

describe("ChipValue", () => {
  it("renders a scalar string value as-is", () => {
    renderValue({ column: "name", operator: "equals", value: "Alice" });
    expect(screen.getByText("Alice")).toBeInTheDocument();
  });

  it("renders the no-value placeholder for empty scalars", () => {
    renderValue({ column: "name", operator: "equals", value: "" });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders a between tuple with an arrow separator", () => {
    renderValue({ column: "value", operator: "between", value: [1, 9] });
    expect(screen.getByText("1 → 9")).toBeInTheDocument();
  });

  it("renders short in-arrays inline", () => {
    renderValue({ column: "label", operator: "in", value: ["a", "b"] });
    expect(screen.getByText("a, b")).toBeInTheDocument();
  });

  it("collapses longer in-arrays into a count label", () => {
    renderValue({ column: "label", operator: "in", value: ["a", "b", "c", "d"] });
    expect(screen.getByText("dataFilters.selectedCount")).toBeInTheDocument();
  });

  it("formats ISO-looking strings as date-time for display", () => {
    renderValue({ column: "ts", operator: "equals", value: "2025-03-04T08:30:00.000Z" });
    // Local time formatting; assert the date portion appears.
    expect(screen.getByText(/2025-03-0/)).toBeInTheDocument();
  });

  it("delegates to ContributorChipValue when isContributor is true", () => {
    // The contributor chip fetches distinct values; mount a stub so it doesn't warn.
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [], truncated: false },
    });
    render(
      <ChipValue
        filter={{ column: "owner.id", operator: "equals", value: "" }}
        isContributor
        fullWidth={false}
        parentColumn="owner"
        experimentId="exp-1"
        tableName="raw_data"
      />,
    );
    // Empty selection from the contributor chip renders the "-" placeholder.
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
