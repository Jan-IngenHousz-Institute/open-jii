import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { ContributorChipValue } from "./contributor-chip-value";

const STRUCT_A = JSON.stringify({ id: "u-1", name: "Alice", avatar: null });
const STRUCT_B = JSON.stringify({ id: "u-2", name: "Bob", avatar: null });

function renderChip(filterValue: string | string[], opts: { experimentId?: string } = {}) {
  return render(
    <ContributorChipValue
      filterValue={filterValue}
      parentColumn="owner"
      experimentId={opts.experimentId ?? "exp-1"}
      tableName="raw_data"
      className=""
    />,
  );
}

describe("ContributorChipValue", () => {
  it("renders the no-value placeholder when no id is selected", () => {
    server.mount(orpcContract.experiments.getDistinctColumnValues, {
      body: { values: [], truncated: false },
    });
    renderChip("");
    expect(screen.getByText("-")).toBeInTheDocument();
  });

  it("renders the contributor's name when its id matches a fetched struct", async () => {
    server.mount(orpcContract.experiments.getDistinctColumnValues, {
      body: { values: [STRUCT_A], truncated: false },
    });
    renderChip("u-1");
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
  });

  it("falls back to the raw id when the fetched values don't include it", async () => {
    server.mount(orpcContract.experiments.getDistinctColumnValues, {
      body: { values: [STRUCT_A], truncated: false },
    });
    renderChip("u-99");
    // The struct lookup misses, so we fall back to displaying the id string.
    await waitFor(() => expect(screen.getByText("u-99")).toBeInTheDocument());
  });

  it("shows a selected-count label when multiple ids are selected", () => {
    server.mount(orpcContract.experiments.getDistinctColumnValues, {
      body: { values: [STRUCT_A, STRUCT_B], truncated: false },
    });
    renderChip(["u-1", "u-2"]);
    expect(screen.getByText("dataFilters.selectedCount")).toBeInTheDocument();
  });
});
