import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockUseState } = vi.hoisted(() => ({
  mockUseState: vi.fn(),
}));

vi.mock("react", () => ({
  useState: mockUseState,
}));

import { useMultiTapAction } from "../use-multi-tap-action";

describe("useMultiTapAction", () => {
  let tapCount: number;
  let lastTapTime: number;

  function setupMockState() {
    let slot = 0;
    mockUseState.mockImplementation((_init: number) => {
      const current = slot++;
      if (current === 0) {
        return [tapCount, (v: number) => { tapCount = v; }];
      }
      return [lastTapTime, (v: number) => { lastTapTime = v; }];
    });
  }

  function renderHook(onAction: () => void, options?: { tapsRequired?: number; intervalMs?: number }) {
    setupMockState();
    return useMultiTapAction(onAction, options);
  }

  beforeEach(() => {
    tapCount = 0;
    lastTapTime = 0;
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(1000);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns a function", () => {
    const handleTap = renderHook(vi.fn());
    expect(typeof handleTap).toBe("function");
  });

  it("calls onAction after 3 taps (default) within the 600ms window", () => {
    const onAction = vi.fn();

    renderHook(onAction)();           // tap 1 at 1000ms → count=1

    vi.setSystemTime(1500);
    renderHook(onAction)();           // tap 2 at 1500ms (+500ms) → count=2

    vi.setSystemTime(2000);
    renderHook(onAction)();           // tap 3 at 2000ms (+500ms) → count=3, fires

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("does not call onAction before reaching tapsRequired", () => {
    const onAction = vi.fn();

    renderHook(onAction)();
    vi.setSystemTime(1500);
    renderHook(onAction)();

    expect(onAction).not.toHaveBeenCalled();
  });

  it("resets count when a tap falls outside the interval window", () => {
    const onAction = vi.fn();

    renderHook(onAction)();           // tap 1 at 1000ms → count=1, lastTapTime=1000

    vi.setSystemTime(2000);           // +1000ms > 600ms, window expired
    renderHook(onAction)();           // resets to count=1

    vi.setSystemTime(2500);
    renderHook(onAction)();           // count=2, still < 3

    expect(onAction).not.toHaveBeenCalled();
  });

  it("resets tapCount and lastTapTime to 0 after firing", () => {
    const onAction = vi.fn();

    renderHook(onAction)();
    vi.setSystemTime(1500);
    renderHook(onAction)();
    vi.setSystemTime(2000);
    renderHook(onAction)();           // fires

    expect(tapCount).toBe(0);
    expect(lastTapTime).toBe(0);
  });

  it("respects custom tapsRequired", () => {
    const onAction = vi.fn();

    renderHook(onAction, { tapsRequired: 2 })();   // tap 1

    vi.setSystemTime(1500);
    renderHook(onAction, { tapsRequired: 2 })();   // tap 2 → fires

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("respects custom intervalMs", () => {
    const onAction = vi.fn();

    renderHook(onAction, { intervalMs: 200 })();   // tap 1 at 1000ms

    vi.setSystemTime(1300);                        // +300ms > 200ms, window expired
    renderHook(onAction, { intervalMs: 200 })();   // resets to count=1

    vi.setSystemTime(1400);                        // +100ms within 200ms
    renderHook(onAction, { intervalMs: 200 })();   // count=2, still < 3

    expect(onAction).not.toHaveBeenCalled();
  });

  it("treats tap at exactly intervalMs boundary as outside the window (exclusive upper bound)", () => {
    const onAction = vi.fn();
    const intervalMs = 600;

    // tap 1 at 1000ms → count=1, lastTapTime=1000
    renderHook(onAction, { intervalMs })();

    // tap 2 at exactly 1000+600=1600ms: now - lastTapTime === intervalMs → withinWindow = false → count resets to 1
    vi.setSystemTime(1600);
    renderHook(onAction, { intervalMs })();

    expect(tapCount).toBe(1);
    expect(onAction).not.toHaveBeenCalled();
  });
});
