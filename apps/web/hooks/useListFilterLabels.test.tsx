import { renderHook } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { useListFilterLabels } from "./useListFilterLabels";

describe("useListFilterLabels", () => {
  it("translates every label the Filter menu and chips need", () => {
    const { result } = renderHook(() => useListFilterLabels());

    expect(result.current).toMatchObject({
      filter: "common.filter",
      addFilter: "common.addFilter",
      is: "common.filterIs",
      back: "common.filterBack",
      clearFilters: "common.clearFilters",
    });
    expect(result.current.chip("Type", "Macros")).toBe("common.filterChip:Type:Macros");
    expect(result.current.selectedCount(2)).toBe("common.filterSelectedCount");
    expect(result.current.removeValue("Type", "Macros")).toBe("common.removeFilterValue");
  });
});
