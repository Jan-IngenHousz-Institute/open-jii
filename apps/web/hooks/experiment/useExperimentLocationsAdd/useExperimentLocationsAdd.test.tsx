import { createLocation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentLocationsAdd } from "./useExperimentLocationsAdd";

describe("useExperimentLocationsAdd", () => {
  it("sends POST request", async () => {
    const spy = server.mount(contract.experiments.addExperimentLocations, {
      body: [createLocation()],
    });

    const { result } = renderHook(() => useExperimentLocationsAdd());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: [{ name: "Site A", latitude: 42.36, longitude: -71.06 }],
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
  });

  it("sends the correct params and body", async () => {
    const spy = server.mount(contract.experiments.addExperimentLocations, {
      body: [createLocation()],
    });

    const { result } = renderHook(() => useExperimentLocationsAdd());

    const locations = [{ name: "Site A", latitude: 42.36, longitude: -71.06 }];

    act(() => {
      result.current.mutate({ params: { id: "exp-1" }, body: locations });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-1");
      expect(spy.body).toMatchObject(locations);
    });
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.addExperimentLocations, { status: 500 });

    const { result } = renderHook(() => useExperimentLocationsAdd());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: [{ name: "Site A", latitude: 42.36, longitude: -71.06 }],
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
