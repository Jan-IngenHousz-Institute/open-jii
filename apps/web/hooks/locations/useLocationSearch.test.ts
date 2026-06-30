import { createPlace } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { orpcContract } from "@repo/api/orpc-contract";

import { useLocationSearch } from "./useLocationSearch";

describe("useLocationSearch", () => {
  it("returns search results for valid query", async () => {
    server.mount(orpcContract.experiments.searchPlaces, {
      body: [
        createPlace({ label: "Berlin Office", latitude: 52.52, longitude: 13.405 }),
        createPlace({ label: "Berlin Central", latitude: 52.525, longitude: 13.369 }),
      ],
    });

    const { result } = renderHook(() => useLocationSearch("Berlin"));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data).toHaveLength(2);
  });

  it("does not fire when query is 2 chars or less", async () => {
    const { result } = renderHook(() => useLocationSearch("Be"));

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
  });

  it("does not fire when query is empty", async () => {
    const { result } = renderHook(() => useLocationSearch(""));

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
  });

  it("does not fire when enabled is false", async () => {
    const { result } = renderHook(() => useLocationSearch("Berlin", undefined, false));

    await new Promise((r) => setTimeout(r, 50));
    expect(result.current.data).toBeUndefined();
  });

  it("passes maxResults as query parameter", async () => {
    const spy = server.mount(orpcContract.experiments.searchPlaces, { body: [] });

    const { result } = renderHook(() => useLocationSearch("Berlin Office", 5));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.url).toContain("maxResults=5");
  });
});
