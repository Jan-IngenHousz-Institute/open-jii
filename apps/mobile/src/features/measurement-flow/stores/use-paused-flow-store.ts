import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { FlowNode } from "~/features/measurement-flow/screens/measurement-flow-screen/types";

export interface PausedFlowSnapshot {
  experimentId: string;
  experimentLabel: string;
  protocolId?: string;
  currentFlowStep: number;
  totalSteps: number;
  iterationCount: number;
  isQuestionsSubmitPending: boolean;
  isFromOverview: boolean;
  flowNodes: FlowNode[];
  answersHistory: Record<string, string>[];
  scanResult?: Record<string, unknown>;
  pausedAt: string;
  plotLabel?: string;
}

interface PausedFlowState {
  snapshot: PausedFlowSnapshot | undefined;
}

interface PausedFlowActions {
  pauseFlow: (snapshot: PausedFlowSnapshot) => void;
  discardPausedFlow: () => void;
  /**
   * Returns the current snapshot and clears it atomically.
   * The caller is responsible for re-hydrating the runner store.
   */
  resumePausedFlow: () => PausedFlowSnapshot | undefined;
}

export const usePausedFlowStore = create<PausedFlowState & PausedFlowActions>()(
  persist(
    (set, get) => ({
      snapshot: undefined,

      pauseFlow: (snapshot) => set({ snapshot }),
      discardPausedFlow: () => set({ snapshot: undefined }),
      resumePausedFlow: () => {
        const current = get().snapshot;
        set({ snapshot: undefined });
        return current;
      },
    }),
    {
      name: "paused-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ snapshot: state.snapshot }),
    },
  ),
);

export const useHasPausedFlow = () => usePausedFlowStore((s) => s.snapshot !== undefined);
export const usePausedFlowSnapshot = () => usePausedFlowStore((s) => s.snapshot);
