import { createExperimentTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentTables } from "./useExperimentTables";

describe("useExperimentTables", () => {
  it("returns empty tables by default", async () => {
    server.mount(contract.experiments.getExperimentTables, { body: [] });

    const { result } = renderHook(() => useExperimentTables("exp-1"));

    await waitFor(() => {
      expect(result.current.tables).toBeDefined();
    });

    expect(result.current.tables).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns tables metadata", async () => {
    const mockTables = [
      createExperimentTable({
        name: "measurements",
        displayName: "Measurements",
        totalRows: 500,
        defaultSortColumn: "timestamp",
        errorColumn: "error_info",
      }),
      createExperimentTable({
        name: "table2",
        displayName: "Table 2",
        totalRows: 100,
        defaultSortColumn: "id",
      }),
    ];

    server.mount(contract.experiments.getExperimentTables, { body: mockTables });

    const { result } = renderHook(() => useExperimentTables("exp-1"));

    await waitFor(() => {
      expect(result.current.tables).toHaveLength(2);
    });

    expect(result.current.tables?.[0]).toMatchObject({
      name: "measurements",
      displayName: "Measurements",
      totalRows: 500,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("handles error state", async () => {
    server.mount(contract.experiments.getExperimentTables, { status: 404 });

    const { result } = renderHook(() => useExperimentTables("bad-id"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.tables).toBeUndefined();
  });

  it("uses experiment ID in the request path", async () => {
    const spy = server.mount(contract.experiments.getExperimentTables, { body: [] });

    const { result } = renderHook(() => useExperimentTables("specific-exp-id"));

    await waitFor(() => {
      expect(result.current.tables).toBeDefined();
    });

    expect(spy.params.id).toBe("specific-exp-id");
  });
});
