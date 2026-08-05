import type { FlowState } from "~/features/measurement-flow/domain/flow-state";
import type { FlowEdge, FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import type {
  WorkbookRunLaneAssignment,
  WorkbookRunRealizedLane,
} from "../domain/workbook-run-manifest";

/** Existing mobile screen/upload contract, implemented solely by WorkbookRunner after cutover. */
export interface MeasurementFlowStore extends FlowState {
  iterationAnchor?: { iteration: number; nodeId?: string };
  setExperimentId: (experimentId: string, experimentLabel?: string) => void;
  setCurrentStep: (step: number) => void;
  setCurrentFlowStep: (step: number) => void;
  nextStep: () => void;
  previousStep: () => void;
  reset: () => void;
  setFlowNodes: (nodes: FlowNode[]) => void;
  setFlowGraph: (
    nodes: FlowNode[],
    edges: FlowEdge[],
    cells: WorkbookCell[],
    workbookVersionId?: string,
  ) => void;
  resetFlow: () => void;
  startNewIteration: () => void;
  retryCurrentIteration: () => void;
  finishFlow: () => void;
  setCellOutput: (cellId: string, data: unknown) => void;
  setIterationAnchor: (anchor: { iteration: number; nodeId?: string }) => void;
  dismissQuestionsSubmit: () => void;
  recordExpectedLaneAssignment: (assignment: WorkbookRunLaneAssignment) => void;
  recordRealizedLaneStatus: (lane: WorkbookRunRealizedLane) => void;
  markWorkbookRunTerminalReady: () => void;
  acknowledgeWorkbookRunManifest: (attemptId: string) => void;
  navigateToQuestionFromOverview: (questionIndex: number) => void;
  returnToOverview: () => void;
  continueRunnerTrackInteraction: (trackId: string, cellId: string, value?: string) => void;
  abandonRunnerLane: (trackId: string) => void;
  restartRunnerContainer: (containerCellId: string, attemptId: string) => void;
}
