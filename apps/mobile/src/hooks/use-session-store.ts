import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { UserSessionData } from "~/api/get-session-data";

interface Session {
  token: string;
  data: UserSessionData;
}

interface State {
  session?: Session;
  isLoaded: boolean;
}

interface Actions {
  setSession: (session: Session) => void;
  clearSession: () => void;
}

export const useSessionStore = create<State & Actions>()(
  persist(
    (set) => {
      const store: State & Actions = {
        session: undefined,
        isLoaded: false,
        setSession: (session) => set({ session }),
        clearSession: () => set({ session: undefined }),
      };

      return store;
    },
    {
      name: "session-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // This function returns a hydration callback
      onRehydrateStorage: () => {
        return () => {
          useSessionStore.setState({ isLoaded: true });
        };
      },
    },
  ),
);
