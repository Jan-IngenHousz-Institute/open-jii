import { act, renderHook } from "@/test/test-utils";
import * as nav from "next/navigation";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { useListFilters } from "./useListFilters";

function setSearchParams(qs: string): void {
  vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(qs));
}

const mockedReplace = vi.mocked(nav.useRouter().replace);

const shape = {
  status: z.enum(["active", "stale", "published"]),
  visibility: z.enum(["private", "public"]),
};

describe("useListFilters", () => {
  beforeEach(() => {
    mockedReplace.mockClear();
    setSearchParams("");
    vi.mocked(nav.usePathname).mockReturnValue("/list");
  });

  afterEach(() => {
    vi.mocked(nav.useSearchParams).mockReset();
    vi.mocked(nav.usePathname).mockReset();
  });

  it("starts empty and inactive without filter params", () => {
    const { result } = renderHook(() => useListFilters(shape));

    expect(result.current.filters).toEqual({ status: [], visibility: [] });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it("reads comma-separated values from the URL", () => {
    setSearchParams("status=active,stale&visibility=public");
    const { result } = renderHook(() => useListFilters(shape));

    expect(result.current.filters).toEqual({ status: ["active", "stale"], visibility: ["public"] });
    expect(result.current.hasActiveFilters).toBe(true);
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it("drops unknown and repeated values and rewrites the URL without them", () => {
    setSearchParams("status=active,bogus,active&visibility=hidden&sort=x");
    const { result } = renderHook(() => useListFilters(shape));

    expect(result.current.filters).toEqual({ status: ["active"], visibility: [] });
    expect(mockedReplace).toHaveBeenCalledWith("/list?status=active&sort=x", { scroll: false });
  });

  it("writes a picked value with readable commas", () => {
    const { result } = renderHook(() => useListFilters(shape));

    act(() => result.current.setFilter("status", ["active", "stale", "active"]));

    expect(result.current.filters.status).toEqual(["active", "stale"]);
    expect(mockedReplace).toHaveBeenLastCalledWith("/list?status=active,stale", { scroll: false });
  });

  it("removes a key when its selection becomes empty", () => {
    setSearchParams("status=active&visibility=public");
    const { result } = renderHook(() => useListFilters(shape));

    act(() => result.current.setFilter("status", []));

    expect(mockedReplace).toHaveBeenLastCalledWith("/list?visibility=public", { scroll: false });
  });

  it("clears every filter in one navigation and keeps other params", () => {
    setSearchParams("sort=%5B%5D&status=active&visibility=public&focus=search");
    const { result } = renderHook(() => useListFilters(shape));

    act(() => result.current.clearFilters());

    expect(result.current.filters).toEqual({ status: [], visibility: [] });
    expect(result.current.hasActiveFilters).toBe(false);
    expect(mockedReplace).toHaveBeenCalledTimes(1);
    expect(mockedReplace).toHaveBeenCalledWith("/list?sort=%5B%5D&focus=search", {
      scroll: false,
    });
  });

  it("navigates to the bare path when the last param goes", () => {
    setSearchParams("visibility=public");
    const { result } = renderHook(() => useListFilters(shape));

    act(() => result.current.clearFilters());

    expect(mockedReplace).toHaveBeenCalledWith("/list", { scroll: false });
  });

  it("follows the URL on back and forward", () => {
    setSearchParams("status=active");
    const { result, rerender } = renderHook(() => useListFilters(shape));

    setSearchParams("status=published&visibility=private");
    rerender();

    expect(result.current.filters).toEqual({ status: ["published"], visibility: ["private"] });
    expect(mockedReplace).not.toHaveBeenCalled();
  });

  it("ignores URL changes to params it does not own", () => {
    setSearchParams("status=active");
    const { result, rerender } = renderHook(() => useListFilters(shape));

    act(() => result.current.setFilter("visibility", ["public"]));
    mockedReplace.mockClear();
    setSearchParams("status=active&sort=y");
    rerender();

    expect(result.current.filters).toEqual({ status: ["active"], visibility: ["public"] });
  });
});
