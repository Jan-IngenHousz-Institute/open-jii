import { renderHook, waitFor } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import { useSearchPending } from "./useSearchPending";

describe("useSearchPending", () => {
  it("covers the debounce and the request caused by a changed term", async () => {
    const { result, rerender } = renderHook(
      ({ search, debouncedSearch, isFetching }) =>
        useSearchPending({ search, debouncedSearch, isFetching }),
      {
        initialProps: { search: "", debouncedSearch: "", isFetching: false },
      },
    );

    expect(result.current).toBe(false);

    rerender({ search: "maize", debouncedSearch: "", isFetching: false });
    expect(result.current).toBe(true);

    rerender({ search: "maize", debouncedSearch: "maize", isFetching: true });
    expect(result.current).toBe(true);

    rerender({ search: "maize", debouncedSearch: "maize", isFetching: false });
    await waitFor(() => expect(result.current).toBe(false));
  });

  it("ignores pagination and background refreshes for a settled search", async () => {
    const { result, rerender } = renderHook(
      ({ isFetching }) =>
        useSearchPending({ search: "maize", debouncedSearch: "maize", isFetching }),
      { initialProps: { isFetching: true } },
    );

    expect(result.current).toBe(true);

    rerender({ isFetching: false });
    await waitFor(() => expect(result.current).toBe(false));

    rerender({ isFetching: true });
    expect(result.current).toBe(false);
  });

  it("does not report a pending search after the input is cleared", () => {
    const { result } = renderHook(() =>
      useSearchPending({ search: "", debouncedSearch: "maize", isFetching: true }),
    );

    expect(result.current).toBe(false);
  });
});
