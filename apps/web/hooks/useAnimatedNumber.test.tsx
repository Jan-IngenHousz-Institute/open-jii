import { act, renderHook } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useAnimatedNumber } from "./useAnimatedNumber";

interface Props {
  value: number;
  subject?: string;
}

function renderCount(initialProps: Props) {
  return renderHook(({ value, subject }: Props) => useAnimatedNumber(value, subject), {
    initialProps,
  });
}

describe("useAnimatedNumber", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the first value as it is", () => {
    const { result } = renderCount({ value: 120 });

    expect(result.current).toBe(120);
  });

  it("counts from the old value and settles on the new one", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame", "performance"] });
    const { result, rerender } = renderCount({ value: 100 });

    rerender({ value: 200 });
    expect(result.current).toBe(100);

    act(() => {
      vi.advanceTimersByTime(350);
    });
    expect(result.current).toBeGreaterThan(100);
    expect(result.current).toBeLessThan(200);

    act(() => {
      vi.advanceTimersByTime(400);
    });
    expect(result.current).toBe(200);
  });

  it("shows a count filling in from zero as it is", () => {
    const { result, rerender } = renderCount({ value: 0 });

    rerender({ value: 50 });

    expect(result.current).toBe(50);
  });

  it("jumps straight to a new subject's value", () => {
    const { result, rerender } = renderCount({ value: 100, subject: "raw_data" });

    rerender({ value: 7, subject: "macro-1" });

    expect(result.current).toBe(7);
  });
});
