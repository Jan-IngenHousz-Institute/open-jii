import { renderHook, act } from "@/test/test-utils";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import { useCopyToClipboard } from "./useCopyToClipboard";

describe("useCopyToClipboard", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockResolvedValue(undefined) },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("copies text using the Clipboard API", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);
  });

  it("resets copied state after the default delay", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.copied).toBe(false);
  });

  it("uses custom resetDelay", async () => {
    const { result } = renderHook(() => useCopyToClipboard(500));

    await act(async () => {
      await result.current.copy("hello");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(499);
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it("logs error when copy fails", async () => {
    const error = new Error("Copy failed");
    Object.assign(navigator, {
      clipboard: { writeText: vi.fn().mockRejectedValue(error) },
    });
    const consoleSpy = vi
      .spyOn(console, "error")
      // intentionally suppress console.error during test
      .mockImplementation(() => undefined);

    const { result } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("fail");
    });

    expect(consoleSpy).toHaveBeenCalledWith("Failed to copy to clipboard:", error);
    expect(result.current.copied).toBe(false);
    consoleSpy.mockRestore();
  });
});
