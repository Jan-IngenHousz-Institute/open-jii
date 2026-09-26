import type { BottomSheetModal } from "@gorhom/bottom-sheet";
import React, { useCallback, useRef } from "react";
import { JoinCodeEntrySheet } from "~/features/experiments/components/join-code-entry-sheet";

/**
 * The sheet is private to this feature and the discover hub that fronts it is
 * not, so the presentable pair crosses the boundary instead of the component.
 */
export function useJoinCodeEntrySheet() {
  const ref = useRef<BottomSheetModal>(null);

  const open = useCallback(() => {
    ref.current?.present();
  }, []);

  return { open, sheet: <JoinCodeEntrySheet ref={ref} /> };
}
