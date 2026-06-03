// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useAppState } from "~/shared/ui/hooks/use-app-state";

const { mockAddListener, mockRemove } = vi.hoisted(() => ({
  mockAddListener: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock("react-native", () => ({
  AppState: {
    addEventListener: (event: string, fn: (state: string) => void) => {
      mockAddListener(event, fn);
      return { remove: mockRemove };
    },
  },
}));

describe("useAppState", () => {
  beforeEach(() => {
    mockAddListener.mockReset();
    mockRemove.mockReset();
  });

  it("subscribes to the 'change' event on mount and removes on unmount", () => {
    const { unmount } = renderHook(() => useAppState(() => undefined));

    expect(mockAddListener).toHaveBeenCalledTimes(1);
    expect(mockAddListener.mock.calls[0][0]).toBe("change");
    expect(mockRemove).not.toHaveBeenCalled();

    unmount();
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("forwards the latest state to the handler", () => {
    const handler = vi.fn();
    renderHook(() => useAppState(handler));

    const listener = mockAddListener.mock.calls[0][1] as (state: string) => void;
    listener("active");
    listener("background");

    expect(handler).toHaveBeenNthCalledWith(1, "active");
    expect(handler).toHaveBeenNthCalledWith(2, "background");
  });

  it("does NOT re-subscribe when the handler identity changes between renders", () => {
    const { rerender } = renderHook(({ handler }) => useAppState(handler), {
      initialProps: { handler: vi.fn() },
    });
    rerender({ handler: vi.fn() });
    rerender({ handler: vi.fn() });

    expect(mockAddListener).toHaveBeenCalledTimes(1);
  });

  it("calls the most recently passed handler even though the subscription is stable", () => {
    const handlerA = vi.fn();
    const handlerB = vi.fn();

    const { rerender } = renderHook(({ handler }) => useAppState(handler), {
      initialProps: { handler: handlerA },
    });
    rerender({ handler: handlerB });

    const listener = mockAddListener.mock.calls[0][1] as (state: string) => void;
    listener("active");

    expect(handlerA).not.toHaveBeenCalled();
    expect(handlerB).toHaveBeenCalledWith("active");
  });
});
