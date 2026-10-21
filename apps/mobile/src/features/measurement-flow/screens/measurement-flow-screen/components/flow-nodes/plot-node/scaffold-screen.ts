import { LogBox } from "react-native";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { exampleLayout, useIsPlotStepShowing, usePlotStepStore } from "./next-plot";
import type { LayoutSession } from "./next-plot";
import {
  LEAF_READING_NODE_ID,
  LEAF_READING_RESULT,
  LEAF_READING_WORKBOOK,
  WILTING_SCORE_WORKBOOK,
} from "./scaffold-workbooks";

/**
 * Scaffold-only selector for ticket screens. With EXPO_PUBLIC_SCAFFOLD_EXAMPLE_LAYOUT=true, setting
 * EXPO_PUBLIC_SCAFFOLD_SCREEN to a slug shows that ticket's change and opens the flow in its state
 * when Start is tapped. Unset, the flow shows the Next plot step and nothing more.
 *
 * - d2-plot-picker: the plot picker in place of the Next plot step, with D2 selected
 * - d2-measured-plot: the picker with C2 selected and the question before measuring it again
 * - d3-session-start: the experiment list says what the session holds before Start
 * - d3-continue-card: Home offers to continue the session between plots
 * - d5-measure-again: a device workbook on the result step of repeat 2 of plot C4
 * - d6-questions-only-plot: a questions-only workbook on its first question, under plot C4
 * - d7-skip-plot: the Next plot step with Cannot measure this plot and one plot to come back to
 * - d7-skip-reason: the same step with the skip sheet open
 * - d7-come-back-later: the same step with the come-back-later list open
 * - d10-show-treatment: the Next plot step with treatment and genotype shown to the measurer
 * - d11-end-session: the exit sheet of a session
 * - e3-route-context: the Next plot step with the plot after it in the walk
 * - e8-progress-grid: the field grid over the Next plot step
 */
// Dev toasts would cover the screens being captured, so a selected screen silences them.
if (process.env.EXPO_PUBLIC_SCAFFOLD_SCREEN) {
  LogBox.ignoreAllLogs(true);
}

export type ScaffoldScreen =
  | "d2-plot-picker"
  | "d2-measured-plot"
  | "d3-session-start"
  | "d3-continue-card"
  | "d5-measure-again"
  | "d6-questions-only-plot"
  | "d7-skip-plot"
  | "d7-skip-reason"
  | "d7-come-back-later"
  | "d10-show-treatment"
  | "d11-end-session"
  | "e3-route-context"
  | "e8-progress-grid";

const SCAFFOLD_SCREENS: ScaffoldScreen[] = [
  "d2-plot-picker",
  "d2-measured-plot",
  "d3-session-start",
  "d3-continue-card",
  "d5-measure-again",
  "d6-questions-only-plot",
  "d7-skip-plot",
  "d7-skip-reason",
  "d7-come-back-later",
  "d10-show-treatment",
  "d11-end-session",
  "e3-route-context",
  "e8-progress-grid",
];

/** Screens drawn after Skip exists, so the session holds A4 on the come-back-later list. */
const SKIP_SCREENS: ScaffoldScreen[] = ["d7-skip-plot", "d7-skip-reason", "d7-come-back-later"];

const selectedScreen = exampleLayout
  ? SCAFFOLD_SCREENS.find((screen) => screen === process.env.EXPO_PUBLIC_SCAFFOLD_SCREEN)
  : undefined;

export function isScaffoldScreenOn(screen: ScaffoldScreen): boolean {
  return selectedScreen === screen;
}

export function isAnyScaffoldScreenOn(screens: ScaffoldScreen[]): boolean {
  return screens.some(isScaffoldScreenOn);
}

/** Whether the selected screen comes after Skip, so Cannot measure this plot is offered. */
export function isSkipOn(): boolean {
  return isAnyScaffoldScreenOn([...SKIP_SCREENS, "e3-route-context", "e8-progress-grid"]);
}

/** Whether the selected screen comes after the walking order, so the step names the plot after it. */
export function isWalkOn(): boolean {
  return isAnyScaffoldScreenOn(["e3-route-context", "e8-progress-grid"]);
}

/** The experiment setting that shows treatment and genotype to measurers, off unless selected. */
export function isTreatmentShown(): boolean {
  return isScaffoldScreenOn("d10-show-treatment");
}

/** The session the selected screen shows: layout order, layout order with a skip, the walk or a share. */
export function scaffoldSession(): LayoutSession | undefined {
  if (!exampleLayout) {
    return undefined;
  }
  if (isWalkOn()) {
    return exampleLayout.shareSession;
  }
  if (isAnyScaffoldScreenOn(SKIP_SCREENS)) {
    return exampleLayout.sessionWithSkip;
  }
  return exampleLayout.session;
}

/** The session count the flow's header shows while the Next plot step is up. */
export function usePlotSessionCount(): LayoutSession | undefined {
  const isPlotStepShowing = useIsPlotStepShowing();
  return isPlotStepShowing ? scaffoldSession() : undefined;
}

/** Puts the selected screen's example workbook in the flow, on the step the screen shows. */
function openScaffoldWorkbook(): void {
  const flow = useMeasurementFlowStore.getState();
  const plotStep = usePlotStepStore.getState();
  if (!exampleLayout) {
    return;
  }

  if (selectedScreen === "d5-measure-again") {
    flow.setFlowNodes(LEAF_READING_WORKBOOK);
    flow.setScanResult(LEAF_READING_RESULT, LEAF_READING_NODE_ID);
    flow.setCurrentFlowStep(LEAF_READING_WORKBOOK.length - 1);
    plotStep.confirm(flow.iterationCount, exampleLayout.namedPlot);
    plotStep.measureAgain();
  }
  if (selectedScreen === "d6-questions-only-plot") {
    flow.setFlowNodes(WILTING_SCORE_WORKBOOK);
    plotStep.confirm(flow.iterationCount, exampleLayout.namedPlot);
  }
}

const SCAFFOLD_WORKBOOKS = [LEAF_READING_WORKBOOK, WILTING_SCORE_WORKBOOK];

// The flow screen loads the experiment's own workbook when it mounts, after Start, so a screen
// that shows an example workbook puts it back each time the loaded one replaces it.
if (selectedScreen === "d5-measure-again" || selectedScreen === "d6-questions-only-plot") {
  useMeasurementFlowStore.subscribe((state, previous) => {
    const isExampleWorkbook = SCAFFOLD_WORKBOOKS.includes(state.flowNodes);
    const isNewWorkbook = state.flowNodes !== previous.flowNodes && state.flowNodes.length > 0;
    if (isNewWorkbook && !isExampleWorkbook && state.experimentId) {
      openScaffoldWorkbook();
    }
  });
}

/** Runs on Start: clears the last flow's plot step and opens the selected screen's state. */
export function startScaffoldScreen(): void {
  const plotStep = usePlotStepStore.getState();
  plotStep.reset();

  if (!exampleLayout || !selectedScreen) {
    return;
  }

  switch (selectedScreen) {
    case "d2-plot-picker":
      plotStep.openPicker();
      plotStep.selectPlot("D2");
      break;
    case "d2-measured-plot":
      plotStep.openPicker();
      plotStep.selectPlot("C2");
      plotStep.openMeasuredPrompt();
      break;
    case "d5-measure-again":
    case "d6-questions-only-plot":
      openScaffoldWorkbook();
      break;
    case "d7-skip-reason":
      plotStep.openSkipSheet();
      break;
    case "d7-come-back-later":
      plotStep.openComeBack();
      break;
    case "e8-progress-grid":
      plotStep.openFieldGrid();
      break;
    case "d3-session-start":
    case "d3-continue-card":
    case "d7-skip-plot":
    case "d10-show-treatment":
    case "d11-end-session":
    case "e3-route-context":
      break;
  }
}
