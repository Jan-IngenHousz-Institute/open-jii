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

const mockSession: Session | undefined = SESSION_TOKEN_OVERRIDE
  ? {
      token: SESSION_TOKEN_OVERRIDE,
      data: {
        user: {
          id: "override-user-id",
          name: "Override User",
          email: "override@example.com",
          image: "https://example.com/override-avatar.png",
        },
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(), // expires in 24h
      },
    }
  : undefined;

export const useSessionStore = create<State & Actions>()(
  persist(
    (set) => {
      const store: State & Actions = {
        session: mockSession,
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
              session: mockSession,
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
