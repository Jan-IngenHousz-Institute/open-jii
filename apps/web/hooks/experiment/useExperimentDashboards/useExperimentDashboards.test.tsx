import { createExperimentDashboard, resetFactories } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDashboards } from "./useExperimentDashboards";

describe("useExperimentDashboards", () => {
  beforeEach(() => {
    resetFactories();
  });

  it("fetches dashboards and exposes them on result.current.data", async () => {
    server.mount(contract.experiments.listExperimentDashboards, {
      body: [
        createExperimentDashboard({ experimentId: "exp-123" }),
        createExperimentDashboard({ experimentId: "exp-123" }),
      ],
    });

    const { result } = renderHook(() => useExperimentDashboards({ experimentId: "exp-123" }));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(2);
    expect(result.current.error).toBeNull();
  });

  it("surfaces errors on the result without throwing", async () => {
    server.mount(contract.experiments.listExperimentDashboards, { status: 500 });

    const { result } = renderHook(() => useExperimentDashboards({ experimentId: "exp-123" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
  });

  it("defaults to limit=50, offset=0 with no prev/next when results empty", async () => {
    server.mount(contract.experiments.listExperimentDashboards, { body: [] });
    const { result } = renderHook(() => useExperimentDashboards({ experimentId: "exp-1" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.limit).toBe(50);
    expect(result.current.offset).toBe(0);
    expect(result.current.hasNextPage).toBe(false);
    expect(result.current.hasPreviousPage).toBe(false);
  });

  it("detects next page only when more items exist beyond the visible page", async () => {
    server.mount(contract.experiments.listExperimentDashboards, {
      body: Array.from({ length: 51 }, () => createExperimentDashboard()),
    });
    const { result } = renderHook(() => useExperimentDashboards({ experimentId: "exp-1" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(true);
    expect(result.current.data).toHaveLength(50);
  });

  it("does not report a phantom next page when results exactly fill the limit", async () => {
    server.mount(contract.experiments.listExperimentDashboards, {
      body: Array.from({ length: 50 }, () => createExperimentDashboard()),
    });
    const { result } = renderHook(() => useExperimentDashboards({ experimentId: "exp-1" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.hasNextPage).toBe(false);
  });

  it("advances offset by limit when nextPage is called", async () => {
    server.mount(contract.experiments.listExperimentDashboards, {
      body: Array.from({ length: 51 }, () => createExperimentDashboard()),
    });
    const { result } = renderHook(() => useExperimentDashboards({ experimentId: "exp-1" }));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.nextPage());
    expect(result.current.offset).toBe(50);
    expect(result.current.hasPreviousPage).toBe(true);
  });

  it("rewinds via previousPage but never below 0", () => {
    server.mount(contract.experiments.listExperimentDashboards, { body: [] });
    const { result } = renderHook(() =>
      useExperimentDashboards({ experimentId: "exp-1", initialOffset: 50 }),
    );

    act(() => result.current.previousPage());
    expect(result.current.offset).toBe(0);

    act(() => result.current.previousPage());
    expect(result.current.offset).toBe(0);
  });

  it("clamps initialLimit to the user-facing max so the probe always fits the backend cap", async () => {
    server.mount(contract.experiments.listExperimentDashboards, { body: [] });
    const { result } = renderHook(() =>
      useExperimentDashboards({ experimentId: "exp-1", initialLimit: 100 }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.limit).toBe(99);
  });

  it("clamps setLimit values above the user-facing max", async () => {
    server.mount(contract.experiments.listExperimentDashboards, { body: [] });
    const { result } = renderHook(() => useExperimentDashboards({ experimentId: "exp-1" }));
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    act(() => result.current.setLimit(500));
    expect(result.current.limit).toBe(99);
  });

  it("resetPagination jumps offset back to 0", () => {
    server.mount(contract.experiments.listExperimentDashboards, { body: [] });
    const { result } = renderHook(() =>
      useExperimentDashboards({ experimentId: "exp-1", initialOffset: 100 }),
    );

    act(() => result.current.resetPagination());
    expect(result.current.offset).toBe(0);
  });
});
