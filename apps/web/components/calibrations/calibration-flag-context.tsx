"use client";

import { createContext, useContext } from "react";
import type { ReactNode } from "react";

/** Off without a provider, as the flag itself is until PostHog targets someone. */
const CalibrationFlagContext = createContext(false);

/**
 * The calibration flag, resolved once on the server per request and handed down, so no
 * calibration surface flickers in while PostHog loads in the browser.
 */
export function CalibrationFlagProvider({
  isEnabled,
  children,
}: {
  isEnabled: boolean;
  children: ReactNode;
}) {
  return (
    <CalibrationFlagContext.Provider value={isEnabled}>{children}</CalibrationFlagContext.Provider>
  );
}

export function useIsCalibrationEnabled(): boolean {
  return useContext(CalibrationFlagContext);
}
