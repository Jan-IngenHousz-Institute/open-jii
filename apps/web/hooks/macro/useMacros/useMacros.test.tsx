import { createMacro } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useMacros } from "./useMacros";

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

/** The array params as the API receives them, e.g. `language[0]=a&language[1]=b`. */
function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

describe("useMacros", () => {
  it("returns empty envelope by default", async () => {
    server.mount(contract.macros.listMacros, { body: envelope([]) });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(result.current.data?.items).toEqual([]);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("returns macros list", async () => {
    server.mount(contract.macros.listMacros, {
      body: envelope([
        createMacro({ id: "1", name: "M1" }),
        createMacro({ id: "2", name: "M2", language: "javascript" }),
      ]),
    });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(2);
    });

    const first = result.current.data?.items[0];
    const second = result.current.data?.items[1];
    expect(first?.name).toBe("M1");
    expect(second?.name).toBe("M2");
  });

  it("passes search as a query parameter", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: envelope([]) });

    const { result } = renderHook(() => useMacros({ initialSearch: "test" }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    expect(spy.calls[spy.calls.length - 1]?.query?.search).toBe("test");
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useMacros());

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("1");

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
    });
  });

  it("clamps the page when the result set shrinks below it", async () => {
    const spy = server.mount(contract.macros.listMacros, {
      body: envelope([], 1, 2),
    });

    const { result } = renderHook(() => useMacros());
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(3));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
  });

  it("sends sorting and resets to the first page when sorting changes", async () => {
    const spy = server.mount(contract.macros.listMacros, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useMacros());
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.setPage(2));
    act(() => result.current.toggleSort("protocols", false));

    expect(result.current.page).toBe(1);
    await waitFor(() => {
      expect(spy.calls.at(-1)?.query).toMatchObject({
        page: "1",
        "sort[0][field]": "protocols",
        "sort[0][direction]": "asc",
      });
    });
  });

  it("reads the language and visibility filters from the URL and sends them to the API", async () => {
    setSearchParams("language=python,r&visibility=private");
    const spy = server.mount(contract.macros.listMacros, { body: envelope([]) });

    const { result } = renderHook(() => useMacros());

    expect(result.current.languages).toEqual(["python", "r"]);
    expect(result.current.visibilities).toEqual(["private"]);
    expect(result.current.hasActiveFilters).toBe(true);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "language")).toEqual(["python", "r"]);
    expect(arrayParam(url, "visibility")).toEqual(["private"]);
  });

  it("sends no language or visibility while nothing is picked", async () => {
    const spy = server.mount(contract.macros.listMacros, { body: envelope([]) });

    const { result } = renderHook(() => useMacros());

    expect(result.current.languages).toEqual([]);
    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = spy.calls.at(-1)?.url ?? "";
    expect(arrayParam(url, "language")).toEqual([]);
    expect(arrayParam(url, "visibility")).toEqual([]);
  });

  it("resets to page 1 when a filter changes", () => {
    server.mount(contract.macros.listMacros, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useMacros());

    act(() => result.current.setPage(3));
    act(() => result.current.setLanguages(["r"]));
    expect(result.current.page).toBe(1);
    expect(result.current.languages).toEqual(["r"]);

    act(() => result.current.setPage(2));
    act(() => result.current.setVisibilities(["public"]));
    expect(result.current.page).toBe(1);
    expect(result.current.visibilities).toEqual(["public"]);
  });

  it("clears the filters and resets to page 1, keeping search and sort", () => {
    setSearchParams("language=r&visibility=public");
    server.mount(contract.macros.listMacros, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useMacros({ initialSearch: "anova" }));

    act(() => result.current.toggleSort("name", false));
    act(() => result.current.setPage(2));
    act(() => result.current.clearFilters());
    expect(result.current.page).toBe(1);
    expect(result.current.languages).toEqual([]);
    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.search).toBe("anova");
    expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
  });
});
