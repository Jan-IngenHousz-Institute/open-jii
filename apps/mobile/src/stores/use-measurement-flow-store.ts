import { create } from "zustand";
import { FlowNode, isQuestionsOnlyFlow } from "~/screens/measurement-flow-screen/types";

interface MeasurementFlowStore {
  experimentId?: string;
  protocolId?: string;
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number; // Current step within the flow (0-4 for 5 steps)
  iterationCount: number; // Number of completed iterations
  isFlowFinished: boolean; // True when user explicitly finishes the flow
  isQuestionsSubmitPending: boolean; // True when a questions-only iteration is awaiting upload
  scanResult?: any; // Store the scan result from measurement step
  isFromOverview: boolean; // True when navigated to a question node from the ready-state overview

  // Navigation
  setExperimentId: (experimentId: string) => void;
  setProtocolId: (protocolId: string) => void;
  setCurrentStep: (step: number) => void;
  setCurrentFlowStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;

  // Flow orchestration
  setFlowNodes: (nodes: FlowNode[]) => void;
  resetFlow: () => void;
  startNewIteration: () => void;
  retryCurrentIteration: () => void;
  finishFlow: () => void;
  setScanResult: (result: any) => void;
  dismissQuestionsSubmit: () => void;
  navigateToQuestionFromOverview: (questionIndex: number) => void;
  returnToOverview: () => void;
}

export const useMeasurementFlowStore = create<MeasurementFlowStore>((set) => ({
  experimentId: undefined,
  protocolId: undefined,
  currentStep: 0,
  flowNodes: [],
  currentFlowStep: 0,
  iterationCount: 0,
  isFlowFinished: false,
  isQuestionsSubmitPending: false,
  scanResult: undefined,
  isFromOverview: false,

  // Experiment selection
  setExperimentId: (experimentId) => set({ experimentId }),
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
            // Pause for the user to review and upload answers before starting the next iteration
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
        return {
          currentFlowStep: nextFlowStep,
        };
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
          // Go back to the last question from the submit screen
          return {
            isQuestionsSubmitPending: false,
            currentFlowStep: state.flowNodes.length - 1,
          };
        }
        if (state.currentFlowStep > 0) {
          // Go back within the flow
          return { currentFlowStep: state.currentFlowStep - 1 };
        } else {
          // At first step of flow, go back to experiment selection
          return {
            experimentId: undefined,
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

  reset: () =>
    set({
      experimentId: undefined,
      protocolId: undefined,
      currentStep: 0,
      isFromOverview: false,
    }),

  // Flow orchestration
  setFlowNodes: (nodes) => set({ flowNodes: nodes, currentFlowStep: 0 }),

  resetFlow: () =>
    set({
      experimentId: undefined,
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

  startNewIteration: () =>
    set((state) => ({
      currentFlowStep: 0,
      iterationCount: state.iterationCount + 1,
      isQuestionsSubmitPending: false,
      scanResult: undefined,
      isFromOverview: false,
    })),

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
        // No measurement node to jump to — return to the submit/review screen
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
}));
