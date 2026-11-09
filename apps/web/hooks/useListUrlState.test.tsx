import {
  ListDepartureProvider,
  useDepartureNavigation,
  useDepartureRouter,
} from "@/components/navigation/list-departure/list-departure";
import { act } from "@/test/test-utils";
import { renderHook } from "@testing-library/react";
import * as nav from "next/navigation";
import { StrictMode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { zExperimentSort } from "@repo/api/domains/experiment/experiment.schema";

import { useListUrlState } from "./useListUrlState";

function setSearchParams(qs: string): void {
  window.history.replaceState(null, "", `/list${qs ? `?${qs}` : ""}`);
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}

const replace = vi.mocked(nav.useRouter().replace);

const filters = {
  status: z.enum(["active", "stale", "published"]),
  visibility: z.enum(["private", "public"]),
};

const options = { filters, sort: zExperimentSort, searchKey: null };
const withSearch = { filters, sort: zExperimentSort, searchKey: "q" as const };

const sortParam = (value: unknown) => `sort=${encodeURIComponent(JSON.stringify(value))}`;

describe("useListUrlState", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    replace.mockClear();
    setSearchParams("");
    vi.mocked(nav.usePathname).mockReturnValue("/list");
  });

  afterEach(() => {
    vi.useRealTimers();
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
    it("leaves q alone for an explicit sort-only consumer", () => {
      setSearchParams("q=unowned");
      const { result } = renderHook(() => useListUrlState(options));
      act(() => result.current.setSearch("wheat"));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(result.current.search).toBe("wheat");
      expect(replace).not.toHaveBeenCalled();
      act(() => result.current.toggleSort("name", false));
      expect(replace.mock.lastCall?.[0]).toContain("q=unowned");
    });

    it("initializes immediately, debounces edits for 300 ms, and removes an empty term", () => {
      setSearchParams("q=lab");
      const { result } = renderHook(() => useListUrlState(withSearch));
      expect(result.current.search).toBe("lab");
      act(() => result.current.setSearch("lab north"));
      expect(result.current.search).toBe("lab north");
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(replace).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(replace).toHaveBeenLastCalledWith("/list?q=lab+north", { scroll: false });
      act(() => result.current.setSearch(""));
      expect(replace).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(replace).toHaveBeenLastCalledWith("/list", { scroll: false });
    });

    it("resets the timer on continued typing", () => {
      const { result } = renderHook(() => useListUrlState(withSearch));
      act(() => result.current.setSearch("w"));
      act(() => {
        vi.advanceTimersByTime(250);
      });
      act(() => result.current.setSearch("wheat"));
      act(() => {
        vi.advanceTimersByTime(299);
      });
      expect(replace).not.toHaveBeenCalled();
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(replace).toHaveBeenCalledExactlyOnceWith("/list?q=wheat", { scroll: false });
    });

    it("combines same-event search, filter and sort changes in one immediate write", () => {
      const { result } = renderHook(() => useListUrlState(withSearch));
      act(() => {
        result.current.setSearch("wheat");
        result.current.setFilter("status", ["active"]);
        result.current.toggleSort("name", false);
        result.current.setSearch("wheat north");
      });
      expect(replace).toHaveBeenCalledTimes(1);
      const params = new URL(replace.mock.lastCall?.[0] ?? "", location.origin).searchParams;
      expect(params.get("q")).toBe("wheat north");
      expect(params.get("status")).toBe("active");
      expect(params.get("sort")).toContain("name");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(replace).toHaveBeenCalledTimes(1);
    });

    it("merges special characters into live unowned parameters and keeps the hash", () => {
      const { result } = renderHook(() => useListUrlState(withSearch));
      const term = "  植物, wheat & +  ";
      act(() => result.current.setSearch(term));
      window.history.replaceState(null, "", "/list?focus=new#section");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      const url = new URL(replace.mock.lastCall?.[0] ?? "", location.origin);
      expect(url.searchParams.get("q")).toBe(term);
      expect(url.searchParams.get("focus")).toBe("new");
      expect(url.hash).toBe("#section");
    });

    it("does not bypass the delay when the URL acknowledges an earlier write", () => {
      const { result, rerender } = renderHook(() => useListUrlState(withSearch));
      act(() => result.current.setSearch("w"));
      act(() => {
        vi.advanceTimersByTime(300);
      });
      act(() => result.current.setSearch("wheat"));
      act(() => {
        vi.advanceTimersByTime(100);
      });
      setSearchParams("q=w");
      rerender();
      expect(result.current.search).toBe("wheat");
      expect(replace).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(199);
      });
      expect(replace).toHaveBeenCalledTimes(1);
      act(() => {
        vi.advanceTimersByTime(1);
      });
      expect(replace).toHaveBeenLastCalledWith("/list?q=wheat", { scroll: false });
    });

    it("restores an external owned URL edit and cancels the draft", () => {
      const { result, rerender } = renderHook(() => useListUrlState(withSearch));
      act(() => result.current.setSearch("unfinished"));
      setSearchParams("q=external");
      rerender();
      expect(result.current.search).toBe("external");
      act(() => {
        vi.advanceTimersByTime(300);
      });
      expect(replace).not.toHaveBeenCalled();
    });

    it("keeps a draft and its original deadline across an unowned URL edit", () => {
      const { result, rerender } = renderHook(() => useListUrlState(withSearch));
      act(() => result.current.setSearch("draft"));
      act(() => {
        vi.advanceTimersByTime(100);
      });
      setSearchParams("focus=other");
      rerender();
      expect(result.current.search).toBe("draft");
      act(() => {
        vi.advanceTimersByTime(200);
      });
      expect(replace).toHaveBeenCalledExactlyOnceWith("/list?focus=other&q=draft", {
        scroll: false,
      });
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
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.setSearch("wh"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
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
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.setSearch(""));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    replace.mockClear();
    setSearchParams("q=w");
    rerender();

    expect(result.current.search).toBe("");
    expect(replace).toHaveBeenCalledWith("/list", { scroll: false });
  });

  it("keeps a repeated state when an older echo lands after a newer one", () => {
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));

    act(() => result.current.setSearch("a"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.setSearch("ab"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.setSearch("a"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    setSearchParams("q=a");
    rerender();
    replace.mockClear();
    setSearchParams("q=ab");
    rerender();

    expect(result.current.search).toBe("a");
    expect(replace).toHaveBeenLastCalledWith("/list?q=a", { scroll: false });
  });

  it("follows back and forward to a value it is still waiting to see", () => {
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));

    act(() => result.current.setSearch("a"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.setSearch("ab"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    setSearchParams("q=a");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    rerender();

    expect(result.current.search).toBe("a");
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

  it("flushes same-event edits before push, once, with a null native-history payload", () => {
    const native = vi.spyOn(window.history, "replaceState");
    const { result } = renderHook(
      () => ({
        list: useListUrlState(withSearch),
        router: useDepartureRouter(),
      }),
      { wrapper: ListDepartureProvider },
    );
    native.mockClear();
    const push = vi.mocked(nav.useRouter().push);
    push.mockImplementationOnce(() => {
      expect(location.search).toBe("?q=latest");
    });
    act(() => {
      result.current.list.setSearch("latest");
      result.current.router.push("/detail");
      result.current.router.push("/detail");
    });
    expect(native).toHaveBeenCalledExactlyOnceWith(null, "", "/list?q=latest");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).not.toHaveBeenCalled();
    native.mockRestore();
  });

  it("does not flush sort-only consumers", () => {
    const { result } = renderHook(
      () => ({
        list: useListUrlState(options),
        router: useDepartureRouter(),
      }),
      { wrapper: ListDepartureProvider },
    );
    act(() => {
      result.current.list.setSearch("memory");
      result.current.router.push("/detail");
    });
    expect(location.search).toBe("");
  });

  it("invalidates a timer on popstate before React replays the destination", () => {
    setSearchParams("q=committed");
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));
    act(() => result.current.setSearch("draft"));
    window.history.replaceState(null, "", "/other?q=destination");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(result.current.search).toBe("destination");
    vi.mocked(nav.usePathname).mockReturnValue("/other");
    vi.mocked(nav.useSearchParams).mockReturnValue(
      new nav.ReadonlyURLSearchParams("q=destination"),
    );
    rerender();
    expect(result.current.search).toBe("destination");
  });

  it("does not write after the browser has moved to another source route", () => {
    const { result } = renderHook(() => useListUrlState(withSearch));
    act(() => result.current.setSearch("draft"));
    window.history.replaceState(null, "", "/other?keep=destination");
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(location.pathname + location.search).toBe("/other?keep=destination");
  });

  it("cancels timers and unregisters callbacks on unmount, including Strict Mode", () => {
    const { result, unmount } = renderHook(() => useListUrlState(withSearch), {
      wrapper: ({ children }) => (
        <StrictMode>
          <ListDepartureProvider>{children}</ListDepartureProvider>
        </StrictMode>
      ),
    });
    act(() => result.current.setSearch("draft"));
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).not.toHaveBeenCalled();
    expect(location.search).toBe("");
  });

  it("keeps typing usable after a cancelled link navigation", () => {
    const { result } = renderHook(
      () => ({
        list: useListUrlState(withSearch),
        navigate: useDepartureNavigation((event) => event.preventDefault()),
      }),
      { wrapper: ListDepartureProvider },
    );
    act(() => {
      result.current.list.setSearch("first");
      result.current.navigate({ preventDefault: () => undefined });
    });
    expect(location.search).toBe("");
    act(() => result.current.list.setSearch("second"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/list?q=second", { scroll: false });
  });

  it("drops an old route's draft when the same hook survives a route change", () => {
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));
    act(() => result.current.setSearch("draft"));
    vi.mocked(nav.usePathname).mockReturnValue("/other");
    window.history.replaceState(null, "", "/other?keep=destination");
    rerender();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.search).toBe("");
    expect(replace).not.toHaveBeenCalled();
    expect(location.pathname + location.search).toBe("/other?keep=destination");
  });

  it("still writes after Strict Mode's initial cleanup", () => {
    const { result } = renderHook(() => useListUrlState(withSearch), {
      wrapper: StrictMode,
    });
    act(() => result.current.setSearch("wheat"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/list?q=wheat", { scroll: false });
  });

  it("restores a same-path destination that equals the URL from before the flush", () => {
    let renders = 0;
    let maxRenders = 10;
    const { result, rerender } = renderHook(
      () => {
        renders += 1;
        if (renders > maxRenders) throw new Error("the list kept rendering after the URL settled");
        return {
          list: useListUrlState(withSearch),
          router: useDepartureRouter(),
        };
      },
      { wrapper: ListDepartureProvider },
    );
    act(() => result.current.list.setSearch("draft"));
    act(() => result.current.router.push("/list"));
    expect(location.search).toBe("?q=draft");
    // Next can batch the native replacement and push into the original search-params object.
    window.history.replaceState(null, "", "/list");
    maxRenders = renders + 2;
    rerender();
    expect(result.current.list.search).toBe("");
    expect(replace).not.toHaveBeenCalled();
  });

  it("waits for a write still in flight instead of resending it after an earlier echo", () => {
    const { result, rerender } = renderHook(
      () => ({
        list: useListUrlState(withSearch),
        router: useDepartureRouter(),
      }),
      { wrapper: ListDepartureProvider },
    );
    act(() => result.current.list.setSearch("w"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.list.setSearch("wh"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    for (const echo of ["q=w", "q=wh", "q=wh"]) {
      setSearchParams(echo);
      rerender();
    }
    expect(replace).toHaveBeenCalledTimes(2);
    expect(result.current.list.search).toBe("wh");
    act(() => result.current.list.setSearch("x"));
    act(() => result.current.router.push("/list"));
    setSearchParams("q=wh");
    rerender();
    expect(result.current.list.search).toBe("wh");
    expect(replace).toHaveBeenCalledTimes(2);
  });

  it("repairs a late router echo after a native flush when the list stays mounted", () => {
    const { result, rerender } = renderHook(
      () => ({
        list: useListUrlState(withSearch),
        router: useDepartureRouter(),
      }),
      { wrapper: ListDepartureProvider },
    );
    act(() => result.current.list.setSearch("earlier"));
    act(() => {
      vi.advanceTimersByTime(300);
    });
    act(() => result.current.list.setSearch("latest"));
    act(() => result.current.router.push("/list"));
    expect(location.search).toBe("?q=latest");
    replace.mockClear();
    setSearchParams("q=earlier");
    rerender();
    expect(result.current.list.search).toBe("latest");
    expect(replace).toHaveBeenCalledExactlyOnceWith("/list?q=latest", { scroll: false });
    setSearchParams("q=latest");
    rerender();
    expect(result.current.list.search).toBe("latest");
  });

  it("keeps the draft and its deadline through a hash-only history step", () => {
    setSearchParams("q=committed");
    const { result, rerender } = renderHook(() => useListUrlState(withSearch));
    act(() => result.current.setSearch("draft"));
    act(() => {
      vi.advanceTimersByTime(100);
    });
    window.history.pushState(null, "", "/list?q=committed#section");
    act(() => {
      window.dispatchEvent(new PopStateEvent("popstate"));
    });
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams("q=committed"));
    rerender();
    expect(result.current.search).toBe("draft");
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(replace).toHaveBeenCalledExactlyOnceWith("/list?q=draft#section", { scroll: false });
  });
});
