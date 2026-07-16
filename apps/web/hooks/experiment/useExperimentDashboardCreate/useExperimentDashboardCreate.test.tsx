import { createExperimentDashboard } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperimentDashboardCreate } from "./useExperimentDashboardCreate";

const experimentId = "11111111-1111-1111-1111-111111111111";

describe("useExperimentDashboardCreate", () => {
  it("posts the body and resolves success", async () => {
    const created = createExperimentDashboard({ name: "Fresh dash", experimentId });
    const spy = server.mount(contract.experiments.createExperimentDashboard, {
      status: 201,
      body: created,
    });

    const { result } = renderHook(() => useExperimentDashboardCreate({ experimentId }));

    act(() => {
      result.current.mutate({ id: experimentId, name: "Fresh dash" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy.called).toBe(true);
    expect(spy.body).toMatchObject({ name: "Fresh dash" });
  });

  it("invokes onSuccess with the dashboard body", async () => {
    const created = createExperimentDashboard({ name: "Fresh dash", experimentId });
    server.mount(contract.experiments.createExperimentDashboard, {
      status: 201,
      body: created,
    });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useExperimentDashboardCreate({ experimentId, onSuccess }));

    act(() => {
      result.current.mutate({ id: experimentId, name: "Fresh dash" });
    });

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(onSuccess.mock.calls[0][0]).toMatchObject({ name: "Fresh dash" });
  });

  it("sets isError when the API rejects", async () => {
    server.mount(contract.experiments.createExperimentDashboard, { status: 500 });

    const { result } = renderHook(() => useExperimentDashboardCreate({ experimentId }));

    act(() => {
      result.current.mutate({ id: experimentId, name: "x" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });

  it("does not call onSuccess on failure", async () => {
    server.mount(contract.experiments.createExperimentDashboard, { status: 500 });
    const onSuccess = vi.fn();

    const { result } = renderHook(() => useExperimentDashboardCreate({ experimentId, onSuccess }));

    act(() => {
      result.current.mutate({ id: experimentId, name: "x" });
    });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
