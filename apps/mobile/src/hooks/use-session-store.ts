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

const SESSION_TOKEN_OVERRIDE = process.env.SESSION_TOKEN_OVERRIDE;

export const useSessionStore = create<State & Actions>()(
  persist(
    (set) => {
      const store: State & Actions = {
        isLoaded: false,
        setSession: (session) => set({ session }),
        clearSession: () => set({ session: undefined }),
      };

      return store;
    },
    {
      name: "session-storage",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => {
        return () => {
          if (SESSION_TOKEN_OVERRIDE) {
            useSessionStore.setState({
              isLoaded: true,
            });
          } else {
            useSessionStore.setState({ isLoaded: true });
          }
        };
      },
    },
  ),
);
