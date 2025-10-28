import { camelCase } from "lodash";
import { create } from "zustand";

interface FlowAnswersStore {
  answersHistory: Record<string, string>[];

  // Set an answer for a specific cycle and question
  setAnswer: (cycle: number, name: string, value: string) => void;

  // Clear all answers history
  clearHistory: () => void;

  // Get a specific answer for a cycle and question
  getAnswer: (cycle: number, name: string) => string | undefined;

  // Get answers for a specific cycle
  getCycleAnswers: (cycle: number) => Record<string, string> | undefined;

  // Get all answers for a specific question across all cycles
  getQuestionAnswers: (name: string) => string[];
}

export const useFlowAnswersStore = create<FlowAnswersStore>((set, get) => ({
  answersHistory: [],

  setAnswer: (cycle: number, name: string, value: string) => {
    set((state) => {
      const newHistory = [...state.answersHistory];

      // Ensure we have enough cycles in the array
      while (newHistory.length <= cycle) {
        newHistory.push({});
      }

      // Set the answer for the specific cycle and question
      newHistory[cycle] = {
        ...newHistory[cycle],
        [camelCase(name)]: value,
      };

      return { answersHistory: newHistory };
    });
  },

  clearHistory: () => {
    set({ answersHistory: [] });
  },

  getAnswer: (cycle: number, name: string) => {
    const state = get();
    return state.answersHistory[cycle]?.[camelCase(name)];
  },

  getCycleAnswers: (cycle: number) => {
    const state = get();
    return state.answersHistory[cycle];
  },

  getQuestionAnswers: (name: string) => {
    const state = get();
    return state.answersHistory
      .map((cycleAnswers) => cycleAnswers[name])
      .filter((answer): answer is string => answer !== undefined);
  },
}));
