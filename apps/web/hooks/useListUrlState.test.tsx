import { act, renderHook } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { zExperimentSort } from "@repo/api/domains/experiment/experiment.schema";

import { useListUrlState } from "./useListUrlState";

function setSearchParams(qs: string): void {
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}

const replace = vi.mocked(nav.useRouter().replace);

const filters = {
  status: z.enum(["active", "stale", "published"]),
  visibility: z.enum(["private", "public"]),
};

const options = { filters, sort: zExperimentSort };
const withSearch = { filters, sort: zExperimentSort, searchKey: "q" };

const sortParam = (value: unknown) => `sort=${encodeURIComponent(JSON.stringify(value))}`;

describe("useListUrlState", () => {
  beforeEach(() => {
    replace.mockClear();
    setSearchParams("");
    vi.mocked(nav.usePathname).mockReturnValue("/list");
  });

  afterEach(() => {
    vi.mocked(nav.useSearchParams).mockReset();
    vi.mocked(nav.usePathname).mockReset();
  });

  describe("filters", () => {
    it("starts empty and inactive without filter params", () => {
      const { result } = renderHook(() => useListUrlState(options));

      expect(result.current.filters).toEqual({ status: [], visibility: [] });
      expect(result.current.hasActiveFilters).toBe(false);
      expect(replace).not.toHaveBeenCalled();
    });

    it("reads comma-separated values from the URL", () => {
      setSearchParams("status=active,stale&visibility=public");
      const { result } = renderHook(() => useListUrlState(options));

      expect(result.current.filters).toEqual({
        status: ["active", "stale"],
        visibility: ["public"],
      });
      expect(result.current.hasActiveFilters).toBe(true);
      expect(replace).not.toHaveBeenCalled();
    });

    it("drops unknown and repeated values and rewrites the URL without them", () => {
      setSearchParams("status=active,bogus,active&visibility=hidden&focus=x");
      const { result } = renderHook(() => useListUrlState(options));

      expect(result.current.filters).toEqual({ status: ["active"], visibility: [] });
      expect(replace).toHaveBeenCalledWith("/list?status=active&focus=x", { scroll: false });
    });

    it("writes a picked value with readable commas", () => {
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.setFilter("status", ["active", "stale", "active"]));

      expect(result.current.filters.status).toEqual(["active", "stale"]);
      expect(replace).toHaveBeenLastCalledWith("/list?status=active,stale", { scroll: false });
    });

    it("removes a key when its selection becomes empty", () => {
      setSearchParams("status=active&visibility=public");
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.setFilter("status", []));

      expect(replace).toHaveBeenLastCalledWith("/list?visibility=public", { scroll: false });
    });

    it("clears every filter in one navigation and keeps sort and other params", () => {
      const sort = sortParam([{ field: "name", direction: "asc" }]);
      setSearchParams(`${sort}&status=active&visibility=public&focus=search`);
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.clearFilters());

      expect(result.current.filters).toEqual({ status: [], visibility: [] });
      expect(result.current.hasActiveFilters).toBe(false);
      expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
      expect(replace).toHaveBeenCalledTimes(1);
      const [url] = replace.mock.lastCall ?? [];
      expect(url).toContain("focus=search");
      expect(url).toContain("sort=");
      expect(url).not.toContain("status");
    });

    it("navigates to the bare path when the last param goes", () => {
      setSearchParams("visibility=public");
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.clearFilters());

      expect(replace).toHaveBeenCalledWith("/list", { scroll: false });
    });
  });

  describe("sort", () => {
    it("cycles a single sort through ascending, descending and off", () => {
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.toggleSort("name", false));
      expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
      act(() => result.current.toggleSort("name", false));
      expect(result.current.sort).toEqual([{ field: "name", direction: "desc" }]);
      act(() => result.current.toggleSort("name", false));
      expect(result.current.sort).toEqual([]);
    });

    it("adds a second and toggles or removes it in place", () => {
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.toggleSort("name", false));
      act(() => result.current.toggleSort("status", true));
      expect(result.current.sort.map((item) => item.field)).toEqual(["name", "status"]);
      act(() => result.current.toggleSort("name", true));
      expect(result.current.sort).toEqual([
        { field: "name", direction: "desc" },
        { field: "status", direction: "asc" },
      ]);
      act(() => result.current.toggleSort("name", true));
      expect(result.current.sort).toEqual([{ field: "status", direction: "asc" }]);
    });

    it("replaces the oldest criterion when shift-clicking a third field", () => {
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.toggleSort("name", false));
      act(() => result.current.toggleSort("status", true));
      act(() => result.current.toggleSort("owner", true));

      expect(result.current.sort).toEqual([
        { field: "status", direction: "asc" },
        { field: "owner", direction: "asc" },
      ]);
    });

    it("starts empty when the URL has malformed sort JSON or an unknown field", () => {
      setSearchParams("sort=%7B");
      expect(renderHook(() => useListUrlState(options)).result.current.sort).toEqual([]);

      setSearchParams(sortParam([{ field: "activity", direction: "asc" }]));
      expect(renderHook(() => useListUrlState(options)).result.current.sort).toEqual([]);
    });

    it("restores a valid sort from the URL without rewriting it", () => {
      setSearchParams(sortParam([{ field: "updated", direction: "desc" }]));
      const { result } = renderHook(() => useListUrlState(options));

      expect(result.current.sort).toEqual([{ field: "updated", direction: "desc" }]);
      expect(replace).not.toHaveBeenCalled();
    });

    it("resets the sort and keeps the other params", () => {
      setSearchParams(`status=active&${sortParam([{ field: "name", direction: "asc" }])}`);
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.setSort([]));

      expect(replace).toHaveBeenLastCalledWith("/list?status=active", { scroll: false });
    });
  });

  describe("search", () => {
    it("keeps search out of the URL unless the list names a key for it", () => {
      const { result } = renderHook(() => useListUrlState(options));

      act(() => result.current.setSearch("wheat"));

      expect(result.current.search).toBe("wheat");
      expect(replace).not.toHaveBeenCalled();
    });

    it("reads and writes search under its key, and drops the key when blank", () => {
      setSearchParams("q=lab");
      const { result } = renderHook(() => useListUrlState(withSearch));

      expect(result.current.search).toBe("lab");
      act(() => result.current.setSearch("lab north"));
      expect(replace).toHaveBeenLastCalledWith("/list?q=lab+north", { scroll: false });
      act(() => result.current.setSearch(""));
      expect(replace).toHaveBeenLastCalledWith("/list", { scroll: false });
    });
  });

  it("keeps a sort and a filter changed in the same tick", () => {
    const { result } = renderHook(() => useListUrlState(options));

    act(() => {
      result.current.toggleSort("name", false);
      result.current.setFilter("status", ["stale"]);
    });

    const [url] = replace.mock.lastCall ?? [];
    expect(url).toContain("status=stale");
    expect(url).toContain("sort=");
    expect(replace).toHaveBeenCalledTimes(1);
  });

  it("follows the URL on back and forward", () => {
    setSearchParams("status=active&q=lab");
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));

    setSearchParams(
      `status=published&visibility=private&q=wheat&${sortParam([{ field: "name", direction: "desc" }])}`,
    );
    rerender();

    expect(result.current.filters).toEqual({ status: ["published"], visibility: ["private"] });
    expect(result.current.search).toBe("wheat");
    expect(result.current.sort).toEqual([{ field: "name", direction: "desc" }]);
    expect(replace).not.toHaveBeenCalled();
  });

  it("keeps a newer change when the URL echoes an earlier write late", () => {
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));

    act(() => result.current.setSearch("w"));
    act(() => result.current.setSearch("wh"));
    setSearchParams("q=w");
    rerender();

    expect(result.current.search).toBe("wh");

    setSearchParams("q=wh");
    rerender();
    setSearchParams("q=wheat");
    rerender();

    expect(result.current.search).toBe("wheat");
  });

  it("rewrites the URL when a late echo lands after the state moved back", () => {
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));

    act(() => result.current.setSearch("w"));
    act(() => result.current.setSearch(""));
    replace.mockClear();
    setSearchParams("q=w");
    rerender();

    expect(result.current.search).toBe("");
    expect(replace).toHaveBeenCalledWith("/list", { scroll: false });
  });

  it("ignores URL changes to params it does not own", () => {
    setSearchParams("status=active");
    const { result, rerender } = renderHook(() => useListUrlState(options));

    act(() => result.current.setFilter("visibility", ["public"]));
    replace.mockClear();
    setSearchParams("status=active&focus=y");
    rerender();

    expect(result.current.filters).toEqual({ status: ["active"], visibility: ["public"] });
  });
});
