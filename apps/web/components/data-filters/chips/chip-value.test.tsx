import { useExperimentVisualizationData } from "@/hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { act, createTestQueryClient, render, screen, waitFor } from "@/test/test-utils";
import { formatYmdHm } from "@/util/date";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";

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
  afterEach(() => vi.useRealTimers());

  it("shows a rolling preset and preview, adopts server bounds, and ignores a late older success", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T01:59:59.999Z"));
    let serverAt = "2026-10-25T01:59:00.000Z";
    let unblock!: () => void;
    const pending = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    server.mount(contract.experiments.getExperimentData, {
      unblock: pending,
      body: () => [createExperimentDataTable({ filterEvaluatedAt: serverAt })],
    });
    const client = createTestQueryClient();
    const filter: ExperimentDataFilter = {
      column: "timestamp",
      operator: "between",
      value: { last: 24, unit: "hours" },
    };
    function Probe() {
      useExperimentVisualizationData("exp-1", {
        tableName: "raw_data",
        columns: ["timestamp"],
        filters: [filter],
      });
      return (
        <ChipValue
          filter={filter}
          isContributor={false}
          fullWidth={false}
          parentColumn="timestamp"
          experimentId="exp-1"
          tableName="raw_data"
        />
      );
    }
    render(<Probe />, { queryClient: client });
    expect(screen.getByText("dataFilters.presetLast24h")).toBeInTheDocument();
    expect(screen.getByText("dataFilters.rangePreview")).toBeInTheDocument();
    unblock();
    await waitFor(() =>
      expect(screen.queryByText("dataFilters.rangePreview")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/→/)).toHaveTextContent(formatYmdHm(new Date(serverAt)));
    serverAt = "2026-10-25T02:00:00.000Z";
    await act(() => client.refetchQueries());
    await waitFor(() =>
      expect(screen.getByText(/→/)).toHaveTextContent(formatYmdHm(new Date(serverAt))),
    );
    const query = client
      .getQueryCache()
      .getAll()
      .find((entry) => entry.meta !== undefined);
    if (!query) throw new Error("No matching data query");
    const key = query.queryKey;
    await act(() =>
      client.setQueryData(key, [
        createExperimentDataTable({ filterEvaluatedAt: "2026-10-25T01:59:00.000Z" }),
      ]),
    );
    expect(screen.getByText(/→/)).toHaveTextContent(formatYmdHm(new Date(serverAt)));
    await act(() =>
      client.setQueryData(key, [createExperimentDataTable({ filterEvaluatedAt: "invalid" })]),
    );
    expect(screen.getByText(/→/)).toHaveTextContent(formatYmdHm(new Date(serverAt)));
  });
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
