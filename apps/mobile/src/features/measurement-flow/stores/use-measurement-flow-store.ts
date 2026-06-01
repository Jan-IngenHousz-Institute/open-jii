import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import {
  FlowNode,
  isQuestionsOnlyFlow,
} from "~/features/measurement-flow/screens/measurement-flow-screen/types";

interface MeasurementFlowStore {
  experimentId?: string;
  experimentLabel?: string;
  protocolId?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number;
  iterationCount: number;
  isFlowFinished: boolean;
  isQuestionsSubmitPending: boolean;
  scanResult?: any;
  isFromOverview: boolean;

  setExperimentId: (experimentId: string, experimentLabel?: string) => void;
  setProtocolId: (protocolId: string) => void;
  setCurrentStep: (step: number) => void;
  setCurrentFlowStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;

  setFlowNodes: (nodes: FlowNode[]) => void;
  resetFlow: () => void;
  retryCurrentIteration: () => void;
  finishFlow: () => void;
  setScanResult: (result: any) => void;
  dismissQuestionsSubmit: () => void;
  navigateToQuestionFromOverview: (questionIndex: number) => void;
  returnToOverview: () => void;
}

// The store is persisted so a mid-flow blur (background, kill, tab switch)
// is itself the "pause": the next launch rehydrates the same active flow
// and the home screen renders the resume card based on whether experimentId
// is set. No separate snapshot store needed.
export const useMeasurementFlowStore = create<MeasurementFlowStore>()(
  persist(
    (set, get) => ({
      experimentId: undefined,
      experimentLabel: undefined,
      protocolId: undefined,
      currentStep: 0,
      flowNodes: [],
      currentFlowStep: 0,
      iterationCount: 0,
      isFlowFinished: false,
      isQuestionsSubmitPending: false,
      scanResult: undefined,
      isFromOverview: false,

      setExperimentId: (experimentId, experimentLabel) => set({ experimentId, experimentLabel }),
      setProtocolId: (protocolId) => set({ protocolId }),

      setCurrentStep: (step) => set({ currentStep: step }),
      setCurrentFlowStep: (step) => set({ currentFlowStep: step }),

      nextStep: () =>
        set((state) => {
          if (state.isFromOverview) {
            return {
              currentFlowStep: state.flowNodes.findIndex((n) => n.type === "measurement"),
              isFromOverview: false,
            };
          }
          if (state.experimentId && state.flowNodes.length > 0) {
            const nextFlowStep = state.currentFlowStep + 1;
            const isCompleted = nextFlowStep >= state.flowNodes.length;
            if (isCompleted) {
              if (isQuestionsOnlyFlow(state.flowNodes)) {
                return {
                  isQuestionsSubmitPending: true,
                  currentFlowStep: state.flowNodes.length,
                };
              }
              return {
                currentFlowStep: 0,
                iterationCount: state.iterationCount + 1,
              };
            }
            return { currentFlowStep: nextFlowStep };
          }
          return { currentStep: state.currentStep + 1 };
        }),

      previousStep: () =>
        set((state) => {
          if (state.isFromOverview) {
            return {
              currentFlowStep: state.flowNodes.findIndex((n) => n.type === "measurement"),
              isFromOverview: false,
            };
          }
          if (state.experimentId && state.flowNodes.length > 0) {
            if (state.isQuestionsSubmitPending) {
              return {
                isQuestionsSubmitPending: false,
                currentFlowStep: state.flowNodes.length - 1,
              };
            }
            if (state.currentFlowStep > 0) {
              return { currentFlowStep: state.currentFlowStep - 1 };
            } else {
              return {
                experimentId: undefined,
                experimentLabel: undefined,
                currentStep: 0,
                flowNodes: [],
                currentFlowStep: 0,
                iterationCount: 0,
                isFlowFinished: false,
                isQuestionsSubmitPending: false,
                scanResult: undefined,
                protocolId: undefined,
              };
            }
          }
          return { currentStep: Math.max(0, state.currentStep - 1) };
        }),

      // Route through resetFlow so the persisted slice (flowNodes,
      // currentFlowStep, iterationCount, scanResult, …) is cleared too.
      reset: () => get().resetFlow(),

      setFlowNodes: (nodes) => set({ flowNodes: nodes, currentFlowStep: 0 }),

      resetFlow: () =>
        set({
          experimentId: undefined,
          experimentLabel: undefined,
          currentStep: 0,
          flowNodes: [],
          currentFlowStep: 0,
          iterationCount: 0,
          isFlowFinished: false,
          isQuestionsSubmitPending: false,
          scanResult: undefined,
          protocolId: undefined,
          isFromOverview: false,
        }),

      retryCurrentIteration: () =>
        set(() => ({
          currentFlowStep: 0,
          isQuestionsSubmitPending: false,
          scanResult: undefined,
          isFromOverview: false,
        })),

      finishFlow: () =>
        set((state) => ({
          currentFlowStep: state.flowNodes.length,
          isFlowFinished: true,
          isQuestionsSubmitPending: false,
          isFromOverview: false,
        })),

      setScanResult: (result) => set({ scanResult: result }),

      dismissQuestionsSubmit: () =>
        set((state) => ({
          isQuestionsSubmitPending: false,
          currentFlowStep: 0,
          iterationCount: state.iterationCount + 1,
          scanResult: undefined,
        })),

      navigateToQuestionFromOverview: (questionIndex) =>
        set({
          currentFlowStep: questionIndex,
          isFromOverview: true,
          isQuestionsSubmitPending: false,
        }),

      returnToOverview: () =>
        set((state) => {
          if (isQuestionsOnlyFlow(state.flowNodes)) {
            return {
              isQuestionsSubmitPending: true,
              isFromOverview: false,
            };
          }
          return {
            currentFlowStep: state.flowNodes.findIndex((n) => n.type === "measurement"),
            isFromOverview: false,
          };
        }),
    }),
    {
      name: "measurement-flow-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        experimentId: state.experimentId,
        experimentLabel: state.experimentLabel,
        protocolId: state.protocolId,
        currentStep: state.currentStep,
        flowNodes: state.flowNodes,
        currentFlowStep: state.currentFlowStep,
        iterationCount: state.iterationCount,
        isFlowFinished: state.isFlowFinished,
        isQuestionsSubmitPending: state.isQuestionsSubmitPending,
        scanResult: state.scanResult,
        isFromOverview: state.isFromOverview,
      }),
    },
  ),
);
