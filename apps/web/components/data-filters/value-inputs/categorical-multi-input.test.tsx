import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, within } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/experiment.schema";

import { CategoricalMultiInput } from "./categorical-multi-input";

const labelColumn: ExperimentDataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };

const contributorColumn: ExperimentDataColumn = {
  name: "owner",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};

function mountDistinct(values: (string | number)[], truncated = false) {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values, truncated },
  });
}

describe("CategoricalMultiInput", () => {
  it("shows the pick-values placeholder when the selection is empty", () => {
    mountDistinct(["a"]);
    render(
      <CategoricalMultiInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value={[]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("dataFilters.pickValues");
  });

  it("shows a selected-count label on the trigger once values are picked", () => {
    mountDistinct(["a", "b"]);
    render(
      <CategoricalMultiInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value={["a", "b"]}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("dataFilters.selectedCount");
  });

  it("toggles a value into the selection when an option is clicked", async () => {
    mountDistinct(["a", "b"]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoricalMultiInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value={["a"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByText("b")).toBeInTheDocument());
    await user.click(screen.getByText("b"));

    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
  });

  it("removes a value when the same option is toggled off", async () => {
    mountDistinct(["a", "b"]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoricalMultiInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value={["a", "b"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    // The selected chips also render "a"/"b"; scope to the options list.
    const listbox = await screen.findByRole("listbox");
    await waitFor(() => expect(within(listbox).getAllByRole("option")).toHaveLength(2));
    const optionA = within(listbox)
      .getAllByRole("option")
      .find((opt) => opt.getAttribute("data-value") === "a");
    if (!optionA) throw new Error("missing option a");
    await user.click(optionA);

    expect(onChange).toHaveBeenLastCalledWith(["b"]);
  });

  it("removes a value when its chip's X button is clicked", async () => {
    mountDistinct(["a", "b"]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoricalMultiInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value={["a", "b"]}
        onChange={onChange}
      />,
    );

    // Two selected chips, each with an "X" button. Click the first.
    const removeButtons = screen.getAllByRole("button", { name: "dataFilters.removeValue" });
    await user.click(removeButtons[0]);
    expect(onChange).toHaveBeenLastCalledWith(["b"]);
  });

  it("emits contributor ids (not the full struct) when picking from a CONTRIBUTOR column", async () => {
    const struct = JSON.stringify({ id: "u-1", name: "Alice", avatar: null });
    mountDistinct([struct]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoricalMultiInput
        column={contributorColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value={[]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await user.click(screen.getByText("Alice"));

    expect(onChange).toHaveBeenLastCalledWith(["u-1"]);
  });
});
