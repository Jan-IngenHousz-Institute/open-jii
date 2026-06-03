// @vitest-environment jsdom
import type { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useModalPresentation } from "~/shared/ui/hooks/use-modal-presentation";

const { mockAddListener, mockRemove } = vi.hoisted(() => ({
  mockAddListener: vi.fn(),
  mockRemove: vi.fn(),
}));

vi.mock("react-native", () => ({
  BackHandler: {
    addEventListener: (...args: unknown[]) => {
      mockAddListener(...args);
      return { remove: mockRemove };
    },
  },
}));

function makeRef() {
  const present = vi.fn();
  const dismiss = vi.fn();
  // useRef-style ref object with the BottomSheetModalMethods we care about
  const ref = { current: { present, dismiss } as unknown as BottomSheetModalMethods };
  return { ref, present, dismiss };
}

describe("useModalPresentation", () => {
  beforeEach(() => {
    mockAddListener.mockReset();
    mockRemove.mockReset();
  });

  it("calls present() when visible flips true and dismiss() when it flips false", () => {
    const { ref, present, dismiss } = makeRef();
    const { rerender } = renderHook(
      ({ visible }) => useModalPresentation(visible, { current: ref.current }),
      { initialProps: { visible: false } },
    );

    expect(present).not.toHaveBeenCalled();

    rerender({ visible: true });
    expect(present).toHaveBeenCalledTimes(1);
    expect(dismiss).toHaveBeenCalledTimes(1); // initial mount also fires the false branch

    rerender({ visible: false });
    expect(dismiss).toHaveBeenCalledTimes(2);
  });

  it("fires optional onPresent / onDismiss callbacks on the corresponding transition", () => {
    const { ref } = makeRef();
    const onPresent = vi.fn();
    const onDismiss = vi.fn();

    const { rerender } = renderHook(
      ({ visible }) =>
        useModalPresentation(visible, { current: ref.current }, { onPresent, onDismiss }),
      { initialProps: { visible: false } },
    );

    // Initial mount with visible=false fires the dismiss branch once.
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(onPresent).not.toHaveBeenCalled();

    rerender({ visible: true });
    expect(onPresent).toHaveBeenCalledTimes(1);

    rerender({ visible: false });
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });

  it("subscribes to hardwareBackPress only while visible, and unsubscribes on close", () => {
    const { ref } = makeRef();
    const { rerender } = renderHook(
      ({ visible }) => useModalPresentation(visible, { current: ref.current }),
      { initialProps: { visible: false } },
    );

    expect(mockAddListener).not.toHaveBeenCalled();

    rerender({ visible: true });
    expect(mockAddListener).toHaveBeenCalledTimes(1);
    expect(mockAddListener.mock.calls[0][0]).toBe("hardwareBackPress");

    rerender({ visible: false });
    expect(mockRemove).toHaveBeenCalledTimes(1);
  });

  it("back-press handler dismisses the sheet and returns true (blocks default)", () => {
    const { ref, dismiss } = makeRef();
    renderHook(() => useModalPresentation(true, { current: ref.current }));

    const onBackPress = mockAddListener.mock.calls[0][1] as () => boolean;
    const result = onBackPress();

    expect(dismiss).toHaveBeenCalled();
    expect(result).toBe(true);
  });
});
