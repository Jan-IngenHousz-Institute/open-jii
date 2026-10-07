import { CalibrationGate } from "@/components/calibrations/calibration-gate";
import type { ReactNode } from "react";

export default function CalibrationsLayout({ children }: { children: ReactNode }) {
  return <CalibrationGate>{children}</CalibrationGate>;
}
