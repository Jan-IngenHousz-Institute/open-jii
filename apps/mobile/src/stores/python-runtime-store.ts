import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

export type PythonRuntimeState = "absent" | "installing" | "ready" | "failed";

interface PythonRuntimeStoreState {
  state: PythonRuntimeState;
  progress: number;
  error?: string;
}

interface PythonRuntimeStoreActions {
  setState: (state: PythonRuntimeState) => void;
  setProgress: (progress: number) => void;
  setError: (error?: string) => void;
  reset: () => void;
}

export const usePythonRuntimeStore = create<PythonRuntimeStoreState & PythonRuntimeStoreActions>()(
  persist(
    (set) => ({
      state: "absent",
      progress: 0,
      error: undefined,
      setState: (state) => set({ state }),
      setProgress: (progress) => set({ progress }),
      setError: (error) => set({ error }),
      reset: () => set({ state: "absent", progress: 0, error: undefined }),
    }),
    {
      name: "python-runtime-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // Only the durable readiness flag survives a relaunch. Progress and
      // error are transient and only meaningful during an active install.
      partialize: (s) => ({ state: s.state === "ready" ? "ready" : "absent" }),
    },
  ),
);
