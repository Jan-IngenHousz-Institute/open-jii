"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/**
 * Lets protocol/macro cells signal that they persisted an entity-code edit, so a
 * host can react (the experiment design page re-pins the experiment to a fresh
 * version on every save, OJD-1626). Protocol/macro code saves go straight to the
 * entity via `useProtocolUpdate`/`useMacroUpdate` and never touch the workbook
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

/**
 * Signals that an executable entity (protocol/macro code, language, or fork)
 * was EDITED, before any debounced persistence. The execution host uses it to
 * invalidate runtime freshness immediately, so a stale command cannot resolve
 * against a producer whose code just changed. Distinct from the saved signal
 * above, which fires only after persistence. Defaults to a no-op.
 */
const WorkbookExecutableEditContext = createContext<() => void>(() => undefined);

export function WorkbookExecutableEditProvider({
  onExecutableEdit,
  children,
}: {
  onExecutableEdit: () => void;
  children: ReactNode;
}) {
  return (
    <WorkbookExecutableEditContext.Provider value={onExecutableEdit}>
      {children}
    </WorkbookExecutableEditContext.Provider>
  );
}

export function useWorkbookExecutableEdit(): () => void {
  return useContext(WorkbookExecutableEditContext);
}
