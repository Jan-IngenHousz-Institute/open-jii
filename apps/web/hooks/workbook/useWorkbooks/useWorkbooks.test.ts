import { createWorkbook } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, it, expect, vi } from "vitest";

import { contract } from "@repo/api/contract";

import { useWorkbooks } from "./useWorkbooks";

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

/** The array params as the API receives them, e.g. `visibility[0]=a&visibility[1]=b`. */
function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

describe("useWorkbooks", () => {
  it("returns workbooks from the API", async () => {
    const workbooks = [createWorkbook({ id: "wb-1", name: "Mine" })];
    server.mount(contract.workbooks.listWorkbooks, { body: envelope(workbooks) });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(1);
      expect(result.current.data?.items[0].name).toBe("Mine");
    });
  });

  it("shows loading state initially", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.isLoading).toBe(true);
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useWorkbooks());

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
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useWorkbooks());

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setSearch("wheat"));
    expect(result.current.page).toBe(1);
  });

  it("sends sorting and resets to the first page when sorting changes", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useWorkbooks());
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.setPage(2));
    act(() => result.current.toggleSort("usedBy", false));

    expect(result.current.page).toBe(1);
    await waitFor(() => {
      expect(spy.calls.at(-1)?.query).toMatchObject({
        page: "1",
        "sort[0][field]": "usedBy",
        "sort[0][direction]": "asc",
      });
    });
  });

  it("clamps the page when the result set shrinks below it", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, {
      body: envelope([], 1, 2),
    });

    const { result } = renderHook(() => useWorkbooks());
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(3));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
  });

  it("provides search and setSearch", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.search).toBe("");
    expect(typeof result.current.setSearch).toBe("function");
  });

  it("returns error state on API failure", async () => {
    server.mount(contract.workbooks.listWorkbooks, { status: 400 });

    const { result } = renderHook(() => useWorkbooks());

    await waitFor(() => {
      expect(result.current.error).toBeTruthy();
    });
  });

  it("reads the visibility filter from the URL and sends it to the API", async () => {
    setSearchParams("visibility=private,public");
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.visibilities).toEqual(["private", "public"]);
    expect(result.current.hasActiveFilters).toBe(true);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(arrayParam(spy.calls.at(-1)?.url ?? "", "visibility")).toEqual(["private", "public"]);
  });

  it("sends no visibility while nothing is picked", async () => {
    const spy = server.mount(contract.workbooks.listWorkbooks, { body: envelope([]) });

    const { result } = renderHook(() => useWorkbooks());

    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    expect(arrayParam(spy.calls.at(-1)?.url ?? "", "visibility")).toEqual([]);
  });

  it("resets to page 1 when visibility changes", () => {
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useWorkbooks());

    act(() => result.current.setPage(3));
    act(() => result.current.setVisibilities(["private"]));
    expect(result.current.page).toBe(1);
    expect(result.current.visibilities).toEqual(["private"]);
  });

  it("clears the filter and resets to page 1, keeping search and sort", () => {
    setSearchParams("visibility=public");
    server.mount(contract.workbooks.listWorkbooks, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useWorkbooks({ initialSearch: "soil" }));

    act(() => result.current.toggleSort("name", false));
    act(() => result.current.setPage(2));
    act(() => result.current.clearFilters());
    expect(result.current.page).toBe(1);
    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.search).toBe("soil");
    expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
  });
});
