import { openOnUrl } from "@/test/list-request";
import { act, renderHook } from "@/test/test-utils";
import * as nav from "next/navigation";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useNameUpdatedListSort } from "./useNameUpdatedListSort";

const PATH = "/en-US/platform/experiments/exp-1/dashboards";
const sortParam = (value: unknown) => `sort=${encodeURIComponent(JSON.stringify(value))}`;

describe("useNameUpdatedListSort", () => {
  beforeEach(() => {
    openOnUrl(PATH, "");
    vi.mocked(nav.useRouter().replace).mockClear();
  });

  it("starts unsorted and cycles a header asc, desc, off", () => {
    const { result } = renderHook(() => useNameUpdatedListSort());
    expect(result.current.sort).toEqual([]);

    act(() => result.current.toggleSort("name", false));
    expect(result.current.sort).toEqual([{ field: "name", direction: "asc" }]);
    act(() => result.current.toggleSort("name", false));
    expect(result.current.sort).toEqual([{ field: "name", direction: "desc" }]);
    act(() => result.current.toggleSort("name", false));
    expect(result.current.sort).toEqual([]);
  });

  it("adds a second field on a multi toggle", () => {
    const { result } = renderHook(() => useNameUpdatedListSort());

    act(() => result.current.toggleSort("name", false));
    act(() => result.current.toggleSort("updatedAt", true));
    expect(result.current.sort).toEqual([
      { field: "name", direction: "asc" },
      { field: "updatedAt", direction: "asc" },
    ]);
  });

  it("ignores a URL sort on a field these lists cannot sort by", () => {
    openOnUrl(PATH, sortParam([{ field: "widgets", direction: "asc" }]));
    const { result } = renderHook(() => useNameUpdatedListSort());

    expect(result.current.sort).toEqual([]);
  });
});
