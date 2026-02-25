import { createLocation } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useExperimentLocations } from "./useExperimentLocations";

describe("useExperimentLocations", () => {
  it("returns empty array when no locations exist", async () => {
    server.mount(contract.experiments.getExperimentLocations, { body: [] });

    const { result } = renderHook(() => useExperimentLocations("exp-1"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.body).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns locations on success", async () => {
    const locations = [createLocation(), createLocation()];
    server.mount(contract.experiments.getExperimentLocations, { body: locations });

    const { result } = renderHook(() => useExperimentLocations("exp-1"));

    await waitFor(() => {
      expect(result.current.data?.body).toHaveLength(2);
    });

    expect(result.current.data?.body[0]).toMatchObject({
      id: locations[0].id,
      name: locations[0].name,
      latitude: locations[0].latitude,
      longitude: locations[0].longitude,
    });
    expect(result.current.data?.body[1]).toMatchObject({
      id: locations[1].id,
      name: locations[1].name,
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("passes experiment ID in the request path", async () => {
    const spy = server.mount(contract.experiments.getExperimentLocations, { body: [] });

    const { result } = renderHook(() => useExperimentLocations("specific-exp-id"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.params.id).toBe("specific-exp-id");
  });

  it("handles 404 error", async () => {
    server.mount(contract.experiments.getExperimentLocations, { status: 404 });

    const { result } = renderHook(() => useExperimentLocations("bad-id"));

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.data?.body).toBeUndefined();
  });
});
