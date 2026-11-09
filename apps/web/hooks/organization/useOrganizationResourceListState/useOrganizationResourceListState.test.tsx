import { openOnUrl } from "@/test/list-request";
import { act, renderHook } from "@/test/test-utils";
import * as nav from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useOrganizationResourceListState } from "./useOrganizationResourceListState";

const PATH = "/en-US/platform/organizations/org-1";
const sortParam = (value: unknown) => `sort=${encodeURIComponent(JSON.stringify(value))}`;

describe("useOrganizationResourceListState", () => {
  beforeEach(() => {
    openOnUrl(PATH, "");
    vi.mocked(nav.useRouter().replace).mockClear();
  });

  it("defaults to every type, recent first and an empty search", () => {
    const { result } = renderHook(() => useOrganizationResourceListState());

    expect(result.current.filters.type).toEqual([]);
    expect(result.current.sort).toBe("recent");
    expect(result.current.query).toBe("");
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("reads search, the type filter and sort from the URL", () => {
    openOnUrl(
      PATH,
      `q=canopy&type=macro,device&${sortParam([{ field: "type", direction: "asc" }])}`,
    );
    const { result } = renderHook(() => useOrganizationResourceListState());

    expect(result.current.query).toBe("canopy");
    expect(result.current.filters.type).toEqual(["macro", "device"]);
    expect(result.current.sort).toBe("type");
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("falls back to recent for a sort the control cannot show", () => {
    openOnUrl(PATH, sortParam([{ field: "name", direction: "desc" }]));
    const { result } = renderHook(() => useOrganizationResourceListState());

    expect(result.current.sort).toBe("recent");
  });

  it("writes a named sort to the URL, and recent clears it", () => {
    const replace = vi.mocked(nav.useRouter().replace);
    const { result } = renderHook(() => useOrganizationResourceListState());

    act(() => result.current.setSort("name"));
    expect(result.current.sort).toBe("name");
    expect(replace).toHaveBeenLastCalledWith(
      `${PATH}?${sortParam([{ field: "name", direction: "asc" }]).replace(/%2C/gu, ",")}`,
      { scroll: false },
    );

    act(() => result.current.setSort("recent"));
    expect(result.current.sort).toBe("recent");
  });

  it("clears only the type filter and includes pending search in the URL", () => {
    openOnUrl(PATH, "type=macro");
    const replace = vi.mocked(nav.useRouter().replace);
    const { result } = renderHook(() => useOrganizationResourceListState());

    act(() => result.current.setQuery("canopy"));

    act(() => result.current.clearFilters());
    expect(result.current.filters.type).toEqual([]);
    expect(result.current.query).toBe("canopy");
    expect(replace).toHaveBeenLastCalledWith(`${PATH}?q=canopy`, { scroll: false });
  });
});
