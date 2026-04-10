import { describe, expect, it, vi, beforeEach } from "vitest";

import { useMultiTapReveal } from "../use-multi-tap-reveal";

let capturedOnAction: () => void;
let capturedOptions: Record<string, unknown>;
const mockHandleTap = vi.fn();

const { mockUseState } = vi.hoisted(() => ({
  mockUseState: vi.fn(),
}));

vi.mock("react", () => ({
  useState: mockUseState,
}));

vi.mock("~/hooks/use-multi-tap-action", () => ({
  useMultiTapAction: (onAction: () => void, options: Record<string, unknown>) => {
    capturedOnAction = onAction;
    capturedOptions = options;
    return mockHandleTap;
  },
}));

describe("useMultiTapReveal", () => {
  let isVisible: boolean;

  function renderHook(options?: { tapsRequired?: number; intervalMs?: number }) {
    let slot = 0;
    mockUseState.mockImplementation((_init: boolean) => {
      if (slot++ === 0) {
        return [
          isVisible,
          (v: boolean) => {
            isVisible = v;
          },
        ];
      }
      return [false, vi.fn()];
    });
    return useMultiTapReveal(options);
  }

  beforeEach(() => {
    isVisible = false;
    vi.clearAllMocks();
  });

  it("is not visible initially", () => {
    const { isVisible: visible } = renderHook();
    expect(visible).toBe(false);
  });

  it("returns the handleTap from useMultiTapAction", () => {
    const { handleTap } = renderHook();
    expect(handleTap).toBe(mockHandleTap);
  });

  it("becomes visible when onAction is triggered", () => {
    renderHook();
    capturedOnAction(); // setIsVisible(true)

    const { isVisible: visible } = renderHook();
    expect(visible).toBe(true);
  });

  it("defaults to tapsRequired 4", () => {
    renderHook();
    expect(capturedOptions.tapsRequired).toBe(4);
  });

  it("forwards custom tapsRequired", () => {
    renderHook({ tapsRequired: 7 });
    expect(capturedOptions.tapsRequired).toBe(7);
  });

  it("forwards custom intervalMs", () => {
    renderHook({ intervalMs: 300 });
    expect(capturedOptions.intervalMs).toBe(300);
  });
});
