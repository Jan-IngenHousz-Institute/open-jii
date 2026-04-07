import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api";

import { useProtocols } from "./useProtocols";

describe("useProtocols", () => {
  it("returns protocols list", async () => {
    server.mount(contract.protocols.listProtocols, {
      body: [createProtocol({ id: "p-1", name: "P1" }), createProtocol({ id: "p-2", name: "P2" })],
    });

    const { result } = renderHook(() => useProtocols());

    await waitFor(() => {
      expect(result.current.protocols).toHaveLength(2);
    });

    expect(result.current.protocols?.[0]?.name).toBe("P1");
    expect(result.current.protocols?.[1]?.name).toBe("P2");
  });

  it("passes filter and search as query parameters", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: [createProtocol({ id: "p-1" })],
    });

    const { result } = renderHook(() =>
      useProtocols({ initialSearch: "test", initialFilter: "my" }),
    );

    await waitFor(() => {
      expect(result.current.protocols).toHaveLength(1);
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBe("test");
    expect(spy.calls[spy.calls.length - 1]?.query?.filter).toBe("my");
  });

  it("omits filter when set to all", async () => {
    const spy = server.mount(contract.protocols.listProtocols, { body: [] });

    const { result } = renderHook(() => useProtocols({ initialFilter: "all" }));

    await waitFor(() => {
      expect(result.current.protocols).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.filter).toBeUndefined();
  });

  it("auto-switches to all when user has no protocols", async () => {
    server.mount(contract.protocols.listProtocols, { body: [] });

    const { result } = renderHook(() => useProtocols({ initialFilter: "my" }));

    await waitFor(() => {
      expect(result.current.filter).toBe("all");
    });
  });

  it("keeps my filter when user has protocols", async () => {
    server.mount(contract.protocols.listProtocols, {
      body: [createProtocol({ id: "p-1" })],
    });

    const { result } = renderHook(() => useProtocols({ initialFilter: "my" }));

    await waitFor(() => {
      expect(result.current.protocols).toHaveLength(1);
    });

    expect(result.current.filter).toBe("my");
  });

  it("does not auto-switch when there is a search term", async () => {
    server.mount(contract.protocols.listProtocols, { body: [] });

    const { result } = renderHook(() =>
      useProtocols({ initialFilter: "my", initialSearch: "test" }),
    );

    await waitFor(() => {
      expect(result.current.protocols).toBeDefined();
    });

    expect(result.current.filter).toBe("my");
  });

  it("does not pass empty search to query", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: [createProtocol({ id: "p-1" })],
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "" }));

    await waitFor(() => {
      expect(result.current.protocols).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBeUndefined();
  });

  it("does not pass whitespace-only search to query", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: [createProtocol({ id: "p-1" })],
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "   " }));

    await waitFor(() => {
      expect(result.current.protocols).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBeUndefined();
  });
});
