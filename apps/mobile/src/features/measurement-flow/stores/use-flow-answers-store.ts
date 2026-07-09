import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface FlowAnswersStore {
  answersHistory: Record<string, string>[];
  autoincrementSettings: Record<string, boolean>;
  rememberAnswerSettings: Record<string, boolean>;

  setAnswer: (cycle: number, name: string, value: string) => void;
  clearHistory: () => void;
  getAnswer: (cycle: number, name: string) => string | undefined;
  getCycleAnswers: (cycle: number) => Record<string, string> | undefined;
  setAutoincrement: (name: string, enabled: boolean) => void;
  isAutoincrementEnabled: (name: string) => boolean;
  setRememberAnswer: (name: string, enabled: boolean) => void;
  isRememberAnswerEnabled: (name: string) => boolean;
}

const EMPTY_ANSWERS: Pick<
  FlowAnswersStore,
  "answersHistory" | "autoincrementSettings" | "rememberAnswerSettings"
> = {
  answersHistory: [],
  autoincrementSettings: {},
  rememberAnswerSettings: {},
};

// Persisted alongside useMeasurementFlowStore: a paused flow needs its
// answers to come back on resume after a kill/background.
export const useFlowAnswersStore = create<FlowAnswersStore>()(
  persist(
    (set, get) => ({
      ...EMPTY_ANSWERS,

      setAnswer: (cycle: number, name: string, value: string) => {
        set((state) => {
          const newHistory = [...state.answersHistory];
          while (newHistory.length <= cycle) {
            newHistory.push({});
          }
          const cycleAnswers = { ...newHistory[cycle] };
          if (value.trim() === "") {
            delete cycleAnswers[name];
          } else {
            cycleAnswers[name] = value;
          }
          newHistory[cycle] = cycleAnswers;
          return { answersHistory: newHistory };
        });
      },

      clearHistory: () => {
        set(EMPTY_ANSWERS);
      },

      getAnswer: (cycle, name) => get().answersHistory[cycle]?.[name],
      getCycleAnswers: (cycle) => get().answersHistory[cycle],

      setAutoincrement: (name, enabled) =>
        set((state) => ({
          autoincrementSettings: { ...state.autoincrementSettings, [name]: enabled },
        })),
      isAutoincrementEnabled: (name) => get().autoincrementSettings[name] ?? false,

      setRememberAnswer: (name, enabled) =>
        set((state) => ({
          rememberAnswerSettings: { ...state.rememberAnswerSettings, [name]: enabled },
        })),
      isRememberAnswerEnabled: (name) => get().rememberAnswerSettings[name] ?? false,
    }),
    {
      name: "flow-answers-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v1 wire format, pinned by flow-store-persistence.test.ts. Bumped in
      // tandem with the flow store so a pre-fix (v0) answer history is
      // discarded on upgrade instead of resuming against a reset flow.
      version: 1,
      migrate: (persisted, version) =>
        (version < 1 || !persisted ? EMPTY_ANSWERS : persisted) as FlowAnswersStore,
      partialize: (state) => ({
        answersHistory: state.answersHistory,
        autoincrementSettings: state.autoincrementSettings,
        rememberAnswerSettings: state.rememberAnswerSettings,
      }),
    },
  ),
);
