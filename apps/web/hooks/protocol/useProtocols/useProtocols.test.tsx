import { createProtocol } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useProtocols } from "./useProtocols";

const envelope = (items: unknown[], page = 1, totalPages = 1) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

function setSearchParams(qs: string): void {
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}

/** The array params as the API receives them, e.g. `family[0]=a&family[1]=b`. */
function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

describe("useProtocols", () => {
  it("returns protocols list", async () => {
    server.mount(contract.protocols.listProtocols, {
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
    const spy = server.mount(contract.protocols.listProtocols, {
      body: envelope([createProtocol({ id: "p-1" })]),
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "test" }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBe("test");
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
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
    server.mount(contract.protocols.listProtocols, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useProtocols());

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setSearch("test"));
    expect(result.current.page).toBe(1);
  });

  it("clamps the page when the result set shrinks below it", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: envelope([], 1, 2),
    });

    const { result } = renderHook(() => useProtocols());
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(3));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
  });

  it("does not pass empty search to query", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: envelope([createProtocol({ id: "p-1" })]),
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "" }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBeUndefined();
  });

  it("does not pass whitespace-only search to query", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: envelope([createProtocol({ id: "p-1" })]),
    });

    const { result } = renderHook(() => useProtocols({ initialSearch: "   " }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBeUndefined();
  });

  it("sends sorting and resets to the first page when sorting changes", async () => {
    const spy = server.mount(contract.protocols.listProtocols, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useProtocols());
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.setPage(2));
    act(() => result.current.toggleSort("macros", false));

    expect(result.current.page).toBe(1);
    await waitFor(() => {
      expect(spy.calls.at(-1)?.query).toMatchObject({
        page: "1",
        "sort[0][field]": "macros",
        "sort[0][direction]": "asc",
      });
    });
  });

  it("reads the family and visibility filters from the URL and sends them to the API", async () => {
    setSearchParams("family=ambyte,multispeq&visibility=private");
    const spy = server.mount(contract.protocols.listProtocols, { body: envelope([]) });

    const { result } = renderHook(() => useProtocols());

    expect(result.current.families).toEqual(["ambyte", "multispeq"]);
    expect(result.current.visibilities).toEqual(["private"]);
    expect(result.current.hasActiveFilters).toBe(true);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "family")).toEqual(["ambyte", "multispeq"]);
    expect(arrayParam(url, "visibility")).toEqual(["private"]);
  });

  it("sends no family or visibility while nothing is picked", async () => {
    const spy = server.mount(contract.protocols.listProtocols, { body: envelope([]) });

    const { result } = renderHook(() => useProtocols());

    expect(result.current.families).toEqual([]);
    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "family")).toEqual([]);
    expect(arrayParam(url, "visibility")).toEqual([]);
  });

  it("resets to page 1 when a filter changes", () => {
    server.mount(contract.protocols.listProtocols, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useProtocols());

    act(() => result.current.setPage(3));
    act(() => result.current.setFamilies(["ambyte"]));
    expect(result.current.page).toBe(1);
    expect(result.current.families).toEqual(["ambyte"]);

    act(() => result.current.setPage(2));
    act(() => result.current.setVisibilities(["public"]));
    expect(result.current.page).toBe(1);
    expect(result.current.visibilities).toEqual(["public"]);
  });

  it("clears the filters and resets to page 1, keeping search and sort", () => {
    setSearchParams("family=ambyte&visibility=public");
    server.mount(contract.protocols.listProtocols, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useProtocols({ initialSearch: "fluorescence" }));

    act(() => result.current.toggleSort("name", false));
    act(() => result.current.setPage(2));
    act(() => result.current.clearFilters());
    expect(result.current.page).toBe(1);
    expect(result.current.families).toEqual([]);
    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.search).toBe("fluorescence");
    expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
  });
});
