import { useExperimentVisualizationData } from "@/hooks/experiment/useExperimentVisualizationData/useExperimentVisualizationData";
import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { formatYmdHm } from "@/util/date";
import { afterEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentDataFilter } from "@repo/api/domains/experiment/data/experiment-data.schema";
import type { ExperimentDataColumn } from "@repo/api/domains/experiment/data/experiment-data.schema";
import { WellKnownColumnTypes } from "@repo/api/domains/experiment/data/experiment-data.schema";

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
  afterEach(() => vi.useRealTimers());

  it("shows a rolling preview, adopts the read's server bounds, and remains operable", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-25T01:59:59.999Z"));
    const serverAt = "2026-10-25T02:00:00.000Z";
    let unblock!: () => void;
    const pending = new Promise<void>((resolve) => {
      unblock = resolve;
    });
    server.mount(contract.experiments.getExperimentData, {
      unblock: pending,
      body: [createExperimentDataTable({ filterEvaluatedAt: serverAt })],
    });
    const filter: ExperimentDataFilter = {
      column: "timestamp",
      operator: "between",
      value: { last: 24, unit: "hours" },
    };
    const onClick = vi.fn();
    const onRemove = vi.fn();
    function Probe() {
      useExperimentVisualizationData("exp-1", {
        tableName: "raw_data",
        columns: ["timestamp"],
        filters: [filter],
      });
      return (
        <FilterChipFace
          filter={filter}
          column={{ name: "timestamp", type_name: "TIMESTAMP", type_text: "TIMESTAMP" }}
          experimentId="exp-1"
          tableName="raw_data"
          fullWidth
          onClick={onClick}
          onRemove={onRemove}
        />
      );
    }
    render(<Probe />);
    const chipButton = screen.getByRole("button", { name: /dataFilters.presetLast24h/ });
    expect(screen.getByText("dataFilters.rangePreview")).toBeInTheDocument();
    expect(screen.getByText(/→/)).toHaveTextContent(
      `${formatYmdHm(new Date("2026-10-24T01:59:00.000Z"))} → ${formatYmdHm(new Date("2026-10-25T01:59:00.000Z"))}`,
    );
    expect(chipButton).toHaveClass("h-auto", "py-1");
    expect(chipButton.parentElement).toHaveClass("h-auto", "min-h-7");
    unblock();
    await waitFor(() =>
      expect(screen.queryByText("dataFilters.rangePreview")).not.toBeInTheDocument(),
    );
    expect(screen.getByText(/→/)).toHaveTextContent(
      `${formatYmdHm(new Date("2026-10-24T02:00:00.000Z"))} → ${formatYmdHm(new Date(serverAt))}`,
    );
    const user = userEvent.setup();
    await user.click(chipButton);
    await user.click(screen.getByRole("button", { name: "dataFilters.removeFilterOn" }));
    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
  });

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
  it("resolves a joined contributor chip from its source table and column", async () => {
    const spy = server.mount(contract.experiments.getDistinctColumnValues, {
      body: {
        values: [JSON.stringify({ id: "u-1", name: "Alice", avatar: null })],
        truncated: false,
      },
    });
    render(
      <FilterChipFace
        filter={{ column: "second__owner.id", operator: "equals", value: "u-1" }}
        column={{
          name: "second__owner",
          type_name: "STRUCT",
          type_text: WellKnownColumnTypes.CONTRIBUTOR,
          sourceTable: { tableName: "weather", columnName: "owner" },
        }}
        experimentId="exp-1"
        tableName="raw_data"
        onRemove={vi.fn()}
      />,
    );
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(spy.calls[0].query).toMatchObject({ tableName: "weather", column: "owner" });
  });
});
