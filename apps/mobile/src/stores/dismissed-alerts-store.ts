import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

interface DismissedAlertsState {
  dismissedIds: string[];
  dismiss: (id: string) => void;
}

export const useDismissedAlertsStore = create<DismissedAlertsState>()(
  persist(
    (set) => ({
      dismissedIds: [],
      dismiss: (id) =>
        set((state) => ({
          dismissedIds: state.dismissedIds.includes(id)
            ? state.dismissedIds
            : [...state.dismissedIds, id],
        })),
    }),
    {
      name: "alert-dismissed-ids",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
