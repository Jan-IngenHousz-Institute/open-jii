import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocols } from "./useProtocols";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

describe("useProtocols", () => {
  it("returns protocols list", async () => {
    server.mount(contract.protocols.listProtocolsPaginated, {
      body: envelope([
        createProtocol({ id: "p-1", name: "P1" }),
        createProtocol({ id: "p-2", name: "P2" }),
      ]),
    });

    const { result } = renderHook(() => useProtocols());

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(2);
    });

    expect(result.current.data?.items[0]?.name).toBe("P1");
    expect(result.current.data?.items[1]?.name).toBe("P2");
  });

  it("passes search as a query parameter", async () => {
    const spy = server.mount(contract.protocols.listProtocolsPaginated, {
      body: envelope([createProtocol({ id: "p-1" })]),
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "test" }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBe("test");
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.protocols.listProtocolsPaginated, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useProtocols());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("1");

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });

  it("resets to page 1 when search changes", () => {
    server.mount(contract.protocols.listProtocolsPaginated, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useProtocols());

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setSearch("test"));
    expect(result.current.page).toBe(1);
  });

  it("does not pass empty search to query", async () => {
    const spy = server.mount(contract.protocols.listProtocolsPaginated, {
      body: envelope([createProtocol({ id: "p-1" })]),
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "" }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBeUndefined();
  });

  it("does not pass whitespace-only search to query", async () => {
    const spy = server.mount(contract.protocols.listProtocolsPaginated, {
      body: envelope([createProtocol({ id: "p-1" })]),
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "   " }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBeUndefined();
  });
});
