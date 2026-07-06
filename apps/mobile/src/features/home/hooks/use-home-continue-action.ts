import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useWorkbookFlowStore } from "~/features/measurement-flow/stores/use-workbook-flow-store";

/**
 * Tap-Resume action for the home Continue card: navigate to the flow screen.
 * The workbook flow store is persisted, so nothing else needs to happen —
 * the screen rehydrates the in-progress flow on mount.
 */
export function useHomeContinueAction() {
  const router = useRouter();

  return useCallback(() => {
    const { experimentId } = useWorkbookFlowStore.getState();
    if (!experimentId) return;
    router.push("/measurement-flow");
  }, [router]);
}
