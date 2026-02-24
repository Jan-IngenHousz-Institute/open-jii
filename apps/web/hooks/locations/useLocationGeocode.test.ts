/**
 * useLocationGeocode hook test — MSW-based.
 *
 * The real hook calls `tsr.experiments.geocodeLocation.useQuery` →
 * `GET /api/v1/locations/geocode?latitude=...&longitude=...`.
 * MSW intercepts that request.
 *
 * The hook disables the query when coordinates are NaN or enabled=false.
 */
import { createPlace } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { useLocationGeocode } from "./useLocationGeocode";

describe("useLocationGeocode", () => {
  it("returns geocoded data for valid coordinates", async () => {
    const place = createPlace({ label: "Berlin Office", latitude: 52.52, longitude: 13.405 });
    server.mount(contract.experiments.geocodeLocation, { body: { place } });

    const { result } = renderHook(() => useLocationGeocode(52.52, 13.405));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.body).toMatchObject({
      place: { label: "Berlin Office" },
    });
  });

  it("does not fire when latitude is NaN", async () => {
    const { result } = renderHook(() => useLocationGeocode(NaN, 13.405));

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
  });

  it("does not fire when longitude is NaN", async () => {
    const { result } = renderHook(() => useLocationGeocode(52.52, NaN));

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
  });

  it("does not fire when enabled is false", async () => {
    const { result } = renderHook(() => useLocationGeocode(52.52, 13.405, false));

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
  });

  it("works with zero coordinates", async () => {
    server.mount(contract.experiments.geocodeLocation, { body: { place: createPlace() } });

    const { result } = renderHook(() => useLocationGeocode(0, 0));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    // Zero is valid (not NaN), so query should fire
    expect(result.current.isLoading).toBe(false);
  });

  it("works with negative coordinates", async () => {
    const spy = server.mount(contract.experiments.geocodeLocation, { body: {} });

    const { result } = renderHook(() => useLocationGeocode(-40.7128, -74.006));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.url).toContain("latitude=-40.7128");
    expect(spy.url).toContain("longitude=-74.006");
  });
});
