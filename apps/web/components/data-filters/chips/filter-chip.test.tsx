import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { FilterChip } from "./filter-chip";

const stringColumn: ExperimentDataColumn = {
  name: "label",
  type_name: "STRING",
  type_text: "STRING",
};

function mountDistinct() {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("FilterChip", () => {
  it("opens the popover when the chip face is clicked", async () => {
    mountDistinct();
    const filter: ExperimentDataFilter = { column: "label", operator: "equals", value: "hello" };
    render(
      <FilterChip
        filter={filter}
        column={stringColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    await userEvent.setup().click(screen.getByText("hello"));
    expect(screen.getByRole("button", { name: "dataFilters.remove" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "dataFilters.apply" })).toBeInTheDocument();
  });

  it("does not commit when the draft equals the original filter on apply", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const filter: ExperimentDataFilter = { column: "label", operator: "equals", value: "hello" };
    const user = userEvent.setup();
    render(
      <FilterChip
        filter={filter}
        column={stringColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByText("hello"));
    await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));

    // Apply with an unchanged draft is a no-op for onChange.
    expect(onChange).not.toHaveBeenCalled();
  });

  it("invokes onRemove and closes when the remove button is pressed", async () => {
    mountDistinct();
    const onRemove = vi.fn();
    const filter: ExperimentDataFilter = { column: "label", operator: "equals", value: "hello" };
    const user = userEvent.setup();
    render(
      <FilterChip
        filter={filter}
        column={stringColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={vi.fn()}
        onRemove={onRemove}
      />,
    );

    await user.click(screen.getByText("hello"));
    await user.click(screen.getByRole("button", { name: "dataFilters.remove" }));
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

  it("disables apply when the draft is incomplete", async () => {
    mountDistinct();
    const filter: ExperimentDataFilter = { column: "label", operator: "in", value: [] };
    const user = userEvent.setup();
    render(
      <FilterChip
        filter={filter}
        column={stringColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={vi.fn()}
        onRemove={vi.fn()}
      />,
    );

    // The chip face shows "—" for an empty `in` value; click it to open.
    await user.click(screen.getByText("—"));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "dataFilters.apply" })).toBeDisabled(),
    );
  });

  it("emits onChange when the operator changes and apply is pressed", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const filter: ExperimentDataFilter = { column: "label", operator: "equals", value: "hello" };
    const user = userEvent.setup();
    render(
      <FilterChip
        filter={filter}
        column={stringColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );

    await user.click(screen.getByText("hello"));
    // The popover has two comboboxes (operator picker + the categorical
    // value-input). Operator picker is mounted first.
    const operatorPicker = screen.getAllByRole("combobox")[0];
    await user.click(operatorPicker);
    await user.click(await screen.findByRole("option", { name: "contains" }));
    await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ operator: "contains", value: "hello" }),
    );
  });

  it("treats unchanged array-value drafts as equal and skips onChange on apply", async () => {
    mountDistinct();
    const onChange = vi.fn();
    const filter: ExperimentDataFilter = { column: "label", operator: "in", value: ["a", "b"] };
    const user = userEvent.setup();
    render(
      <FilterChip
        filter={filter}
        column={stringColumn}
        experimentId="exp-1"
        tableName="raw_data"
        onChange={onChange}
        onRemove={vi.fn()}
      />,
    );

    // The face renders the inline list "a, b" for a small `in` value.
    await user.click(screen.getByText("a, b"));
    // Apply with no edits closes the popover via filtersEqual array path.
    await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));

    expect(onChange).not.toHaveBeenCalled();
  });
});
