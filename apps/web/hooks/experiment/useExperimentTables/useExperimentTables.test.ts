import { tsr } from "@/lib/tsr";
import { renderHook } from "@testing-library/react";
import { describe, it, expect, beforeEach, vi } from "vitest";

import { useExperimentTables } from "./useExperimentTables";

// Mock the tsr module
vi.mock("@/lib/tsr", () => ({
  tsr: {
    experiments: {
      getExperimentTables: {
        useQuery: vi.fn(),
      },
    },
  },
}));

const mockTsr = tsr as ReturnType<typeof vi.mocked<typeof tsr>>;

describe("useExperimentTables", () => {
  const mockExperimentId = "test-experiment-id";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call useQuery with correct parameters", () => {
    const mockUseQuery = vi.fn().mockReturnValue({
      data: { body: [] },
      isLoading: false,
      error: null,
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
      },
    ];

    const mockReturnValue = {
      data: { body: mockTablesWithMetadata },
      isLoading: false,
      error: null,
    };

    const mockUseQuery = vi.fn().mockReturnValue(mockReturnValue);
    mockTsr.experiments.getExperimentTables.useQuery = mockUseQuery;

    const { result } = renderHook(() => useExperimentTables(mockExperimentId));

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
