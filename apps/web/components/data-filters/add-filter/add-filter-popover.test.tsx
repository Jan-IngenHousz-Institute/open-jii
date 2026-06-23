import { server } from "@/test/msw/server";
import { render, screen, userEvent } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";

import { AddFilterPopover } from "./add-filter-popover";

const stringColumn: ExperimentDataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };
const numericColumn: ExperimentDataColumn = { name: "value", type_name: "DOUBLE", type_text: "DOUBLE" };

const columns: ExperimentDataColumn[] = [stringColumn, numericColumn];

function mountDistinct() {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values: [], truncated: false },
  });
}

describe("AddFilterPopover", () => {
  it("shows the trigger button labelled by the addFilter i18n key", () => {
    render(
      <AddFilterPopover
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onAdd={vi.fn()}
      />,
    );
    expect(screen.getByRole("button", { name: /dataFilters.addFilter/ })).toBeInTheDocument();
  });

  it("opens the column picker when the trigger is clicked", async () => {
    mountDistinct();
    const user = userEvent.setup();
    render(
      <AddFilterPopover
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onAdd={vi.fn()}
      />,
    );
    await user.click(screen.getByRole("button", { name: /dataFilters.addFilter/ }));
    expect(
      screen.getByPlaceholderText("dataFilters.filterByColumnPlaceholder"),
    ).toBeInTheDocument();
  });

  it("transitions to the draft editor when a column is picked", async () => {
    mountDistinct();
    const user = userEvent.setup();
    render(
      <AddFilterPopover
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onAdd={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("button", { name: /dataFilters.addFilter/ }));
    await user.click(screen.getByText("value"));

    expect(screen.getByRole("button", { name: "dataFilters.apply" })).toBeInTheDocument();
  });

  it("emits onAdd when applying a complete draft", async () => {
    mountDistinct();
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <AddFilterPopover
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: /dataFilters.addFilter/ }));
    await user.click(screen.getByText("value"));

    // Numeric equals draft has empty value by default — apply is disabled.
    expect(screen.getByRole("button", { name: "dataFilters.apply" })).toBeDisabled();
  });

  it("commits a complete numeric filter via Apply", async () => {
    mountDistinct();
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <AddFilterPopover
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: /dataFilters.addFilter/ }));
    await user.click(screen.getByText("value"));

    const valueInput = screen.getByRole("spinbutton");
    await user.type(valueInput, "42");

    await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ column: "value", operator: "equals", value: 42 }),
    );
  });

  it("resets the draft when Cancel is clicked", async () => {
    mountDistinct();
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <AddFilterPopover
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: /dataFilters.addFilter/ }));
    await user.click(screen.getByText("value"));

    await user.click(screen.getByRole("button", { name: "dataFilters.cancel" }));

    // Cancel resets and closes; onAdd is not called.
    expect(onAdd).not.toHaveBeenCalled();
  });

  it("swaps the operator when the user picks a different one in the draft editor", async () => {
    mountDistinct();
    const onAdd = vi.fn();
    const user = userEvent.setup();
    render(
      <AddFilterPopover
        columns={columns}
        experimentId="exp-1"
        tableName="raw_data"
        onAdd={onAdd}
      />,
    );

    await user.click(screen.getByRole("button", { name: /dataFilters.addFilter/ }));
    await user.click(screen.getByText("value"));

    // Swap from "equals" to "greater_than" (numeric operator that shares the
    // scalar value shape, so the draft.value is preserved). Operator labels
    // are raw symbols, not i18n keys; the numeric ">" label maps to greater_than.
    const operatorPicker = screen.getByRole("combobox");
    await user.click(operatorPicker);
    await user.click(await screen.findByRole("option", { name: ">" }));

    const valueInput = screen.getByRole("spinbutton");
    await user.type(valueInput, "7");
    await user.click(screen.getByRole("button", { name: "dataFilters.apply" }));

    expect(onAdd).toHaveBeenCalledWith(
      expect.objectContaining({ column: "value", operator: "greater_than", value: 7 }),
    );
  });
});
