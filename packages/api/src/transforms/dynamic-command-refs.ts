import type { z } from "zod";

import {
  zExperimentAnalysisContent,
  zExperimentMeasurementCommandContent,
  zExperimentMeasurementContent,
  zExperimentQuestionContent,
} from "../domains/experiment/experiment.schema";
import type {
  zExperimentFlowEdge,
  zExperimentFlowNode,
} from "../domains/experiment/experiment.schema";
import { isReferencedCommandPayload } from "../domains/workbook/command-source.schema";
import type { WorkbookCell } from "../domains/workbook/workbook-cells.schema";
import { analyzeOrdinaryChain } from "./flow-graph-topology";

type FlowNode = z.infer<typeof zExperimentFlowNode>;
type FlowEdge = z.infer<typeof zExperimentFlowEdge>;

/**
 * Structural (device-free, runtime-free) validation of dynamic command
 * references, kept OUTSIDE Zod so a damaged draft still loads and can be
 * repaired. Shared by the web editor (surfaced via `validateWorkbook`) and the
 * backend publish path (the actual enforcement point). See the technical plan,
 * section 2.
 *
 * Runtime-only checks (did the source run, does the field exist this run,
 * output scope, exact device presence, string validity) are NOT done here.
 */

// Cell types whose output a dynamic command may reference.
const ELIGIBLE_SOURCE_TYPES = new Set<WorkbookCell["type"]>([
  "protocol",
  "command",
  "macro",
  "question",
]);

// Single source of truth for the stable structural issue codes. Exported as a
// runtime set so the backend production-details sanitizer can allowlist exactly
// these without duplicating the list.
export const DYNAMIC_COMMAND_ISSUE_CODES = [
  "DYNAMIC_COMMAND_SOURCE_MISSING",
  "DYNAMIC_COMMAND_SOURCE_INELIGIBLE",
  "DYNAMIC_COMMAND_SOURCE_NOT_EARLIER",
  "DYNAMIC_COMMAND_FIELD_EMPTY",
  // Flow-graph only: a ref command node is not on any complete authored chain
  // (disconnected or reachable only through a goto), so its authored order
  // cannot be established. Cells are always ordered, so the cell validator
  // never emits this.
  "DYNAMIC_COMMAND_NODE_UNREACHABLE",
  // Flow-graph only: the graph's ordinary topology is ambiguous (duplicate
  // ids, fork, merge, cycle, dangling edge, or no unique start), so authored
  // order is unknowable for the whole graph. Tied to each affected ref.
  "DYNAMIC_COMMAND_GRAPH_AMBIGUOUS",
  // Flow-graph only: a ref-like carrier is not a valid measurement command
  // (wrong node type, mixed static/ref keys, or a malformed ref object), so it
  // could otherwise be stripped/retyped before detection. Fails closed.
  "DYNAMIC_COMMAND_INVALID_CARRIER",
] as const;

export type DynamicCommandIssueCode = (typeof DYNAMIC_COMMAND_ISSUE_CODES)[number];

export interface DynamicCommandValidationIssue {
  code: DynamicCommandIssueCode;
  /** The command cell carrying the offending reference. */
  commandCellId: string;
  /** The referenced source cell id, when one was provided. */
  sourceCellId?: string;
  /** The referenced field (may be blank). */
  field: string;
  /** Document index of the command cell, for stable ordering/anchoring. */
  index: number;
}

/** True when any cell is a command cell in dynamic (ref) mode. */
export function hasDynamicCommandRef(cells: WorkbookCell[]): boolean {
  return cells.some((cell) => cell.type === "command" && isReferencedCommandPayload(cell.payload));
}

/** True when a value is a ref-like command carrier by shape. */
function isRefLikeCommand(command: unknown): boolean {
  if (!command || typeof command !== "object") return false;
  const cmd = command as { kind?: unknown; ref?: unknown };
  return cmd.kind === "ref" || "ref" in cmd;
}

/**
 * Total over `unknown`: true when any flow-graph node carries a ref-like
 * command. Never throws for a non-object graph, non-array/null nodes, or
 * malformed content/command, so a corrupt stored row reaches the controlled
 * strict-read boundary instead of crashing. Any ref-like carrier (even a
 * malformed one on the wrong node type) counts as dynamic, so the gate always
 * routes it to the validator / capability boundary to fail closed.
 */
export function flowGraphHasDynamicCommandRef(graph: unknown): boolean {
  if (!graph || typeof graph !== "object") return false;
  const nodes = (graph as { nodes?: unknown }).nodes;
  if (!Array.isArray(nodes)) return false;
  return nodes.some((node) => {
    if (!node || typeof node !== "object") return false;
    const content = (node as { content?: unknown }).content;
    if (!content || typeof content !== "object") return false;
    return isRefLikeCommand((content as { command?: unknown }).command);
  });
}

/**
 * Return every structural issue with the dynamic command references in `cells`.
 * Empty array means no blocking structural problems (not "guaranteed to run").
 */
export function validateDynamicCommandReferences(
  cells: WorkbookCell[],
): DynamicCommandValidationIssue[] {
  const issues: DynamicCommandValidationIssue[] = [];

  // Index by id and by document position. Output cells are excluded from the
  // author-order relation (they are display artifacts, never a source), so the
  // "earlier than" comparison uses positions among non-output cells.
  const positionById = new Map<string, number>();
  const cellById = new Map<string, WorkbookCell>();
  let position = 0;
  for (const cell of cells) {
    cellById.set(cell.id, cell);
    if (cell.type !== "output") {
      positionById.set(cell.id, position);
      position += 1;
    }
  }

  cells.forEach((cell, index) => {
    if (cell.type !== "command" || !isReferencedCommandPayload(cell.payload)) return;
    const { ref } = cell.payload;
    const sourceCellId = ref.sourceCellId.trim();
    const field = ref.field;

    if (field.trim().length === 0) {
      issues.push({
        code: "DYNAMIC_COMMAND_FIELD_EMPTY",
        commandCellId: cell.id,
        sourceCellId: sourceCellId || undefined,
        field,
        index,
      });
    }

    if (sourceCellId.length === 0) {
      issues.push({
        code: "DYNAMIC_COMMAND_SOURCE_MISSING",
        commandCellId: cell.id,
        field,
        index,
      });
      return;
    }

    const source = cellById.get(sourceCellId);
    if (!source) {
      issues.push({
        code: "DYNAMIC_COMMAND_SOURCE_MISSING",
        commandCellId: cell.id,
        sourceCellId,
        field,
        index,
      });
      return;
    }

    if (!ELIGIBLE_SOURCE_TYPES.has(source.type)) {
      issues.push({
        code: "DYNAMIC_COMMAND_SOURCE_INELIGIBLE",
        commandCellId: cell.id,
        sourceCellId,
        field,
        index,
      });
      return;
    }

    const commandPos = positionById.get(cell.id);
    const sourcePos = positionById.get(sourceCellId);
    const isEarlier = sourcePos !== undefined && commandPos !== undefined && sourcePos < commandPos;
    if (source.id === cell.id || !isEarlier) {
      issues.push({
        code: "DYNAMIC_COMMAND_SOURCE_NOT_EARLIER",
        commandCellId: cell.id,
        sourceCellId,
        field,
        index,
      });
    }
  });

  return issues;
}

/**
 * Content-coupled source eligibility. A source is eligible only when its node
 * type AND its content agree on a referenceable carrier, so unparsed/cast data
 * with a lying `type` cannot pass. Mirrors ELIGIBLE_SOURCE_TYPES after
 * conversion: measurement (protocol OR command), analysis (macro), question.
 */
function isEligibleSourceNode(node: FlowNode): boolean {
  switch (node.type) {
    case "measurement":
      return (
        zExperimentMeasurementContent.safeParse(node.content).success ||
        zExperimentMeasurementCommandContent.safeParse(node.content).success
      );
    case "analysis":
      return zExperimentAnalysisContent.safeParse(node.content).success;
    case "question":
      return zExperimentQuestionContent.safeParse(node.content).success;
    default:
      return false; // instruction, branch, unknown
  }
}

interface RefLikeCarrier {
  /** Best-effort ref context for issue reporting (may be blank/garbage). */
  sourceCellId: string;
  field: string;
  /** True only for a node=measurement carrying a strict, ref-kind command. */
  carrierValid: boolean;
}

/**
 * Detects any RAW ref-like carrier by shape (a `command` object whose `kind` is
 * "ref" or that has a `ref` key), independent of node type, so a ref hidden on
 * the wrong node type or a malformed/mixed ref is still caught. `carrierValid`
 * is true only when it is a well-formed measurement command ref.
 */
function refLikeCarrier(node: FlowNode): RefLikeCarrier | null {
  const command = (node.content as { command?: unknown } | undefined)?.command;
  if (!command || typeof command !== "object") return null;
  const cmd = command as { kind?: unknown; ref?: unknown };
  if (cmd.kind !== "ref" && !("ref" in cmd)) return null;

  const rawRef = (typeof cmd.ref === "object" && cmd.ref !== null ? cmd.ref : {}) as {
    sourceCellId?: unknown;
    field?: unknown;
  };
  const carrierValid =
    node.type === "measurement" &&
    cmd.kind === "ref" &&
    zExperimentMeasurementCommandContent.safeParse(node.content).success;

  return {
    sourceCellId: typeof rawRef.sourceCellId === "string" ? rawRef.sourceCellId.trim() : "",
    field: typeof rawRef.field === "string" ? rawRef.field : "",
    carrierValid,
  };
}

/**
 * Structural validation for dynamic command references carried in a flow GRAPH
 * (public experiment-flow authoring). It is a coherent graph-integrity boundary:
 *
 * 1. If the ordinary-edge topology is ambiguous (duplicate node/edge ids,
 *    fork, merge, cycle, dangling edge, or no unique start), authored order is
 *    unknowable, so every ref fails closed with DYNAMIC_COMMAND_GRAPH_AMBIGUOUS
 *    and no per-ref order check runs (identity maps are never built over
 *    duplicated ids).
 * 2. Otherwise, EVERY ref-carrying node is validated directly against the
 *    unique start-rooted chain (never via reverse conversion, which could drop
 *    a node): field non-empty, node on the chain, source present, source
 *    content-eligible, and source strictly earlier. Pure and gate-independent.
 */
export function validateDynamicCommandFlowGraph(
  nodes: FlowNode[],
  edges: FlowEdge[],
): DynamicCommandValidationIssue[] {
  const issues: DynamicCommandValidationIssue[] = [];

  const refNodes = nodes
    .map((node, docIndex) => ({ node, docIndex, carrier: refLikeCarrier(node) }))
    .filter(
      (entry): entry is { node: FlowNode; docIndex: number; carrier: RefLikeCarrier } =>
        entry.carrier !== null,
    );
  if (refNodes.length === 0) return [];

  const { chainIndex, problems } = analyzeOrdinaryChain(nodes, edges);

  // Any ordinary-topology problem makes the whole graph's authored order
  // unknowable: fail every ref closed, before any per-ref reasoning.
  if (problems.size > 0) {
    for (const { node, docIndex, carrier } of refNodes) {
      issues.push({
        code: "DYNAMIC_COMMAND_GRAPH_AMBIGUOUS",
        commandCellId: node.id,
        sourceCellId: carrier.sourceCellId || undefined,
        field: carrier.field,
        index: chainIndex.get(node.id) ?? docIndex,
      });
    }
    return issues;
  }

  // Clean, unambiguous chain: node ids are unique, so this map is safe.
  const nodeById = new Map(nodes.map((n) => [n.id, n]));

  for (const { node, docIndex, carrier } of refNodes) {
    const { sourceCellId, field } = carrier;
    const commandIndex = chainIndex.get(node.id);
    const index = commandIndex ?? docIndex;
    const base = { commandCellId: node.id, sourceCellId: sourceCellId || undefined, field, index };

    // The ref-like carrier must be a well-formed measurement command ref;
    // wrong node type, mixed static/ref keys, or a malformed ref fail closed.
    if (!carrier.carrierValid) {
      issues.push({ code: "DYNAMIC_COMMAND_INVALID_CARRIER", ...base });
      continue;
    }

    if (field.trim().length === 0) {
      issues.push({ code: "DYNAMIC_COMMAND_FIELD_EMPTY", ...base });
    }

    // The ref node itself must sit on the authored chain.
    if (commandIndex === undefined) {
      issues.push({ code: "DYNAMIC_COMMAND_NODE_UNREACHABLE", ...base });
      continue;
    }

    if (sourceCellId.length === 0) {
      issues.push({ code: "DYNAMIC_COMMAND_SOURCE_MISSING", ...base });
      continue;
    }

    const sourceNode = nodeById.get(sourceCellId);
    if (!sourceNode) {
      issues.push({ code: "DYNAMIC_COMMAND_SOURCE_MISSING", ...base });
      continue;
    }

    if (!isEligibleSourceNode(sourceNode)) {
      issues.push({ code: "DYNAMIC_COMMAND_SOURCE_INELIGIBLE", ...base });
      continue;
    }

    // Self, later, or only-earlier-through-goto (source off the authored chain)
    // all fail the authored-order rule.
    const sourceIndex = chainIndex.get(sourceCellId);
    if (sourceNode.id === node.id || sourceIndex === undefined || sourceIndex >= commandIndex) {
      issues.push({ code: "DYNAMIC_COMMAND_SOURCE_NOT_EARLIER", ...base });
    }
  }

  return issues;
}
