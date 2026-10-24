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

export type PlotState = "measured" | "skipped" | "toMeasure";

export type SkipReason = "plantMissing" | "flooded" | "couldNotReach" | "other";

export interface SkippedPlot {
  identifier: string;
  reason: SkipReason;
  skippedAt: string;
}

const SESSION_START_MINUTES = 8 * 60 + 30;
const MINUTES_PER_PLOT = 2;

function clockTime(minutes: number): string {
  const hours = String(Math.floor(minutes / 60)).padStart(2, "0");
  return `${hours}:${String(minutes % 60).padStart(2, "0")}`;
}

/** What the phone itself knows about one session: which plots it measured and skipped. */
export class LayoutSession {
  constructor(
    readonly total: number,
    readonly measured: string[],
    readonly skipped: SkippedPlot[],
  ) {}

  stateOf(identifier: string): PlotState {
    if (this.measured.includes(identifier)) {
      return "measured";
    }
    if (this.skipped.some((plot) => plot.identifier === identifier)) {
      return "skipped";
    }
    return "toMeasure";
  }

  /** When a plot's reading was saved, one plot every two minutes from 08:30. */
  measuredAt(identifier: string): string {
    return clockTime(SESSION_START_MINUTES + this.measured.indexOf(identifier) * MINUTES_PER_PLOT);
  }
}

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

  isInShare(identifier: string): boolean {
    return this.walk.order.includes(identifier);
  }
}

/** A second phone that started a session on the same field today, as of the last sync. */
export interface OtherPhoneSession {
  measurer: string;
  startedAt: string;
}

export interface ExampleLayout {
  field: ExampleField;
  namedPlot: NextPlot;
  /** The plot the example skips, A4, as the step names it before the skip. */
  skippedPlot: NextPlot;
  /** Layout order at A4: A1 to A3 measured and nothing skipped yet. */
  sessionAtSkippedPlot: LayoutSession;
  /** Layout order before any walking order: every plot before C4 measured. */
  session: LayoutSession;
  /** The same session with A4 skipped and waiting on the come-back-later list. */
  sessionWithSkip: LayoutSession;
  share: ShareProgress;
  shareSession: LayoutSession;
  otherPhone: OtherPhoneSession;
}

const FIELD_ROWS = 6;
const FIELD_COLUMNS = 8;
const FIELD_GAPS = new Set(["B4", "E7"]);
const TREATMENTS: Treatment[] = ["Control", "Drought", "Severe drought"];
const NAMED_PLOT = "C4";
const SKIPPED_PLOT: SkippedPlot = { identifier: "A4", reason: "flooded", skippedAt: "08:36" };

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
const OTHER_MEASURER = "Alex Example";
const OTHER_PHONE_STARTED_AT = "08:10";

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

  const skippedIndex = field.plots.findIndex((plot) => plot.identifier === SKIPPED_PLOT.identifier);
  const skippedPlot = field.plots[skippedIndex];
  if (!skippedPlot) {
    throw new Error(`The example field has no plot ${SKIPPED_PLOT.identifier}`);
  }

  const total = field.plots.length;
  const beforeSkipped = field.plots.slice(0, skippedIndex).map((plot) => plot.identifier);
  const beforeNamed = field.plots.slice(0, namedIndex).map((plot) => plot.identifier);
  const isNotSkipped = (identifier: string) => identifier !== SKIPPED_PLOT.identifier;

  const share = new ShareProgress(
    EXAMPLE_WALK.slice(0, SHARE_SIZE),
    NAMED_PLOT,
    [SKIPPED_PLOT.identifier],
    OTHER_MEASURER,
  );

  return {
    field,
    namedPlot,
    skippedPlot,
    sessionAtSkippedPlot: new LayoutSession(total, beforeSkipped, []),
    session: new LayoutSession(total, beforeNamed, []),
    sessionWithSkip: new LayoutSession(total, beforeNamed.filter(isNotSkipped), [SKIPPED_PLOT]),
    share,
    shareSession: new LayoutSession(SHARE_SIZE, share.done, [SKIPPED_PLOT]),
    otherPhone: { measurer: OTHER_MEASURER, startedAt: OTHER_PHONE_STARTED_AT },
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
  /** The plot tapped on the picker, waiting for its Measure button. */
  selectedPlot: string | null;
  isMeasuredPromptOpen: boolean;
  isSkipSheetOpen: boolean;
  isComeBackOpen: boolean;
  isFieldGridOpen: boolean;
  /** Scaffold counter for Keep and measure again, until readings carry an ordinal. */
  repeat: number;
}

interface PlotStepActions {
  confirm: (round: number, plot: NextPlot) => void;
  openPicker: () => void;
  closePicker: () => void;
  selectPlot: (identifier: string) => void;
  openMeasuredPrompt: () => void;
  closeMeasuredPrompt: () => void;
  openSkipSheet: () => void;
  closeSkipSheet: () => void;
  openComeBack: () => void;
  closeComeBack: () => void;
  openFieldGrid: () => void;
  closeFieldGrid: () => void;
  measureAgain: () => void;
  reset: () => void;
}

const initialPlotStepState: PlotStepState = {
  confirmedRound: null,
  confirmedPlot: null,
  isPickerOpen: false,
  selectedPlot: null,
  isMeasuredPromptOpen: false,
  isSkipSheetOpen: false,
  isComeBackOpen: false,
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
      selectedPlot: null,
      isMeasuredPromptOpen: false,
      repeat: 1,
    }),
  openPicker: () => set({ isPickerOpen: true }),
  closePicker: () => set({ isPickerOpen: false, selectedPlot: null, isMeasuredPromptOpen: false }),
  selectPlot: (identifier) => set({ selectedPlot: identifier }),
  openMeasuredPrompt: () => set({ isMeasuredPromptOpen: true }),
  closeMeasuredPrompt: () => set({ isMeasuredPromptOpen: false }),
  openSkipSheet: () => set({ isSkipSheetOpen: true }),
  closeSkipSheet: () => set({ isSkipSheetOpen: false }),
  openComeBack: () => set({ isComeBackOpen: true }),
  closeComeBack: () => set({ isComeBackOpen: false }),
  openFieldGrid: () => set({ isFieldGridOpen: true }),
  closeFieldGrid: () => set({ isFieldGridOpen: false }),
  measureAgain: () => set((state) => ({ repeat: state.repeat + 1 })),
  reset: () => set(initialPlotStepState),
}));

/**
 * The plot step opens every round of an experiment with a layout until the plot is confirmed, and
 * again whenever the plot card reopens the picker to correct it.
 */
export function useIsPlotStepShowing(): boolean {
  const nextPlot = useNextPlot();
  const isFirstStep = useMeasurementFlowStore(
    (s) => s.currentFlowStep === 0 && s.flowNodes.length > 0,
  );
  const round = useMeasurementFlowStore((s) => s.iterationCount);
  const confirmedRound = usePlotStepStore((s) => s.confirmedRound);
  const isPickerOpen = usePlotStepStore((s) => s.isPickerOpen);

  const isRoundUnconfirmed = isFirstStep && confirmedRound !== round;

  return nextPlot !== undefined && (isRoundUnconfirmed || isPickerOpen);
}
