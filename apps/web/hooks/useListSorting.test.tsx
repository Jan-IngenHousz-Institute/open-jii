import { act, renderHook } from "@/test/test-utils";
import * as nav from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { zExperimentSort } from "@repo/api/domains/experiment/experiment.schema";

import { useListSorting } from "./useListSorting";

const replace = vi.mocked(nav.useRouter().replace);

describe("useListSorting", () => {
  beforeEach(() => {
    replace.mockClear();
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams());
  });

  it("cycles a single sort and removes it from the URL", () => {
    const { result } = renderHook(() => useListSorting(zExperimentSort));
    act(() => result.current.toggleSort("name", false));
    expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
    act(() => result.current.toggleSort("name", false));
    expect(result.current.sort).toEqual([{ field: "name", direction: "desc" }]);
    act(() => result.current.toggleSort("name", false));
    expect(result.current.sort).toEqual([]);
    expect(replace.mock.calls.at(-1)?.[0]).not.toContain("sort=");
  });

  it("adds a second, toggles it in place, then replaces the oldest on a third", () => {
    const { result } = renderHook(() => useListSorting(zExperimentSort));
    act(() => result.current.toggleSort("name", false));
    act(() => result.current.toggleSort("status", true));
    expect(result.current.sort.map((item) => item.field)).toEqual(["name", "status"]);
    act(() => result.current.toggleSort("name", true));
    expect(result.current.sort).toEqual([
      { field: "name", direction: "desc" },
      { field: "status", direction: "asc" },
    ]);
    act(() => result.current.toggleSort("owner", true));
    expect(result.current.sort.map((item) => item.field)).toEqual(["status", "owner"]);
  });

  it("restores valid URL sorting and ignores invalid fields", () => {
    const raw = encodeURIComponent(JSON.stringify([{ field: "updated", direction: "desc" }]));
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams(`sort=${raw}`));
    const { result, unmount } = renderHook(() => useListSorting(zExperimentSort));
    expect(result.current.sort).toEqual([{ field: "updated", direction: "desc" }]);
    unmount();
    vi.mocked(nav.useSearchParams).mockReturnValue(
      new nav.ReadonlyURLSearchParams(
        "sort=%5B%7B%22field%22%3A%22activity%22%2C%22direction%22%3A%22asc%22%7D%5D",
      ),
    );
    expect(renderHook(() => useListSorting(zExperimentSort)).result.current.sort).toEqual([]);
  });

  it("keeps unrelated URL parameters when sorting is reset", () => {
    vi.mocked(nav.useSearchParams).mockReturnValue(new nav.ReadonlyURLSearchParams("search=water"));
    const { result } = renderHook(() => useListSorting(zExperimentSort));
    act(() => result.current.toggleSort("name", false));
    expect(replace.mock.calls.at(-1)?.[0]).toContain("search=water");
    act(() => result.current.setSort([]));
    expect(replace.mock.calls.at(-1)?.[0]).toBe("/platform/experiments?search=water");
  });
});
