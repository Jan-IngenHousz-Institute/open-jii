import { act, renderHook } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { useTableSort } from "./use-table-sort";

describe("useTableSort", () => {
  it("seeds the sort column from the default and starts DESC", () => {
    const { result } = renderHook(() => useTableSort("time"));
    expect(result.current.sortColumn).toBe("time");
    expect(result.current.sortDirection).toBe("DESC");
  });

  it("starts with no sort column when no default is given", () => {
    const { result } = renderHook(() => useTableSort(undefined));
    expect(result.current.sortColumn).toBeUndefined();
  });

  it("toggles direction when re-sorting the same column", () => {
    const { result } = renderHook(() => useTableSort("time"));
    act(() => result.current.handleSort("time"));
    expect(result.current.sortDirection).toBe("ASC");
    act(() => result.current.handleSort("time"));
    expect(result.current.sortDirection).toBe("DESC");
  });

  it("resets to ASC when switching to a new column", () => {
    const { result } = renderHook(() => useTableSort("time"));
    act(() => result.current.handleSort("time"));
    expect(result.current.sortDirection).toBe("ASC");

    act(() => result.current.handleSort("value"));
    expect(result.current.sortColumn).toBe("value");
    expect(result.current.sortDirection).toBe("ASC");
  });

  it("adopts a late-arriving default only when no column has been chosen yet", () => {
    const { result, rerender } = renderHook<ReturnType<typeof useTableSort>, string | undefined>(
      (defaultCol) => useTableSort(defaultCol),
      { initialProps: undefined },
    );

    expect(result.current.sortColumn).toBeUndefined();
    rerender("time");
    expect(result.current.sortColumn).toBe("time");

    // Switching the default later must not stomp on the user's pick.
    act(() => result.current.handleSort("value"));
    rerender("created_at");
    expect(result.current.sortColumn).toBe("value");
  });
});
