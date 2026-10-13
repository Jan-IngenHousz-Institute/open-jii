import { createExperiment } from "@/test/factories";
import { server } from "@/test/msw/server";
import { renderHook, act, waitFor } from "@/test/test-utils";
import * as nav from "next/navigation";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { contract } from "@repo/api/contract";

import { useExperiments } from "./useExperiments";

vi.mock("../../useDebounce", () => ({
  useDebounce: vi.fn((v: string) => [v]),
}));

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

/** The array params as the API receives them, e.g. `status[0]=a&status[1]=b`. */
function arrayParam(url: string, key: string): string[] {
  const params = new URL(url).searchParams;
  return [...params.keys()]
    .filter((name) => name.startsWith(`${key}[`))
    .map((name) => params.get(name) ?? "");
}

describe("useExperiments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setSearchParams("");
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });
  });

  it("initializes with defaults and fetches experiments", async () => {
    const { result } = renderHook(() => useExperiments({}));
    expect(result.current.statuses).toEqual([]);
    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.search).toBe("");
    expect(result.current.page).toBe(1);

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
  });

  it("initializes with custom values", () => {
    const { result } = renderHook(() => useExperiments({ initialSearch: "test search" }));
    expect(result.current.search).toBe("test search");
  });

  it("reads the filters from the URL and sends them to the API", async () => {
    setSearchParams("status=active,stale&visibility=public");
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const { result } = renderHook(() => useExperiments({}));

    expect(result.current.statuses).toEqual(["active", "stale"]);
    expect(result.current.visibilities).toEqual(["public"]);
    expect(result.current.hasActiveFilters).toBe(true);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = spy.calls[spy.calls.length - 1].url;
    expect(arrayParam(url, "status")).toEqual(["active", "stale"]);
    expect(arrayParam(url, "visibility")).toEqual(["public"]);
  });

  it("sends no filter params while nothing is picked", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = spy.calls[spy.calls.length - 1].url;
    expect(arrayParam(url, "status")).toEqual([]);
    expect(arrayParam(url, "visibility")).toEqual([]);
  });

  it("returns experiment items from API", async () => {
    server.mount(contract.experiments.listExperiments, {
      body: envelope([createExperiment({ id: "exp-1" }), createExperiment({ id: "exp-2" })]),
    });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data?.items).toHaveLength(2);
    });
  });

  it("sends the current page as a query parameter", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([], 1, 3),
    });

    const { result } = renderHook(() => useExperiments({}));

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
    server.mount(contract.experiments.listExperiments, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useExperiments({}));

    act(() => result.current.setPage(2));
    expect(result.current.page).toBe(2);

    act(() => result.current.setSearch("wheat"));
    expect(result.current.page).toBe(1);
  });

  it("resets to page 1 when status changes", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useExperiments({}));

    act(() => result.current.setPage(3));
    expect(result.current.page).toBe(3);

    act(() => result.current.setStatuses(["active"]));
    expect(result.current.page).toBe(1);
    expect(result.current.statuses).toEqual(["active"]);
  });

  it("resets to page 1 when visibility changes", () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useExperiments({}));

    act(() => result.current.setPage(3));
    act(() => result.current.setVisibilities(["private"]));
    expect(result.current.page).toBe(1);
    expect(result.current.visibilities).toEqual(["private"]);
  });

  it("resets to page 1 and sends the sort when sorting changes", async () => {
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useExperiments({}));

    act(() => result.current.setPage(3));
    act(() => result.current.toggleSort("name", false));
    expect(result.current.page).toBe(1);
    expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
    await waitFor(() => {
      expect(spy.calls[spy.calls.length - 1].url).toContain("sort");
    });

    act(() => result.current.setPage(2));
    act(() => result.current.setSort([]));
    expect(result.current.page).toBe(1);
    expect(result.current.sort).toEqual([]);
  });

  it("clears both filters and resets to page 1", () => {
    setSearchParams("status=stale&visibility=public");
    server.mount(contract.experiments.listExperiments, { body: envelope([], 1, 3) });

    const { result } = renderHook(() => useExperiments({}));

    act(() => result.current.setPage(2));
    act(() => result.current.clearFilters());
    expect(result.current.page).toBe(1);
    expect(result.current.statuses).toEqual([]);
    expect(result.current.visibilities).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("clamps the page when the result set shrinks below it", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([], 1, 2),
    });

    const { result } = renderHook(() => useExperiments({}));
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(3));

    await waitFor(() => {
      expect(result.current.page).toBe(2);
    });
    expect(spy.calls[spy.calls.length - 1]?.query?.page).toBe("2");
  });

  it("clamps the page to 1 when the result set shrinks to a single page", async () => {
    server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const { result } = renderHook(() => useExperiments({}));
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    act(() => result.current.setPage(2));

    await waitFor(() => {
      expect(result.current.page).toBe(1);
    });
  });

  it("requests scope=related and status=archived for the archive view", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([]),
    });

    const { result } = renderHook(() => useExperiments({ archived: true }));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const lastCall = spy.calls[spy.calls.length - 1];
    expect(lastCall.query.scope).toBe("related");
    expect(arrayParam(lastCall.url, "status")).toEqual(["archived"]);
  });

  it("ignores a status param on the archive view but applies visibility", async () => {
    setSearchParams("status=active&visibility=public");
    const spy = server.mount(contract.experiments.listExperiments, { body: envelope([]) });

    const { result } = renderHook(() => useExperiments({ archived: true }));

    expect(result.current.statuses).toEqual([]);
    expect(result.current.hasActiveFilters).toBe(true);
    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });
    const url = spy.calls[spy.calls.length - 1].url;
    expect(arrayParam(url, "status")).toEqual(["archived"]);
    expect(arrayParam(url, "visibility")).toEqual(["public"]);
  });

  it("does not count a stray status param as active on the archive view", () => {
    setSearchParams("status=active");

    const { result } = renderHook(() => useExperiments({ archived: true }));

    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("omits scope and sends no legacy filter param otherwise", async () => {
    const spy = server.mount(contract.experiments.listExperiments, {
      body: envelope([]),
    });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data).toBeDefined();
    });

    const lastCall = spy.calls[spy.calls.length - 1];
    expect(lastCall.query.scope).toBeUndefined();
    expect(lastCall.query.filter).toBeUndefined();
  });

  it("handles API error gracefully", async () => {
    server.mount(contract.experiments.listExperiments, { status: 500 });

    const { result } = renderHook(() => useExperiments({}));

    await waitFor(() => {
      expect(result.current.data).toBeUndefined();
    });

    expect(result.current.search).toBe("");
    expect(result.current.page).toBe(1);
  });
});
