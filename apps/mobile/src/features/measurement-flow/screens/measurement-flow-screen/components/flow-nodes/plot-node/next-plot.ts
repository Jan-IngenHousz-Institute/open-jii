import { create } from "zustand";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

export type Treatment = "Control" | "Drought" | "Severe drought";

export interface NextPlot {
  id: string;
  identifier: string;
  row: number;
  rowLabel: string;
  column: number;
  treatment: Treatment;
  block: string;
  genotype: string;
}

export interface ExampleField {
  rows: number;
  columns: number;
  plots: NextPlot[];
}

export type SharePlotState = "current" | "done" | "skipped" | "toDo" | "otherShare";

/** A walking order, read at the plot the measurer stands at. */
export class ExampleWalk {
  constructor(
    readonly order: string[],
    readonly current: string,
  ) {}

  /** 1-based place of the current plot in the walk. */
  get position(): number {
    return this.order.indexOf(this.current) + 1;
  }

  get total(): number {
    return this.order.length;
  }

  after(count: number): string[] {
    return this.order.slice(this.position, this.position + count);
  }
}

/** One measurer's share of the field, walked up to the current plot. */
export class ShareProgress {
  readonly walk: ExampleWalk;

  constructor(
    sharePlots: string[],
    current: string,
    readonly skipped: string[],
    readonly otherMeasurer: string,
  ) {
    this.walk = new ExampleWalk(sharePlots, current);
  }

  get done(): string[] {
    return this.walk.order
      .slice(0, this.walk.position - 1)
      .filter((identifier) => !this.skipped.includes(identifier));
  }

  /** The current plot and every plot after it. */
  get toDo(): string[] {
    return this.walk.order.slice(this.walk.position - 1);
  }

  stateOf(identifier: string): SharePlotState {
    if (identifier === this.walk.current) {
      return "current";
    }
    if (this.skipped.includes(identifier)) {
      return "skipped";
    }
    if (this.done.includes(identifier)) {
      return "done";
    }
    if (this.walk.order.includes(identifier)) {
      return "toDo";
    }
    return "otherShare";
  }
}

export interface ExampleLayout {
  field: ExampleField;
  namedPlot: NextPlot;
  /** Plots measured this session: every plot before the named one in layout order. */
  measured: string[];
  walk: ExampleWalk;
  share: ShareProgress;
}

const FIELD_ROWS = 6;
const FIELD_COLUMNS = 8;
const FIELD_GAPS = new Set(["B4", "E7"]);
const TREATMENTS: Treatment[] = ["Control", "Drought", "Severe drought"];
const NAMED_PLOT = "C4";

// The same treatment-balanced walk the web screens show: any 12 plots in a row hold each
// treatment 4 times, give or take one. C4 is 12th and B6 13th.
// prettier-ignore
const EXAMPLE_WALK = [
  "F8", "E8", "D8", "C8", "B7", "C7", "C6", "C5", "B5", "A4", "A5", "C4",
  "B6", "D2", "D3", "C3", "D6", "D7", "E6", "F7", "F6", "F5", "E5", "D5",
  "D4", "E4", "F4", "F3", "E3", "E2", "F2", "F1", "E1", "D1", "C1", "C2",
  "B1", "A1", "B2", "A2", "A3", "B3", "A6", "A7", "A8", "B8",
];

// The measurer's share is the first half of the walk; the second measurer holds the rest.
const SHARE_SIZE = 23;
const SKIPPED_PLOTS = ["A4"];
const OTHER_MEASURER = "Alex Example";

function buildExampleField(): ExampleField {
  const plots: NextPlot[] = [];

  for (let row = 1; row <= FIELD_ROWS; row++) {
    const rowLabel = String.fromCharCode(64 + row);

    for (let column = 1; column <= FIELD_COLUMNS; column++) {
      const identifier = `${rowLabel}${column}`;
      if (FIELD_GAPS.has(identifier)) {
        continue;
      }

      plots.push({
        id: `00000000-0000-4000-8000-${String(plots.length + 1).padStart(12, "0")}`,
        identifier,
        row,
        rowLabel,
        column,
        treatment: TREATMENTS[(row + column) % 3],
        block: String(Math.ceil(row / 2)),
        genotype: column <= 4 ? "Line A" : "Line B",
      });
    }
  }

  return { rows: FIELD_ROWS, columns: FIELD_COLUMNS, plots };
}

function buildExampleLayout(): ExampleLayout {
  const field = buildExampleField();
  const namedIndex = field.plots.findIndex((plot) => plot.identifier === NAMED_PLOT);
  const namedPlot = field.plots[namedIndex];
  if (!namedPlot) {
    throw new Error(`The example field has no plot ${NAMED_PLOT}`);
  }

  return {
    field,
    namedPlot,
    measured: field.plots.slice(0, namedIndex).map((plot) => plot.identifier),
    walk: new ExampleWalk(EXAMPLE_WALK, NAMED_PLOT),
    share: new ShareProgress(
      EXAMPLE_WALK.slice(0, SHARE_SIZE),
      NAMED_PLOT,
      SKIPPED_PLOTS,
      OTHER_MEASURER,
    ),
  };
}

/**
 * The example field the step walks. On this scaffold it stands in for the layout route, behind
 * EXPO_PUBLIC_SCAFFOLD_EXAMPLE_LAYOUT, so the step can be photographed.
 */
export const exampleLayout: ExampleLayout | undefined =
  process.env.EXPO_PUBLIC_SCAFFOLD_EXAMPLE_LAYOUT === "true" ? buildExampleLayout() : undefined;

export function useExampleLayout(): ExampleLayout | undefined {
  return exampleLayout;
}

/** The plot the measurer should walk to next. */
export function useNextPlot(): NextPlot | undefined {
  return exampleLayout?.namedPlot;
}

interface PlotStepState {
  confirmedRound: number | null;
  confirmedPlot: NextPlot | null;
  isPickerOpen: boolean;
  /** Scaffold flag: a plot drawn pressed on the picker, since a press cannot be held for a capture. */
  heldPlot: string | null;
  isSkipSheetOpen: boolean;
  isFieldGridOpen: boolean;
  /** Scaffold counter for Measure again, until readings carry an ordinal. */
  repeat: number;
}

interface PlotStepActions {
  confirm: (round: number, plot: NextPlot) => void;
  openPicker: () => void;
  closePicker: () => void;
  holdPlot: (identifier: string) => void;
  openSkipSheet: () => void;
  closeSkipSheet: () => void;
  openFieldGrid: () => void;
  closeFieldGrid: () => void;
  measureAgain: () => void;
  reset: () => void;
}

const initialPlotStepState: PlotStepState = {
  confirmedRound: null,
  confirmedPlot: null,
  isPickerOpen: false,
  heldPlot: null,
  isSkipSheetOpen: false,
  isFieldGridOpen: false,
  repeat: 1,
};

export const usePlotStepStore = create<PlotStepState & PlotStepActions>((set) => ({
  ...initialPlotStepState,
  confirm: (round, plot) =>
    set({
      confirmedRound: round,
      confirmedPlot: plot,
      isPickerOpen: false,
      heldPlot: null,
      repeat: 1,
    }),
  openPicker: () => set({ isPickerOpen: true }),
  closePicker: () => set({ isPickerOpen: false, heldPlot: null }),
  holdPlot: (identifier) => set({ heldPlot: identifier }),
  openSkipSheet: () => set({ isSkipSheetOpen: true }),
  closeSkipSheet: () => set({ isSkipSheetOpen: false }),
  openFieldGrid: () => set({ isFieldGridOpen: true }),
  closeFieldGrid: () => set({ isFieldGridOpen: false }),
  measureAgain: () => set((state) => ({ repeat: state.repeat + 1 })),
  reset: () => set(initialPlotStepState),
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
