"use client";

import { createContext, useContext } from "react";

/**
 * Marks the off-screen shadow row used by `StripOverflowList` for width
 * measurement. Strip components read this to skip side-effectful machinery
 * (popover state, autofocus, controlled open) that would otherwise duplicate
 * across the live + shadow trees.
 */
const StripShadowContext = createContext(false);

export const StripShadowProvider = StripShadowContext.Provider;

export function useIsStripShadow(): boolean {
  return useContext(StripShadowContext);
}
