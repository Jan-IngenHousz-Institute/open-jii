import type { ReactNode } from "react";

interface CalibrationWizardActionsProps {
  /** Steps back or leaves the flow; the left seat, as in every wizard here. */
  secondary?: ReactNode;
  /** Moves the session forward; the right seat. */
  primary?: ReactNode;
}

export function CalibrationWizardActions({ secondary, primary }: CalibrationWizardActionsProps) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <div className="flex flex-wrap gap-2">{secondary}</div>
      <div className="flex flex-wrap gap-2">{primary}</div>
    </div>
  );
}
