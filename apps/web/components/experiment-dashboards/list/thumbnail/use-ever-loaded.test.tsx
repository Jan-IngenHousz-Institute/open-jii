import { createTestQueryClient } from "@/test/test-utils";
import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { describe, expect, it } from "vitest";

import { useEverLoaded } from "./use-ever-loaded";

function wrap(client = createTestQueryClient()) {
  return {
    client,
    Wrapper: function Wrapper({ children }: { children: React.ReactNode }) {
      return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
    },
  };
}

describe("useEverLoaded", () => {
  it("stays false while not mounted (in-view)", () => {
    const { Wrapper } = wrap();
    const { result } = renderHook(() => useEverLoaded("exp-1", false), { wrapper: Wrapper });
    expect(result.current).toBe(false);
  });

  it("flips to true after a fetch keyed by experimentId resolves", async () => {
    const { client, Wrapper } = wrap();

    let resolveFetch: (v: unknown) => void = () => undefined;
    const pending = new Promise((r) => {
      resolveFetch = r;
    });

    // Kick off a query whose key includes the experimentId.
    void client.fetchQuery({
      queryKey: ["something", "exp-1"],
      queryFn: () => pending,
    });

    const { result } = renderHook(() => useEverLoaded("exp-1", true), { wrapper: Wrapper });
    expect(result.current).toBe(false);

    await act(async () => {
      resolveFetch("done");
      await pending;
    });

    await waitFor(() => expect(result.current).toBe(true));
  });

  it("ignores fetches keyed by a different experimentId", async () => {
    const { client, Wrapper } = wrap();

    let resolveFetch: (v: unknown) => void = () => undefined;
    const pending = new Promise((r) => {
      resolveFetch = r;
    });

    void client.fetchQuery({
      queryKey: ["something", "exp-OTHER"],
      queryFn: () => pending,
    });

    const { result } = renderHook(() => useEverLoaded("exp-1", true), { wrapper: Wrapper });

    await act(async () => {
      resolveFetch("done");
      await pending;
    });

    expect(result.current).toBe(false);
  });

  it("once true, stays true even after subsequent fetches start (sticky)", async () => {
    const { client, Wrapper } = wrap();

    let resolveFirst: (v: unknown) => void = () => undefined;
    const first = new Promise((r) => {
      resolveFirst = r;
    });
    void client.fetchQuery({
      queryKey: ["a", "exp-1"],
      queryFn: () => first,
    });

    const { result } = renderHook(() => useEverLoaded("exp-1", true), { wrapper: Wrapper });
    await act(async () => {
      resolveFirst("done");
      await first;
    });
    await waitFor(() => expect(result.current).toBe(true));

    // Start a new long-running fetch; everLoaded should not flip back.
    let resolveSecond: (v: unknown) => void = () => undefined;
    const second = new Promise((r) => {
      resolveSecond = r;
    });
    void client.fetchQuery({
      queryKey: ["b", "exp-1"],
      queryFn: () => second,
    });

    expect(result.current).toBe(true);
    await act(async () => {
      resolveSecond("done");
      await second;
    });
    expect(result.current).toBe(true);
  });
});
