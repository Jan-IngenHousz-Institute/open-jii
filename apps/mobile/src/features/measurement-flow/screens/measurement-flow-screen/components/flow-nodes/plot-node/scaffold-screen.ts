import { LogBox } from "react-native";
import { useMeasurementFlowStore } from "~/features/measurement-flow/stores/use-measurement-flow-store";

import { exampleLayout, usePlotStepStore } from "./next-plot";
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
 * - d2-plot-picker: the plot picker in place of the Next plot step, with D2 held pressed
 * - d3-session-start: Start opens the session sheet, and its Start opens the flow
 * - d5-measure-again: a device workbook on the result step of repeat 2 of plot C4
 * - d6-questions-only-plot: a questions-only workbook on its first question, under plot C4
 * - d7-skip-plot: the Next plot step with Skip, and the skip sheet open
 * - e3-route-context: the Next plot step with the plot's place in the walk
 * - e8-progress-grid: the field grid over the Next plot step
 */
// Dev toasts would cover the screens being captured, so a selected screen silences them.
if (process.env.EXPO_PUBLIC_SCAFFOLD_SCREEN) {
  LogBox.ignoreAllLogs(true);
}

export type ScaffoldScreen =
  | "d2-plot-picker"
  | "d3-session-start"
  | "d5-measure-again"
  | "d6-questions-only-plot"
  | "d7-skip-plot"
  | "e3-route-context"
  | "e8-progress-grid";

const SCAFFOLD_SCREENS: ScaffoldScreen[] = [
  "d2-plot-picker",
  "d3-session-start",
  "d5-measure-again",
  "d6-questions-only-plot",
  "d7-skip-plot",
  "e3-route-context",
  "e8-progress-grid",
];

const selectedScreen = exampleLayout
  ? SCAFFOLD_SCREENS.find((screen) => screen === process.env.EXPO_PUBLIC_SCAFFOLD_SCREEN)
  : undefined;

export function isScaffoldScreenOn(screen: ScaffoldScreen): boolean {
  return selectedScreen === screen;
}

/** Runs on Start: clears the last flow's plot step and opens the selected screen's state. */
export function startScaffoldScreen(): void {
  const plotStep = usePlotStepStore.getState();
  plotStep.reset();

  if (!exampleLayout || !selectedScreen) {
    return;
  }

  const flow = useMeasurementFlowStore.getState();
  const { namedPlot } = exampleLayout;

  switch (selectedScreen) {
    case "d2-plot-picker":
      plotStep.openPicker();
      plotStep.holdPlot("D2");
      break;
    case "d5-measure-again":
      flow.setFlowNodes(LEAF_READING_WORKBOOK);
      flow.setScanResult(LEAF_READING_RESULT, LEAF_READING_NODE_ID);
      flow.setCurrentFlowStep(LEAF_READING_WORKBOOK.length - 1);
      plotStep.confirm(flow.iterationCount, namedPlot);
      plotStep.measureAgain();
      break;
    case "d6-questions-only-plot":
      flow.setFlowNodes(WILTING_SCORE_WORKBOOK);
      plotStep.confirm(flow.iterationCount, namedPlot);
      break;
    case "d7-skip-plot":
      plotStep.openSkipSheet();
      break;
    case "e8-progress-grid":
      plotStep.openFieldGrid();
      break;
    case "d3-session-start":
    case "e3-route-context":
      break;
  }
}
