import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDashboard } from "./useExperimentDashboard";

const experimentId = "11111111-1111-1111-1111-111111111111";
const dashboardId = "22222222-2222-2222-2222-222222222222";

describe("useExperimentDashboard", () => {
  it("returns the dashboard body once fetched", async () => {
    const dashboard = createExperimentDashboard({
      id: dashboardId,
      experimentId,
      name: "Yield by site",
    });
    server.mount(contract.experiments.getExperimentDashboard, { body: dashboard });

    const { result } = renderHook(() => useExperimentDashboard(dashboardId, experimentId));
    expect(result.current.isLoading).toBe(true);

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data?.name).toBe("Yield by site");
  });

  it("surfaces 404 as an error on result.current", async () => {
    server.mount(contract.experiments.getExperimentDashboard, { status: 404 });

    const { result } = renderHook(() => useExperimentDashboard(dashboardId, experimentId));

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toBeUndefined();
  });

  it("starts in a loading state before the network resolves", () => {
    server.mount(contract.experiments.getExperimentDashboard, {
      body: createExperimentDashboard(),
    });

    const { result } = renderHook(() => useExperimentDashboard(dashboardId, experimentId));
    expect(result.current.isLoading).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("passes id + dashboardId through to the API request", async () => {
    const spy = server.mount(contract.experiments.getExperimentDashboard, {
      body: createExperimentDashboard({ id: dashboardId, experimentId }),
    });

    const { result } = renderHook(() => useExperimentDashboard(dashboardId, experimentId));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(spy.params.id).toBe(experimentId);
    expect(spy.params.dashboardId).toBe(dashboardId);
  });
});
