import { act, renderHook, waitFor } from "@/test/test-utils";
import { queryOptions } from "@tanstack/react-query";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { zExperimentSort } from "@repo/api/domains/experiment/experiment.schema";
import type { ListResponse } from "@repo/api/shared/listing";

import type { ResourceListView } from "./useResourceList";
import { useResourceList } from "./useResourceList";

const filters = { status: z.enum(["active", "stale"]) };

type View = ResourceListView<typeof filters, z.infer<typeof zExperimentSort>[number]>;

interface Row {
  id: string;
}

const rows = (count: number): Row[] => Array.from({ length: count }, (_, i) => ({ id: `r${i}` }));

const envelope = (items: Row[], page: number, totalPages: number) => ({
  items,
  page,
  pageSize: 20,
  totalPages,
  totalCount: items.length,
});

/** A query whose response the test decides per view, and which records every view it saw. */
function fakeQuery(respond: (view: View) => ListResponse<Row>) {
  const views: View[] = [];
  const query = (view: View) => {
    views.push(view);
    return queryOptions({
      queryKey: ["rows", view.search, view.page, view.sort, view.filters],
      queryFn: () => Promise.resolve(respond(view)),
    });
  };
  return { query, views };
}

function renderList(respond: (view: View) => ListResponse<Row>, searchKey?: string) {
  const fake = fakeQuery(respond);
  const hook = renderHook(() =>
    useResourceList({ filters, sort: zExperimentSort, searchKey, query: fake.query }),
  );
  return { ...hook, views: fake.views };
}

describe("useResourceList", () => {
  beforeEach(() => {
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(""));
    vi.mocked(nav.usePathname).mockReturnValue("/list");
  });

  afterEach(() => {
    vi.mocked(nav.useSearchParams).mockReset();
    vi.mocked(nav.usePathname).mockReset();
  });

  it("asks for page 1 with the URL's filters and sort and no search", async () => {
    vi.mocked(nav.useSearchParams).mockReturnValue(
      new nav.ReadonlyURLSearchParams(
        `status=stale&sort=${encodeURIComponent(JSON.stringify([{ field: "name", direction: "asc" }]))}`,
      ),
    );
    const { result, views } = renderList(() => envelope(rows(2), 1, 1));

    await waitFor(() => expect(result.current.data?.items).toHaveLength(2));
    expect(views.at(-1)).toEqual({
      search: "",
      page: 1,
      sort: [{ field: "name", direction: "asc" }],
      filters: { status: ["stale"] },
    });
    expect(result.current.isLoading).toBe(false);
  });

  it("sends search only once the debounce settles and reports it pending until then", async () => {
    const { result, views } = renderList(() => envelope([], 1, 1));
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    act(() => result.current.setSearch("wheat"));

    expect(result.current.isSearchPending).toBe(true);
    expect(views.at(-1)?.search).toBe("");
    await waitFor(() => expect(views.at(-1)?.search).toBe("wheat"));
    await waitFor(() => expect(result.current.isSearchPending).toBe(false));
    expect(result.current.debouncedSearch).toBe("wheat");
  });

  it("returns to page 1 whenever search, filters or sort change", async () => {
    const { result } = renderList((view) => envelope(rows(20), view.page, 5));
    await waitFor(() => expect(result.current.data).toBeDefined());

    const changes: (() => void)[] = [
      () => result.current.setSearch("x"),
      () => result.current.setFilter("status", ["active"]),
      () => result.current.clearFilters(),
      () => result.current.toggleSort("name", false),
      () => result.current.setSort([]),
    ];
    for (const change of changes) {
      act(() => result.current.setPage(3));
      expect(result.current.page).toBe(3);
      act(change);
      expect(result.current.page).toBe(1);
    }
  });

  it("keeps the previous page on screen while the next one loads", async () => {
    let release: () => void = () => undefined;
    const fake = fakeQuery((view) => envelope(rows(1), view.page, 3));
    const { result } = renderHook(() =>
      useResourceList({
        filters,
        sort: zExperimentSort,
        query: (view) => ({
          ...fake.query(view),
          queryFn: () =>
            view.page === 1
              ? Promise.resolve(envelope(rows(1), 1, 3))
              : new Promise<ListResponse<Row>>((resolve) => {
                  release = () => resolve(envelope(rows(1), 2, 3));
                }),
        }),
      }),
    );
    await waitFor(() => expect(result.current.data?.page).toBe(1));

    act(() => result.current.setPage(2));

    await waitFor(() => expect(result.current.isPlaceholderData).toBe(true));
    expect(result.current.data?.page).toBe(1);
    act(() => release());
    await waitFor(() => expect(result.current.data?.page).toBe(2));
    expect(result.current.isPlaceholderData).toBe(false);
  });

  it("snaps back to the last page when a real response has fewer pages", async () => {
    const { result } = renderList((view) => envelope([], view.page, view.page > 2 ? 2 : 4));
    await waitFor(() => expect(result.current.data).toBeDefined());

    act(() => result.current.setPage(4));

    await waitFor(() => expect(result.current.page).toBe(2));
  });

  it("pages an unpaged response 20 rows at a time", async () => {
    const { result } = renderList(() => rows(45));
    await waitFor(() => expect(result.current.data).toBeDefined());

    expect(result.current.data).toMatchObject({ page: 1, pageSize: 20, totalPages: 3 });
    expect(result.current.data?.totalCount).toBe(45);
    expect(result.current.data?.items[0]?.id).toBe("r0");

    act(() => result.current.setPage(3));

    expect(result.current.data?.items.map((row) => row.id)).toEqual([
      "r40",
      "r41",
      "r42",
      "r43",
      "r44",
    ]);
  });

  it("keeps search in the URL when the list names a key for it", async () => {
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams("q=lab"));
    const { result, views } = renderList(() => envelope([], 1, 1), "q");

    expect(result.current.search).toBe("lab");
    await waitFor(() => expect(views.at(-1)?.search).toBe("lab"));
  });

  it("exposes a failed request with a retry", async () => {
    let fail = true;
    const { result } = renderList(() => {
      if (fail) throw new Error("boom");
      return envelope(rows(1), 1, 1);
    });

    await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
    fail = false;
    await act(() => result.current.refetch());

    await waitFor(() => expect(result.current.data?.items).toHaveLength(1));
  });
});
