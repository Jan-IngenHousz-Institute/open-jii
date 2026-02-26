/**
 * useExperimentLocationsUpdate hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.updateExperimentLocations.useMutation` →
 * `PUT /api/v1/experiments/:id/locations`. MSW intercepts that request.
 */
import { createLocation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor, act } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentLocationsUpdate } from "./useExperimentLocationsUpdate";

describe("useExperimentLocationsUpdate", () => {
  it("sends PUT request via MSW", async () => {
    const spy = server.mount(contract.experiments.updateExperimentLocations, {
      body: [createLocation()],
    });

    const { result } = renderHook(() => useExperimentLocationsUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: [{ name: "Updated Site", latitude: 40.71, longitude: -74.01 }],
      });
    });

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });
  });

  it("sends the correct params and body", async () => {
    const spy = server.mount(contract.experiments.updateExperimentLocations, {
      body: [createLocation()],
    });

    const { result } = renderHook(() => useExperimentLocationsUpdate());

    const locations = [{ name: "Updated Site", latitude: 40.71, longitude: -74.01 }];

    act(() => {
      result.current.mutate({ params: { id: "exp-2" }, body: locations });
    });

    await waitFor(() => {
      expect(spy.params.id).toBe("exp-2");
      expect(spy.body).toMatchObject(locations);
    });
  });

  it("handles error response", async () => {
    server.mount(contract.experiments.updateExperimentLocations, { status: 500 });

    const { result } = renderHook(() => useExperimentLocationsUpdate());

    act(() => {
      result.current.mutate({
        params: { id: "exp-1" },
        body: [{ name: "Updated Site", latitude: 40.71, longitude: -74.01 }],
      });
    });

    await waitFor(() => {
      expect(result.current.isError).toBe(true);
    });
  });
});
