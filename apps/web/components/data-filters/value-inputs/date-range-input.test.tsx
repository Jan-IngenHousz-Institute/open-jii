import { useExperimentVisualizationData } from "@/hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { orpc } from "@/lib/orpc";
import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor, act, createTestQueryClient } from "@/test/test-utils";
import { formatYmdHm } from "@/util/date";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { relativeTimeFilterIdentities } from "@repo/api/transforms/relative-time-filter";

import { DateRangeInput } from "./date-range-input";

describe("DateRangeInput", () => {
  afterEach(() => vi.useRealTimers());

  it.each([
    ["dataFilters.presetLastHour", { last: 1, unit: "hours" }],
    ["dataFilters.presetLast7d", { last: 7, unit: "days" }],
    ["dataFilters.presetLast30d", { last: 30, unit: "days" }],
    ["dataFilters.presetLast90d", { last: 90, unit: "days" }],
  ])("saves %s as a rolling window", async (name, value) => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangeInput value={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "dataFilters.pickRange" }));
    await user.click(screen.getByRole("button", { name: String(name) }));
    expect(onChange).toHaveBeenLastCalledWith(value);
  });

  it("keeps calendar presets as fixed timestamps", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangeInput value={[]} onChange={onChange} />);
    await user.click(screen.getByRole("button", { name: "dataFilters.pickRange" }));
    await user.click(screen.getByRole("button", { name: "dataFilters.presetLastMonth" }));
    expect(onChange).toHaveBeenLastCalledWith([expect.any(String), expect.any(String)]);
  });

  it("shows a preview on mount, then the matching server anchor on reads and refetches", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-03-29T01:59:59.999Z"));
    const filters: ExperimentDataFilter[] = [
      { column: "timestamp", operator: "between", value: { last: 24, unit: "hours" } },
    ];
    let serverAt = "2026-03-29T01:59:00.000Z";
    let unblock!: () => void;
    const pending = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    const spy = server.mount(contract.experiments.getExperimentData, {
      unblock: pending,
      body: () => [createExperimentDataTable({ filterEvaluatedAt: serverAt })],
    });
    const client = createTestQueryClient();
    function Probe() {
      useExperimentVisualizationData("exp-1", {
        tableName: "raw_data",
        columns: ["timestamp"],
        filters,
      });
      return (
        <DateRangeInput
          value={filters[0].value}
          onChange={vi.fn()}
          experimentId="exp-1"
          tableName="raw_data"
          columnName="timestamp"
        />
      );
    }
    const view = render(<Probe />, { queryClient: client });
    expect(screen.getByText("dataFilters.rangePreview")).toBeInTheDocument();
    unblock();
    await waitFor(() =>
      expect(screen.queryByText("dataFilters.rangePreview")).not.toBeInTheDocument(),
    );
    const label = () =>
      screen.getByRole("button", { name: /dataFilters.presetLast24h/ }).textContent;
    expect(label()).toContain(formatYmdHm(new Date(serverAt)));
    expect(JSON.parse(spy.calls[0]?.query.filters ?? "[]")).toEqual(filters);

    vi.setSystemTime(new Date("2026-03-29T02:00:00.000Z"));
    view.rerender(<Probe />);
    expect(label()).toContain(formatYmdHm(new Date(serverAt)));
    expect(spy.callCount).toBe(1);
    serverAt = "2026-03-29T02:00:00.000Z";
    await act(() => client.refetchQueries());
    await waitFor(() => expect(label()).toContain(formatYmdHm(new Date(serverAt))));
    expect(spy.callCount).toBe(2);
    expect(client.getQueryCache().getAll()).toHaveLength(1);

    // An unrelated filter on the same table cannot supply this control's range.
    const otherFilters: ExperimentDataFilter[] = [
      { ...filters[0], value: { last: 7, unit: "days" } },
    ];
    const other = orpc.experiments.getExperimentData.queryOptions({
      input: { id: "exp-1", tableName: "raw_data", filters: JSON.stringify(otherFilters) },
    });
    await act(() =>
      client.fetchQuery({
        ...other,
        meta: { relativeTimeFilters: relativeTimeFilterIdentities(otherFilters) },
        queryFn: () => [
          createExperimentDataTable({ filterEvaluatedAt: "2026-03-30T02:00:00.000Z" }),
        ],
      }),
    );
    expect(label()).toContain(formatYmdHm(new Date(serverAt)));
    const matchingKey = client
      .getQueryCache()
      .getAll()
      .find(
        (query) =>
          Array.isArray(query.meta?.relativeTimeFilters) &&
          query.meta.relativeTimeFilters.includes(JSON.stringify(["timestamp", 24, "hours"])),
      )?.queryKey;
    if (!matchingKey) throw new Error("No matching query");
    await act(() =>
      client.setQueryData(matchingKey, [
        createExperimentDataTable({ filterEvaluatedAt: "2026-03-29T01:59:00.000Z" }),
      ]),
    );
    expect(label()).toContain(formatYmdHm(new Date(serverAt)));
  });
  it("shows the pick-range placeholder when there's no value", () => {
    render(<DateRangeInput value={[]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dataFilters.pickRange" })).toBeInTheDocument();
  });

  it("renders both bounds in the trigger label when a tuple is set", () => {
    render(
      <DateRangeInput
        value={["2025-01-01T00:00:00.000Z", "2025-01-07T23:59:00.000Z"]}
        onChange={vi.fn()}
      />,
    );
    // formatYmdHm uses local time, so we just assert the arrow separator.
    expect(screen.getByRole("button", { name: /→/ })).toBeInTheDocument();
  });

  it("renders an empty-bound placeholder when only one bound is set", () => {
    render(<DateRangeInput value={["2025-01-01T00:00:00.000Z", ""]} onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: /…/ })).toBeInTheDocument();
  });

  it("saves the relative window when a rolling preset is picked", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<DateRangeInput value={[]} onChange={onChange} />);

    await user.click(screen.getByRole("button", { name: "dataFilters.pickRange" }));
    await user.click(screen.getByRole("button", { name: "dataFilters.presetLast24h" }));

    expect(onChange).toHaveBeenLastCalledWith({ last: 24, unit: "hours" });
  });

  it("disables the time inputs when no start/end is set", async () => {
    const user = userEvent.setup();
    render(<DateRangeInput value={[]} onChange={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "dataFilters.pickRange" }));

    const timeInputs = screen.getAllByDisplayValue(/^(\d{2}:\d{2}|00:00|23:59)$/);
    for (const input of timeInputs) {
      expect(input).toBeDisabled();
    }
  });

  it("emits a new tuple when the start time of day is edited", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DateRangeInput
        value={["2025-01-01T00:00:00.000Z", "2025-01-07T23:59:00.000Z"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /→/ }));
    // First time input is the "from" bound; both bounds enabled when set.
    const timeInputs = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    expect(timeInputs[0]).not.toBeDisabled();
    await user.clear(timeInputs[0]);
    await user.type(timeInputs[0], "09:15");

    expect(onChange).toHaveBeenLastCalledWith([expect.any(String), expect.any(String)]);
  });

  it("emits a new tuple when the end time of day is edited", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(
      <DateRangeInput
        value={["2025-01-01T00:00:00.000Z", "2025-01-07T23:59:00.000Z"]}
        onChange={onChange}
      />,
    );

    await user.click(screen.getByRole("button", { name: /→/ }));
    const timeInputs = screen.getAllByDisplayValue(/^\d{2}:\d{2}$/);
    await user.clear(timeInputs[1]);
    await user.type(timeInputs[1], "17:45");

    expect(onChange).toHaveBeenLastCalledWith([expect.any(String), expect.any(String)]);
  });

  it("treats a non-array value as unset (defensive parseRange path)", () => {
    // The DataFilterValue type also accepts scalars; the range input should
    // simply display the pick-range placeholder rather than crash.
    render(<DateRangeInput value="" onChange={vi.fn()} />);
    expect(screen.getByRole("button", { name: "dataFilters.pickRange" })).toBeInTheDocument();
  });
});
