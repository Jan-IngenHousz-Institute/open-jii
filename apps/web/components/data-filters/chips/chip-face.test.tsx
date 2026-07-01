import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type {
  ExperimentDataColumn,
  ExperimentDataFilter,
} from "@repo/api/domains/experiment/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/experiment.schema";

import { FilterChipFace } from "./chip-face";

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

describe("FilterChipFace", () => {
  it("shows the parent column name and the operator label for the column kind", () => {
    const filter: ExperimentDataFilter = { column: "label", operator: "contains", value: "abc" };
    render(<FilterChipFace filter={filter} column={stringColumn} onRemove={vi.fn()} />);

    expect(screen.getByText("label")).toBeInTheDocument();
    expect(screen.getByText("contains")).toBeInTheDocument();
    expect(screen.getByText("abc")).toBeInTheDocument();
  });

  it("falls back to the operator value when no label is defined for the column kind", () => {
    const filter: ExperimentDataFilter = { column: "value", operator: "greater_than", value: 5 };
    render(<FilterChipFace filter={filter} column={numericColumn} onRemove={vi.fn()} />);

    expect(screen.getByText(">")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
  });

  it("opens via the main button and removes via the X — without bubbling click into open", async () => {
    const onClick = vi.fn();
    const onRemove = vi.fn();
    const filter: ExperimentDataFilter = { column: "label", operator: "equals", value: "x" };
    render(
      <FilterChipFace
        filter={filter}
        column={stringColumn}
        onClick={onClick}
        onRemove={onRemove}
      />,
    );

    const user = userEvent.setup();
    await user.click(screen.getByText("label"));
    expect(onClick).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "dataFilters.removeFilterOn" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
    // X click must not propagate to the open handler.
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("shows the parent column name when the filter targets a struct sub-field", () => {
    server.mount(contract.experiments.getDistinctColumnValues, {
      body: { values: [], truncated: false },
    });
    const contributorColumn: ExperimentDataColumn = {
      name: "owner",
      type_name: "STRUCT",
      type_text: WellKnownColumnTypes.CONTRIBUTOR,
    };
    const filter: ExperimentDataFilter = { column: "owner.id", operator: "equals", value: "u-1" };
    render(
      <FilterChipFace
        filter={filter}
        column={contributorColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onRemove={vi.fn()}
      />,
    );

    // The struct sub-path is hidden; the column label shows the parent name.
    expect(screen.getByText("owner")).toBeInTheDocument();
  });
});
