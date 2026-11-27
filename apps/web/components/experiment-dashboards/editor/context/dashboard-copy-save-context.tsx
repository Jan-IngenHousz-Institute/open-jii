"use client";

import { createContext, useContext } from "react";

interface DashboardCopySave {
  enabled: boolean;
  duplicateDisabled: boolean;
  duplicateSelectedChart: () => Promise<void>;
  retryAvailable: boolean;
  openCopyHref?: string;
  retry: () => void;
}

export const DashboardCopySaveContext = createContext<DashboardCopySave | null>(null);

export function useDashboardCopySave() {
  return useContext(DashboardCopySaveContext);
}
