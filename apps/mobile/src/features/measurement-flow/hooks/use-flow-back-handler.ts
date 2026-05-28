import React from "react";
import { BackHandler } from "react-native";
import { useExitFlowSheetStore } from "~/features/measurement-flow/stores/use-exit-flow-sheet-store";

// Route Android hardware back through the Exit sheet while a flow is active.
export function useFlowBackHandler(isFocused: boolean, hasActiveFlow: boolean): void {
  const openExitSheet = useExitFlowSheetStore((s) => s.open);
  React.useEffect(() => {
    if (!isFocused) return;
    if (!hasActiveFlow) return;
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      openExitSheet();
      return true;
    });
    return () => sub.remove();
  }, [isFocused, hasActiveFlow, openExitSheet]);
}
