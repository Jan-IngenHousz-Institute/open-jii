import type { BottomSheetModalMethods } from "@gorhom/bottom-sheet/lib/typescript/types";
import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import { BackHandler } from "react-native";

interface UseModalPresentationOptions {
  onPresent?: () => void;
  onDismiss?: () => void;
}

/**
 * Drives a BottomSheetModal's visibility from a boolean prop, and dismisses
 * the sheet on Android hardware back. Replaces the duplicated pair of
 * useEffects that used to live in every recent-measurements modal.
 *
 * Callbacks are read through a ref so the visibility effect doesn't re-run
 * on callback identity change — only on the boolean transition.
 */
export function useModalPresentation(
  visible: boolean,
  ref: RefObject<BottomSheetModalMethods | null>,
  { onPresent, onDismiss }: UseModalPresentationOptions = {},
): void {
  const onPresentRef = useRef(onPresent);
  const onDismissRef = useRef(onDismiss);
  onPresentRef.current = onPresent;
  onDismissRef.current = onDismiss;

  useEffect(() => {
    if (visible) {
      ref.current?.present();
      onPresentRef.current?.();
    } else {
      ref.current?.dismiss();
      onDismissRef.current?.();
    }
  }, [visible, ref]);

  useEffect(() => {
    if (!visible) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      ref.current?.dismiss();
      return true;
    });
    return () => sub.remove();
  }, [visible, ref]);
}
