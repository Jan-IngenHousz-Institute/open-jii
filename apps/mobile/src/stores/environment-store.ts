import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { env } from "~/env";

interface EnvironmentStoreState {
  environment?: string;
  isLoaded: boolean;
}

interface EnvironmentStoreActions {
  setEnvironment: (environment?: string) => void;
  clearEnvironment: () => void;
}

export const useEnvironmentStore = create<EnvironmentStoreState & EnvironmentStoreActions>()(
  persist(
    (set) => ({
      environment: undefined,
      isLoaded: false,
      setEnvironment: (environment) => set({ environment }),
      clearEnvironment: () => set({ environment: undefined }),
    }),
    {
      name: "environment-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => {
        return () => {
          const state = useEnvironmentStore.getState();
          if (!state.environment) {
            useEnvironmentStore.setState({ environment: "dev" });
          }
          useEnvironmentStore.setState({ isLoaded: true });
        };
      },
    },
  ),
);

export function getEnvName() {
  const current = useEnvironmentStore.getState().environment as keyof typeof env;
  return current ?? "dev";
}

export function getEnvVar<K extends keyof (typeof env)[keyof typeof env]>(
  key: K,
  isRequired = true,
) {
  const current = getEnvName();
  const value = env[current][key];
  if (value === undefined && isRequired) {
    throw new Error("Env variable " + key + " is required");
  }

  return value;
}
