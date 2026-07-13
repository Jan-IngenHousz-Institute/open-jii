"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * Lets command/macro cells signal that they persisted an entity-code edit, so a
 * host can react (the experiment design page re-pins the experiment to a fresh
 * version on every save, OJD-1626). Command/macro code saves go straight to the
 * entity via `useCommandUpdate`/`useMacroUpdate` and never touch the workbook
 * `cells` array, so they bypass the cells-autosave `onSaved` path. Defaults to a
 * no-op, so the standalone workbook page (no provider) simply does nothing.
 */
const WorkbookEntitySavedContext = createContext<() => void>(() => undefined);

export function WorkbookEntitySavedProvider({
  onEntitySaved,
  children,
}: {
  onEntitySaved: () => void;
  children: ReactNode;
}) {
  return (
    <WorkbookEntitySavedContext.Provider value={onEntitySaved}>
      {children}
    </WorkbookEntitySavedContext.Provider>
  );
}

export function useWorkbookEntitySaved(): () => void {
  return useContext(WorkbookEntitySavedContext);
}
