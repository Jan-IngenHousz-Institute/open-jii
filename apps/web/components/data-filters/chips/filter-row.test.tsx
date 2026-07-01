import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

import { FilterRow } from "./filter-row";

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
const contributorColumn: ExperimentDataColumn = {
  name: "owner",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};

const columns: ExperimentDataColumn[] = [stringColumn, numericColumn, contributorColumn];

function mountDistinct() {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("FilterRow", () => {
  it("renders the remove button labelled by the i18n key", () => {
    mountDistinct();
    const filter: ExperimentDataFilter = { column: "label", operator: "equals", value: "x" };
    render(
      <FilterRow
        filter={filter}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: "dataFilters.removeFilter" })).toBeInTheDocument();
  });

  it("emits the remove callback when the X is clicked", async () => {
    mountDistinct();
    const onRemove = vi.fn();
    render(
      <FilterRow
        filter={{ column: "label", operator: "equals", value: "x" }}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={vi.fn()}
        onRemove={onRemove}
      />,
    );
    await userEvent.setup().click(screen.getByRole("button", { name: "dataFilters.removeFilter" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("emits an operator change preserving column and value", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterRow
        filter={{ column: "label", operator: "equals", value: "x" }}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );

    // The second combobox is the operator select.
    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[1]);
    // "contains" is allowed for categorical strings.
    await user.click(await screen.findByText("contains"));

    expect(onChange).toHaveBeenLastCalledWith({
      column: "label",
      operator: "contains",
      value: "x",
    });
  });

  it("resets the value and routes through the struct sub-path when the column changes", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterRow
        filter={{ column: "label", operator: "equals", value: "x" }}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );

    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    await user.click(await screen.findByText("owner"));

    await waitFor(() =>
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ column: "owner.id", value: "" }),
      ),
    );
  });

  it("coerces the operator when switching to a column with a narrower op set", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <FilterRow
        filter={{ column: "label", operator: "contains", value: "x" }}
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );

    const triggers = screen.getAllByRole("combobox");
    await user.click(triggers[0]);
    await user.click(await screen.findByText("value"));

    await waitFor(() =>
      // numeric columns don't support "contains" — must coerce to equals.
      expect(onChange).toHaveBeenLastCalledWith(
        expect.objectContaining({ column: "value", operator: "equals" }),
      ),
    );
  });
});
