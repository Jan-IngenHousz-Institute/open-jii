import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDashboardDelete } from "./useExperimentDashboardDelete";

const experimentId = "11111111-1111-1111-1111-111111111111";
const dashboardId = "22222222-2222-2222-2222-222222222222";

describe("useExperimentDashboardDelete", () => {
  it("issues the delete request and resolves success", async () => {
    const spy = server.mount(contract.experiments.deleteExperimentDashboard, {
      status: 204,
      body: null,
    });

    const { result } = renderHook(() => useExperimentDashboardDelete({ experimentId }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy.called).toBe(true);
  });

  it("calls onSuccess once when the delete resolves", async () => {
    server.mount(contract.experiments.deleteExperimentDashboard, { status: 204, body: null });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useExperimentDashboardDelete({ experimentId, onSuccess }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId });
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("sets isError when the API rejects", async () => {
    server.mount(contract.experiments.deleteExperimentDashboard, { status: 500 });

    const { result } = renderHook(() => useExperimentDashboardDelete({ experimentId }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not invoke onSuccess on failure", async () => {
    server.mount(contract.experiments.deleteExperimentDashboard, { status: 500 });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useExperimentDashboardDelete({ experimentId, onSuccess }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
