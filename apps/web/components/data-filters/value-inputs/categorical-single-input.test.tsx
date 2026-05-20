import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { DataColumn } from "@repo/api/schemas/experiment.schema";
import { WellKnownColumnTypes } from "@repo/api/schemas/experiment.schema";

import { CategoricalSingleInput } from "./categorical-single-input";

const labelColumn: DataColumn = { name: "label", type_name: "STRING", type_text: "STRING" };

const contributorColumn: DataColumn = {
  name: "owner",
  type_name: "STRUCT",
  type_text: WellKnownColumnTypes.CONTRIBUTOR,
};

function mountDistinct(values: (string | number)[], truncated = false) {
  return server.mount(contract.experiments.getDistinctColumnValues, {
    body: { values, truncated },
  });
}

describe("CategoricalSingleInput", () => {
  it("shows the pick-value placeholder when nothing is selected", () => {
    mountDistinct(["a", "b"]);
    render(
      <CategoricalSingleInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value=""
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("dataFilters.pickValue");
  });

  it("renders the current scalar value on the trigger", () => {
    mountDistinct(["alpha", "beta"]);
    render(
      <CategoricalSingleInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value="alpha"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("combobox")).toHaveTextContent("alpha");
  });

  it("emits the chosen scalar value when an option is clicked", async () => {
    mountDistinct(["alpha", "beta"]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoricalSingleInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value=""
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByText("alpha")).toBeInTheDocument());
    await user.click(screen.getByText("alpha"));

    expect(onChange).toHaveBeenLastCalledWith("alpha");
  });

  it("unwraps the contributor id when picking from a CONTRIBUTOR column", async () => {
    const struct = JSON.stringify({ id: "u-1", name: "Alice", avatar: null });
    mountDistinct([struct]);
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <CategoricalSingleInput
        column={contributorColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value=""
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    await user.click(screen.getByText("Alice"));

    expect(onChange).toHaveBeenLastCalledWith("u-1");
  });

  it("shows a truncated notice when the API flags the values list as capped", async () => {
    mountDistinct(["a"], true);
    const user = userEvent.setup();
    render(
      <CategoricalSingleInput
        column={labelColumn}
        experimentId="exp-1"
        tableName="raw_data"
        value=""
        onChange={vi.fn()}
      />,
    );

    await user.click(screen.getByRole("combobox"));
    await waitFor(() =>
      expect(screen.getByText("dataFilters.truncatedNotice")).toBeInTheDocument(),
    );
  });
});
