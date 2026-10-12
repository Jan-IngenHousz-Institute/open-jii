import { orpc } from "@/lib/orpc";
import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { QueryClient } from "@tanstack/react-query";
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

  it("drops the row before the server answers and puts it back when the delete fails", async () => {
    const listKey = orpc.experiments.listExperimentDashboards.queryKey({
      input: { id: experimentId, limit: 51, offset: 0 },
    });
    // The seeded list has no observer, so it must outlive the default zero gcTime.
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, gcTime: Infinity }, mutations: { retry: false } },
    });
    queryClient.setQueryData(listKey, [
      createExperimentDashboard({ id: dashboardId }),
      createExperimentDashboard({ id: "33333333-3333-3333-3333-333333333333" }),
    ]);
    server.mount(contract.experiments.deleteExperimentDashboard, { status: 500, delay: 200 });
    const listedIds = () =>
      queryClient.getQueryData<{ id: string }[]>(listKey)?.map((row) => row.id);

    const { result } = renderHook(() => useExperimentDashboardDelete({ experimentId }), {
      queryClient,
    });
    act(() => {
      result.current.mutate({ id: experimentId, dashboardId });
    });

    await waitFor(() => expect(listedIds()).toEqual(["33333333-3333-3333-3333-333333333333"]));
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(listedIds()).toEqual([dashboardId, "33333333-3333-3333-3333-333333333333"]);
  });
});
