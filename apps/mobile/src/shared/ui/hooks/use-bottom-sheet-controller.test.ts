// @vitest-environment jsdom
import { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useBottomSheetController } from "~/shared/ui/hooks/use-bottom-sheet-controller";

const { mockAddListener, mockRemove, mockKeyboardDismiss } = vi.hoisted(() => ({
  mockAddListener: vi.fn(),
  mockRemove: vi.fn(),
  mockKeyboardDismiss: vi.fn(),
}));

vi.mock("react-native", () => ({
  BackHandler: {
    addEventListener: (...args: unknown[]) => {
      mockAddListener(...args);
      return { remove: mockRemove };
    },
  },
  Keyboard: { dismiss: mockKeyboardDismiss },
}));

vi.mock("@gorhom/bottom-sheet", () => ({
  BottomSheetBackdrop: () => null,
}));

function makeSheetMethods() {
  const present = vi.fn();
  const dismiss = vi.fn();
  return { present, dismiss, methods: { present, dismiss } as unknown as BottomSheetModal };
}

describe("useBottomSheetController", () => {
  beforeEach(() => {
    mockAddListener.mockReset();
    mockRemove.mockReset();
    mockKeyboardDismiss.mockReset();
  });

  it("presents when visible flips true and dismisses when it flips false", () => {
    const { present, dismiss, methods } = makeSheetMethods();
    const { result, rerender } = renderHook(
      ({ visible }) => useBottomSheetController({ visible }),
      { initialProps: { visible: false } },
    );
    result.current.sheetRef.current = methods;

    rerender({ visible: true });
    expect(present).toHaveBeenCalledTimes(1);

    rerender({ visible: false });
    expect(dismiss).toHaveBeenCalledTimes(1);
  });

  it("dismisses the keyboard on present only when dismissKeyboardOnPresent is set", () => {
    const { methods } = makeSheetMethods();
    const { result, rerender } = renderHook(
      ({ visible }) => useBottomSheetController({ visible, dismissKeyboardOnPresent: true }),
      { initialProps: { visible: false } },
    );
    result.current.sheetRef.current = methods;

    expect(mockKeyboardDismiss).not.toHaveBeenCalled();
    rerender({ visible: true });
    expect(mockKeyboardDismiss).toHaveBeenCalledTimes(1);
  });

  it("does not touch the keyboard by default", () => {
    renderHook(() => useBottomSheetController({ visible: true }));
    expect(mockKeyboardDismiss).not.toHaveBeenCalled();
  });

  it("hardware back dismisses the sheet and blocks default while visible", () => {
    const { dismiss, methods } = makeSheetMethods();
    const { result } = renderHook(() => useBottomSheetController({ visible: true }));
    result.current.sheetRef.current = methods;

    expect(mockAddListener.mock.calls[0][0]).toBe("hardwareBackPress");
    const onBackPress = mockAddListener.mock.calls[0][1] as () => boolean;

    expect(onBackPress()).toBe(true);
    expect(dismiss).toHaveBeenCalled();
  });

  it("lets hardware back pass through while hidden", () => {
    renderHook(() => useBottomSheetController({ visible: false }));

    const onBackPress = mockAddListener.mock.calls[0][1] as () => boolean;
    expect(onBackPress()).toBe(false);
  });

  it("removes the back subscription on unmount", () => {
    const { unmount } = renderHook(() => useBottomSheetController({ visible: true }));
    unmount();
    expect(mockRemove).toHaveBeenCalled();
  });

  it("renders the standard backdrop with a stable callback", () => {
    const { result, rerender } = renderHook(
      ({ visible }) => useBottomSheetController({ visible }),
      { initialProps: { visible: false } },
    );
    const firstRenderBackdrop = result.current.renderBackdrop;

    const element = firstRenderBackdrop({ style: { flex: 1 } } as never);
    expect(element.type).toBe(BottomSheetBackdrop);
    expect(element.props.disappearsOnIndex).toBe(-1);
    expect(element.props.appearsOnIndex).toBe(0);
    expect(element.props.style).toEqual({ flex: 1 });

    rerender({ visible: true });
    expect(result.current.renderBackdrop).toBe(firstRenderBackdrop);
  });
});
