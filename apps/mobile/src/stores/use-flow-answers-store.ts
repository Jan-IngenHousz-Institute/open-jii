import { camelCase } from "lodash";
import { create } from "zustand";

interface FlowAnswersStore {
  answersHistory: Record<string, string>[];
  autoincrementSettings: Record<string, boolean>;

  // Set an answer for a specific cycle and question
  setAnswer: (cycle: number, name: string, value: string) => void;

  // Clear all answers history
  clearHistory: () => void;

  // Get a specific answer for a cycle and question
  getAnswer: (cycle: number, name: string) => string | undefined;

  // Get answers for a specific cycle
  getCycleAnswers: (cycle: number) => Record<string, string> | undefined;

  // Set autoincrement setting for a variable
  setAutoincrement: (name: string, enabled: boolean) => void;

  // Check if autoincrement is enabled for a variable
  isAutoincrementEnabled: (name: string) => boolean;
}

export const useFlowAnswersStore = create<FlowAnswersStore>((set, get) => ({
  answersHistory: [],
  autoincrementSettings: {},

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
    set({ answersHistory: [], autoincrementSettings: {} });
  },

  getAnswer: (cycle: number, name: string) => {
    const state = get();
    return state.answersHistory[cycle]?.[camelCase(name)];
  },

  getCycleAnswers: (cycle: number) => {
    const state = get();
    return state.answersHistory[cycle];
  },

  setAutoincrement: (name: string, enabled: boolean) => {
    set((state) => ({
      autoincrementSettings: {
        ...state.autoincrementSettings,
        [camelCase(name)]: enabled,
      },
    }));
  },

  isAutoincrementEnabled: (name: string) => {
    const state = get();
    return state.autoincrementSettings[camelCase(name)] ?? false;
  },
}));
