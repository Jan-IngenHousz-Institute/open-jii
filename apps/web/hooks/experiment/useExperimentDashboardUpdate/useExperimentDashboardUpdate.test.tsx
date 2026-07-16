import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDashboardUpdate } from "./useExperimentDashboardUpdate";

const experimentId = "11111111-1111-1111-1111-111111111111";
const dashboardId = "22222222-2222-2222-2222-222222222222";

describe("useExperimentDashboardUpdate", () => {
  it("patches the dashboard and resolves success", async () => {
    const updated = createExperimentDashboard({
      id: dashboardId,
      experimentId,
      name: "Renamed",
    });
    const spy = server.mount(contract.experiments.updateExperimentDashboard, { body: updated });

    const { result } = renderHook(() => useExperimentDashboardUpdate({ experimentId }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId, name: "Renamed" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy.called).toBe(true);
    expect(spy.body).toMatchObject({ name: "Renamed" });
  });

  it("calls onSuccess with the updated body", async () => {
    const updated = createExperimentDashboard({
      id: dashboardId,
      experimentId,
      name: "Renamed",
    });
    server.mount(contract.experiments.updateExperimentDashboard, { body: updated });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useExperimentDashboardUpdate({ experimentId, onSuccess }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId, name: "Renamed" });
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess.mock.calls[0][0]).toMatchObject({ name: "Renamed" });
  });

  it("sets isError when the server rejects", async () => {
    server.mount(contract.experiments.updateExperimentDashboard, { status: 500 });

    const { result } = renderHook(() => useExperimentDashboardUpdate({ experimentId }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId, name: "x" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("never invokes onSuccess on a failed update", async () => {
    server.mount(contract.experiments.updateExperimentDashboard, { status: 500 });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useExperimentDashboardUpdate({ experimentId, onSuccess }));

    act(() => {
      result.current.mutate({ id: experimentId, dashboardId, name: "x" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
