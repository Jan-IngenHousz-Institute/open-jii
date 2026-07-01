import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useColumnMetadata } from "./useColumnMetadata";

describe("useColumnMetadata", () => {
  it("returns the columns from the underlying data fetch", async () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [
        createExperimentDataTable({
          data: {
            columns: [
              { name: "time", type_name: "TIMESTAMP", type_text: "TIMESTAMP" },
              { name: "temp", type_name: "DOUBLE", type_text: "DOUBLE" },
            ],
            rows: [],
            totalRows: 0,
            truncated: false,
          },
        }),
      ],
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
    server.mount(contract.experiments.getExperimentData, { status: 500 });

    const { result } = renderHook(() => useColumnMetadata("exp-1", "readings"));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.columns).toEqual([]);
  });

  it("reports isLoading=true before the request resolves", () => {
    server.mount(contract.experiments.getExperimentData, {
      body: [createExperimentDataTable()],
    });

    const { result } = renderHook(() => useColumnMetadata("exp-1", "readings"));
    expect(result.current.isLoading).toBe(true);
  });
});
