import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

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

  it("omits scope by default (accessible)", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: [createProtocol({ id: "p-1" })],
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "test" }));

    await waitFor(() => {
      expect(result.current.protocols).toHaveLength(1);
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBe("test");
    expect(spy.calls[spy.calls.length - 1]?.query?.scope).toBeUndefined();
  });

  it("passes scope=public when set to public", async () => {
    const spy = server.mount(contract.protocols.listProtocols, { body: [] });

    const { result } = renderHook(() => useProtocols({ initialFilter: "public" }));

    await waitFor(() => {
      expect(result.current.protocols).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.scope).toBe("public");
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
