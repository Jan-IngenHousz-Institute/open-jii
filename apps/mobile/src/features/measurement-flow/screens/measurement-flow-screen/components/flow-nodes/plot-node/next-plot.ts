import { create } from "zustand";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

export interface NextPlot {
  identifier: string;
  rowLabel: string;
  column: number;
  treatment: string;
  block: string;
  genotype: string;
}

const EXAMPLE_NEXT_PLOT: NextPlot = {
  identifier: "C4",
  rowLabel: "C",
  column: 4,
  treatment: "Drought",
  block: "2",
  genotype: "Line A",
};

/**
 * The plot the measurer should walk to next. On this scaffold an example plot stands in for the
 * layout route, behind EXPO_PUBLIC_SCAFFOLD_EXAMPLE_LAYOUT, so the step can be photographed.
 */
export function useNextPlot(): NextPlot | undefined {
  const isScaffoldLayoutOn = process.env.EXPO_PUBLIC_SCAFFOLD_EXAMPLE_LAYOUT === "true";
  return isScaffoldLayoutOn ? EXAMPLE_NEXT_PLOT : undefined;
}

interface PlotStepState {
  confirmedRound: number | null;
  confirm: (round: number) => void;
}

export const usePlotStepStore = create<PlotStepState>((set) => ({
  confirmedRound: null,
  confirm: (round) => set({ confirmedRound: round }),
}));

/** The plot step opens every round of an experiment with a layout, until the plot is confirmed. */
export function useIsPlotStepShowing(): boolean {
  const nextPlot = useNextPlot();
  const isFirstStep = useMeasurementFlowStore(
    (s) => s.currentFlowStep === 0 && s.flowNodes.length > 0,
  );
  const round = useMeasurementFlowStore((s) => s.iterationCount);
  const confirmedRound = usePlotStepStore((s) => s.confirmedRound);

  return nextPlot !== undefined && isFirstStep && confirmedRound !== round;
}
