import { useFocusEffect } from "expo-router";
import React from "react";
import { BackHandler } from "react-native";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";

// Route Android hardware back through the Exit sheet while a flow is active.
// useFocusEffect handles register-on-focus / unregister-on-blur.
export function useFlowBackHandler(hasActiveFlow: boolean): void {
  useFocusEffect(
    React.useCallback(() => {
      if (!hasActiveFlow) return;
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        useExitFlowSheetStore.getState().open();
        return true;
      });
      return () => sub.remove();
    }, [hasActiveFlow]),
  );
}
