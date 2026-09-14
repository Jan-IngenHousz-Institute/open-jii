import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import type { EntitySnapshots } from "@repo/api/domains/workbook/workbook-version.schema";

interface FlowSnapshotsStore {
  workbookVersionId?: string;
  entitySnapshots?: EntitySnapshots;

  setSnapshots: (workbookVersionId: string, entitySnapshots: EntitySnapshots | undefined) => void;
  clear: () => void;
}

// Protocol/macro code for the active flow, written once when the flow loads
// instead of on every measurement-flow write (that store strips it, see its
// partialize). Resume reads this before the cached workbook-version query, so
// a paused flow comes back offline even after that query is gone (cache buster
// on app update, eviction). Cleared by teardownFlow and the rehydration guard.
export const useFlowSnapshotsStore = create<FlowSnapshotsStore>()(
  persist(
    (set) => ({
      workbookVersionId: undefined,
      entitySnapshots: undefined,

      setSnapshots: (workbookVersionId, entitySnapshots) =>
        set({ workbookVersionId, entitySnapshots }),

      clear: () => set({ workbookVersionId: undefined, entitySnapshots: undefined }),
    }),
    {
      name: "measurement-flow-snapshots-storage",
      storage: createJSONStorage(() => AsyncStorage),
      // v1 wire format, pinned by flow-store-persistence.test.ts.
      version: 1,
      partialize: (state) => ({
        workbookVersionId: state.workbookVersionId,
        entitySnapshots: state.entitySnapshots,
      }),
    },
  ),
);
