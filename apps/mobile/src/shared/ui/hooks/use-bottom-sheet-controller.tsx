import { BottomSheetBackdrop } from "@gorhom/bottom-sheet";
import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import React, { useCallback, useEffect, useRef } from "react";
import { BackHandler, Keyboard } from "react-native";

interface UseBottomSheetControllerOptions {
  visible: boolean;
  /** Dismiss the keyboard before presenting, for sheets opened over a focused input. */
  dismissKeyboardOnPresent?: boolean;
}

/**
 * Shared BottomSheetModal lifecycle: drives present/dismiss from a boolean,
 * dismisses on Android hardware back while visible, and provides the
 * standard backdrop. Snap points, content and onDismiss stay per-modal.
 */
export function useBottomSheetController({
  visible,
  dismissKeyboardOnPresent = false,
}: UseBottomSheetControllerOptions) {
  const sheetRef = useRef<BottomSheetModal>(null);

  useEffect(() => {
    if (visible) {
      if (dismissKeyboardOnPresent) Keyboard.dismiss();
      sheetRef.current?.present();
    } else {
      sheetRef.current?.dismiss();
    }
  }, [visible, dismissKeyboardOnPresent]);

  useEffect(() => {
    const onBackPress = () => {
      if (visible) {
        sheetRef.current?.dismiss();
        return true; // prevent default navigation
      }
      return false;
    };

    const subscription = BackHandler.addEventListener("hardwareBackPress", onBackPress);
    return () => subscription.remove();
  }, [visible]);

  const renderBackdrop = useCallback(
    (props: React.ComponentProps<typeof BottomSheetBackdrop>) => (
      <BottomSheetBackdrop {...props} disappearsOnIndex={-1} appearsOnIndex={0} />
    ),
    [],
  );

  return { sheetRef, renderBackdrop };
}
