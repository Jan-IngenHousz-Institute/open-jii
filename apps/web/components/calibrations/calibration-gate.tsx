"use client";

import { notFound } from "next/navigation";
import type { ReactNode } from "react";

import { useIsCalibrationEnabled } from "./calibration-flag-context";

/** Not found rather than forbidden: while the flag is off, calibration is not a page that exists. */
export function CalibrationGate({ children }: { children: ReactNode }) {
  const isEnabled = useIsCalibrationEnabled();
  if (!isEnabled) {
    notFound();
  }

  return children;
}
