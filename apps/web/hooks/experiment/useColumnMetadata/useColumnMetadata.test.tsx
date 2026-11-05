import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useColumnMetadata } from "./useColumnMetadata";

describe("useColumnMetadata", () => {
  it("sends complete joins as a separate metadata query and keeps incomplete drafts on the primary", async () => {
    const join = {
      tableName: "weather",
      matchColumn: "station",
      primaryTimeColumn: "timestamp",
      secondaryTimeColumn: "timestamp",
      toleranceMinutes: 5,
    };
    const spy = server.mount(contract.experiments.getExperimentTableColumns, {
      body: { columns: [] },
    });
    const { result, rerender } = renderHook(
      ({ matchColumn }) => useColumnMetadata("exp-1", "leaf", { ...join, matchColumn }),
      { initialProps: { matchColumn: "" } },
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(spy.calls[0].query.join).toBeUndefined();
    rerender({ matchColumn: "station" });
    await waitFor(() => expect(spy.calls).toHaveLength(2));
    expect(spy.calls[1].query.join).toBe(JSON.stringify(join));
  });

  it("returns the table's columns", async () => {
    server.mount(contract.experiments.getExperimentTableColumns, {
      body: {
        columns: [
          { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
          { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
        ],
      },
    });

    const { result } = renderHook(() => useColumnMetadata("exp-1", "readings"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    const names = result.current.columns.map((c) => c.name);
    expect(names).toContain("time");
    expect(names).toContain("temp");
  });

  it("returns an empty column list when the table name is undefined", async () => {
    const { result } = renderHook(() => useColumnMetadata("exp-1", undefined));

    // No fetch should fire; isLoading settles immediately.
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns).toEqual([]);
  });

  it("falls back to an empty list on API error", async () => {
    server.mount(contract.experiments.getExperimentTableColumns, { status: 500 });

    const { result } = renderHook(() => useColumnMetadata("exp-1", "readings"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns).toEqual([]);
  });

  it("reports isLoading=true before the request resolves", () => {
    server.mount(contract.experiments.getExperimentTableColumns, { body: { columns: [] } });

    const { result } = renderHook(() => useColumnMetadata("exp-1", "readings"));
    expect(result.current.isLoading).toBe(true);
  });
});
