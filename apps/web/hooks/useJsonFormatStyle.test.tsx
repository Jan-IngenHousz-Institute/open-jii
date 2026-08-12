import { act, renderHook } from "@/test/test-utils";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { useJsonFormatStyle } from "./useJsonFormatStyle";

const KEY = "openjii.json-format-style";

describe("useJsonFormatStyle", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts at the default and hydrates from storage", async () => {
    localStorage.setItem(KEY, "expanded");
    const { result } = renderHook(() => useJsonFormatStyle());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.style).toBe("expanded");
    expect(result.current.isHydrated).toBe(true);
  });

  it("ignores an unrecognised stored value", async () => {
    localStorage.setItem(KEY, "pretty");
    const { result } = renderHook(() => useJsonFormatStyle());

    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current.style).toBe("compact");
  });

  it("keeps every mounted instance in sync", async () => {
    const a = renderHook(() => useJsonFormatStyle());
    const b = renderHook(() => useJsonFormatStyle());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => a.result.current.toggleStyle());

    expect(a.result.current.style).toBe("expanded");
    expect(b.result.current.style).toBe("expanded");
  });

  it("retains the choice when storage throws instead of snapping back", async () => {
    // Private mode: setItem and getItem both throw. The in-memory preference has
    // to survive, so the change notification carries the value rather than
    // sending peers back to storage, which would answer with the default.
    const { result } = renderHook(() => useJsonFormatStyle());
    await act(async () => {
      await Promise.resolve();
    });

    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("blocked");
    });
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("blocked");
    });

    act(() => result.current.toggleStyle());

    expect(result.current.style).toBe("expanded");
  });

  it("ignores another tab writing an unrelated key", async () => {
    // A blocked write leaves the choice in memory only; re-reading storage for
    // somebody else's key would silently discard it.
    const { result } = renderHook(() => useJsonFormatStyle());
    await act(async () => {
      await Promise.resolve();
    });

    act(() => result.current.toggleStyle());
    expect(result.current.style).toBe("expanded");

    localStorage.removeItem(KEY);
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", { key: "openjii.sidebar", newValue: "collapsed" }),
      );
    });

    expect(result.current.style).toBe("expanded");
  });

  it("picks up a change made in another tab", async () => {
    const { result } = renderHook(() => useJsonFormatStyle());
    await act(async () => {
      await Promise.resolve();
    });

    localStorage.setItem(KEY, "expanded");
    act(() => {
      window.dispatchEvent(new StorageEvent("storage", { key: KEY, newValue: "expanded" }));
    });

    expect(result.current.style).toBe("expanded");
  });
});
