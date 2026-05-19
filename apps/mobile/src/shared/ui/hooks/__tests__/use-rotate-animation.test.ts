// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { useRotateAnimation } from "../use-rotate-animation";

const { mockSetValue, mockStart, mockStop, mockLoop, mockTiming, mockValueCtor } = vi.hoisted(
  () => ({
    mockSetValue: vi.fn(),
    mockStart: vi.fn(),
    mockStop: vi.fn(),
    mockLoop: vi.fn(),
    mockTiming: vi.fn(),
    mockValueCtor: vi.fn(),
  }),
);

vi.mock("react-native", () => {
  class Value {
    setValue: (v: number) => void;
    constructor(initial: number) {
      mockValueCtor(initial);
      this.setValue = mockSetValue;
    }
  }
  return {
    Animated: {
      Value,
      timing: (...args: unknown[]) => {
        mockTiming(...args);
        return { __kind: "timing" };
      },
      loop: (inner: unknown) => {
        mockLoop(inner);
        return { start: mockStart, stop: mockStop };
      },
    },
    Easing: { linear: "linear" },
  };
});

describe("useRotateAnimation", () => {
  beforeEach(() => {
    mockSetValue.mockReset();
    mockStart.mockReset();
    mockStop.mockReset();
    mockLoop.mockReset();
    mockTiming.mockReset();
    mockValueCtor.mockReset();
  });

  it("creates an Animated.Value initialised to 0", () => {
    renderHook(() => useRotateAnimation(false));
    expect(mockValueCtor).toHaveBeenCalledWith(0);
  });

  it("does not start a loop when inactive — resets the value to 0 instead", () => {
    renderHook(() => useRotateAnimation(false));
    expect(mockStart).not.toHaveBeenCalled();
    expect(mockSetValue).toHaveBeenCalledWith(0);
  });

  it("starts a 0→1 linear loop when active", () => {
    renderHook(() => useRotateAnimation(true));

    expect(mockTiming).toHaveBeenCalledTimes(1);
    const timingConfig = mockTiming.mock.calls[0][1] as Record<string, unknown>;
    expect(timingConfig.toValue).toBe(1);
    expect(timingConfig.duration).toBe(1000);
    expect(timingConfig.easing).toBe("linear");
    expect(timingConfig.useNativeDriver).toBe(true);

    expect(mockLoop).toHaveBeenCalledTimes(1);
    expect(mockStart).toHaveBeenCalledTimes(1);
  });

  it("stops the loop when active flips back to false", () => {
    const { rerender } = renderHook(({ active }) => useRotateAnimation(active), {
      initialProps: { active: true },
    });
    expect(mockStart).toHaveBeenCalledTimes(1);

    rerender({ active: false });
    expect(mockStop).toHaveBeenCalledTimes(1);
    // setValue(0) was called once on the initial inactive branch (false→true→false) — re-snap.
    expect(mockSetValue).toHaveBeenCalledWith(0);
  });

  it("respects custom durationMs", () => {
    renderHook(() => useRotateAnimation(true, { durationMs: 250 }));

    const timingConfig = mockTiming.mock.calls[0][1] as Record<string, unknown>;
    expect(timingConfig.duration).toBe(250);
  });
});
