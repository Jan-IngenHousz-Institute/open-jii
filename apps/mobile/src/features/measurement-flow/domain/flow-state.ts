import { flattenFlowNodes } from "~/shared/measurements/flow-node";
import type { FlowEdge, FlowNode } from "~/shared/measurements/flow-node";

import type { WorkbookCell } from "@repo/api/domains/workbook/workbook-cells.schema";

import type {
  PendingWorkbookRunManifest,
  WorkbookRunExpected,
  WorkbookRunRealized,
} from "./workbook-run-manifest";

/** Raw MultispeQ output, stored verbatim and passed to analysis/upload. */
export type ScanResult = Record<string, unknown>;

/** One device's scan output and its upload/manifest provenance. */
export interface ScanResultEntry {
  device?: { id: string; name: string };
  measurementDeviceId?: string;
  result: ScanResult;
  producerCellId?: string;
  containerCellId?: string;
  laneId?: string;
  containerAttemptId?: string;
  protocolId?: string;
  protocolName?: string;
  /** Attempt that owns this uploadable row; absent rows are display-only legacy data. */
  workbookAttemptId?: string;
}

/** One device's routing from a device-scoped branch. */
export interface DevicePlanEntry {
  deviceId: string;
  targetCellId: string;
}

/** The branch path last selected by the runner, surfaced in the flow hero. */
export interface MatchedPath {
  label: string;
  color: string;
}

/** Compatibility projection of the runner's Back-return stack. */
export interface BranchReturn {
  landing: number;
  step: number;
}

/**
 * Persisted mobile session plus runner-derived compatibility fields consumed by
 * the existing screen and upload paths. Navigation authority lives exclusively
 * in WorkbookRunner; these fields are a host view, not a second state machine.
 */
export interface FlowState {
  experimentId?: string;
  experimentLabel?: string;
  workbookVersionId?: string;
  workbookAttemptId?: string;
  workbookRunExpected: WorkbookRunExpected[];
  workbookRunRealized: WorkbookRunRealized[];
  workbookTerminalReadyAttemptId?: string;
  pendingWorkbookRunManifests: PendingWorkbookRunManifest[];
  currentStep: number;
  flowNodes: FlowNode[];
  currentFlowStep: number;
  iterationCount: number;
  isFlowFinished: boolean;
  isQuestionsSubmitPending: boolean;
  scanResult?: ScanResult;
  scanResults?: ScanResultEntry[];
  /** Attempt-scoped rows eligible for analysis/upload in the current cycle. */
  uploadScanResults?: ScanResultEntry[];
  producerCellId?: string;
  cellOutputs: Record<string, unknown>;
  isFromOverview: boolean;
  cells: WorkbookCell[];
  edges: FlowEdge[];
  lastMatchedPath?: MatchedPath;
  branchVisitCounts: Record<string, number>;
  branchReturnStack: BranchReturn[];
  devicePlan?: DevicePlanEntry[];
  consumedNodeIds: string[];
}

export const initialFlowState: FlowState = {
  experimentId: undefined,
  experimentLabel: undefined,
  workbookVersionId: undefined,
  workbookAttemptId: undefined,
  workbookRunExpected: [],
  workbookRunRealized: [],
  workbookTerminalReadyAttemptId: undefined,
  pendingWorkbookRunManifests: [],
  currentStep: 0,
  flowNodes: [],
  currentFlowStep: 0,
  iterationCount: 0,
  isFlowFinished: false,
  isQuestionsSubmitPending: false,
  scanResult: undefined,
  scanResults: undefined,
  uploadScanResults: undefined,
  producerCellId: undefined,
  cellOutputs: {},
  isFromOverview: false,
  cells: [],
  edges: [],
  lastMatchedPath: undefined,
  branchVisitCounts: {},
  branchReturnStack: [],
  devicePlan: undefined,
  consumedNodeIds: [],
};

/** Protocol used for the upload topic; command-only measurement nodes do not qualify. */
export function flowProtocolId(flowNodes: FlowNode[]): string | undefined {
  const node = flattenFlowNodes(flowNodes).find(
    (candidate) =>
      candidate.type === "measurement" &&
      (candidate.content as { protocolId?: string } | undefined)?.protocolId,
  );
  return (node?.content as { protocolId?: string } | undefined)?.protocolId;
}
