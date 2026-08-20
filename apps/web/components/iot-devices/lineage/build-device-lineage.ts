import type {
  DeviceExperiment,
  DeviceMonitoring,
  IotDeviceDetail,
} from "@repo/api/domains/iot/iot.schema";

import type { EntityAccess, ResolvedEntity } from "../monitoring/resolve-entity-label";
import { resolveEntities } from "../monitoring/resolve-entity-label";

/** How many attribution nodes each kind shows before folding into "+n more". */
const ATTRIBUTION_CAP = 3;

export type LineageAttributionKind = "protocol" | "workbook" | "macro";

export type LineageNodeModel =
  | {
      id: "device";
      kind: "device";
      label: string;
      family: IotDeviceDetail["deviceType"];
      status: IotDeviceDetail["status"];
      firmwareVersion: string | null;
    }
  | {
      id: "broker";
      kind: "broker";
      thingName: string;
      connectivity: IotDeviceDetail["connectivity"];
      uptimePercent: number | null;
      sessionCount: number;
    }
  | {
      id: "warehouse";
      kind: "warehouse";
      totalMeasurements: number;
      lastDataAt: string | null;
      withGps: number;
      withBattery: number;
      workbookRuns: number;
    }
  | {
      id: string;
      kind: "experiment";
      entity: ResolvedEntity;
      count: number;
      lastBucketAt: string | null;
      bound: boolean;
    }
  | { id: "unattributed"; kind: "unattributed"; count: number }
  | { id: string; kind: LineageAttributionKind; entity: ResolvedEntity; count: number }
  | {
      id: string;
      kind: "attribution-other";
      attributionKind: LineageAttributionKind;
      folded: number;
      count: number;
    };

export type LineageEdgeState =
  | "identity"
  | "input"
  | "processing"
  | "active"
  | "silent"
  | "unbound"
  | "unattributed";

export interface LineageEdgeModel {
  id: string;
  source: string;
  target: string;
  state: LineageEdgeState;
  count: number | null;
  lastBucketAt: string | null;
}

export interface DeviceLineageModel {
  nodes: LineageNodeModel[];
  edges: LineageEdgeModel[];
}

export interface DeviceLineageLabels {
  privateExperiment: (index: number) => string;
  privateProtocol: (index: number) => string;
  privateWorkbook: (index: number) => string;
  privateMacro: (index: number) => string;
}

export interface BuildDeviceLineageInput {
  device: IotDeviceDetail;
  deviceLabel: string;
  monitoring: DeviceMonitoring;
  /** All-time last arrival from the activity endpoint; null when unknown. */
  lastDataAt: string | null;
  boundExperiments: DeviceExperiment[];
  visibleExperiments: EntityAccess[];
  visibleProtocols: EntityAccess[];
  visibleWorkbooks: EntityAccess[];
  visibleMacros: EntityAccess[];
  locale: string;
  labels: DeviceLineageLabels;
}

interface ExperimentArrival {
  count: number;
  lastBucketAt: string | null;
}

/**
 * The causal chain as a graph: what the device executed (protocols, workbook
 * versions) feeds the device, whose identity carries through the broker into
 * the warehouse; macros process rows there before they surface in the
 * experiments the rows landed in (or were promised to). Attribution stays
 * device-global for the range; access resolution keeps ids the viewer cannot
 * open opaque.
 */
export function buildDeviceLineage(input: BuildDeviceLineageInput): DeviceLineageModel {
  const { device, monitoring } = input;

  const nodes: LineageNodeModel[] = [];
  const edges: LineageEdgeModel[] = [];

  appendExecutionInputs(input, nodes, edges);

  nodes.push({
    id: "device",
    kind: "device",
    label: input.deviceLabel,
    family: device.deviceType,
    status: device.status,
    firmwareVersion: currentFirmwareVersion(monitoring),
  });
  nodes.push({
    id: "broker",
    kind: "broker",
    thingName: device.thingName,
    connectivity: device.connectivity,
    uptimePercent: monitoring.uptimePercent,
    sessionCount: monitoring.sessions.length,
  });
  nodes.push({
    id: "warehouse",
    kind: "warehouse",
    totalMeasurements: monitoring.payload.totalMeasurements,
    lastDataAt: input.lastDataAt,
    withGps: monitoring.payload.withGps,
    withBattery: monitoring.payload.withBattery,
    workbookRuns: monitoring.payload.workbookRuns,
  });
  edges.push({
    id: "device-broker",
    source: "device",
    target: "broker",
    state: "identity",
    count: null,
    lastBucketAt: null,
  });
  edges.push({
    id: "broker-warehouse",
    source: "broker",
    target: "warehouse",
    state: "identity",
    count: null,
    lastBucketAt: null,
  });

  appendExperiments(input, nodes, edges);
  appendMacros(input, nodes, edges);

  return { nodes, edges };
}

/** Newest non-null report wins by `lastSeen`, not array order; versions can
 * reappear on rollback, so recency is the only truthful tiebreak. */
function currentFirmwareVersion(monitoring: DeviceMonitoring): string | null {
  let current: { version: string; lastSeen: string } | null = null;
  for (const entry of monitoring.firmwareHistory) {
    if (entry.version === null) {
      continue;
    }
    if (current === null || entry.lastSeen > current.lastSeen) {
      current = { version: entry.version, lastSeen: entry.lastSeen };
    }
  }
  return current === null ? null : current.version;
}

function appendExperiments(
  input: BuildDeviceLineageInput,
  nodes: LineageNodeModel[],
  edges: LineageEdgeModel[],
): void {
  const arrivals = new Map<string, ExperimentArrival>();
  let unattributed = 0;
  for (const bucket of input.monitoring.throughput) {
    if (bucket.experimentId === null) {
      unattributed += bucket.count;
      continue;
    }
    const entry = arrivals.get(bucket.experimentId) ?? { count: 0, lastBucketAt: null };
    entry.count += bucket.count;
    if (entry.lastBucketAt === null || bucket.bucketStart > entry.lastBucketAt) {
      entry.lastBucketAt = bucket.bucketStart;
    }
    arrivals.set(bucket.experimentId, entry);
  }

  // A bound experiment is one the viewer can already see through this device,
  // so its name is known regardless of the viewer's own experiment list.
  const known: EntityAccess[] = [
    ...input.boundExperiments.map((experiment) => ({ id: experiment.id, name: experiment.name })),
    ...input.visibleExperiments,
  ];
  const ids = [...input.boundExperiments.map((experiment) => experiment.id), ...arrivals.keys()];
  const resolved = resolveEntities(
    ids,
    known,
    (id) => `/${input.locale}/platform/experiments/${id}/data`,
    input.labels.privateExperiment,
  );

  const rows = [...resolved.values()]
    .map((entity) => ({
      entity,
      count: arrivals.get(entity.id)?.count ?? 0,
      lastBucketAt: arrivals.get(entity.id)?.lastBucketAt ?? null,
      bound: input.boundExperiments.some((experiment) => experiment.id === entity.id),
    }))
    .sort((a, b) => b.count - a.count);

  for (const row of rows) {
    const nodeId = `experiment:${row.entity.id}`;
    nodes.push({ id: nodeId, kind: "experiment", ...row });
    edges.push({
      id: `warehouse-${nodeId}`,
      source: "warehouse",
      target: nodeId,
      state: edgeStateFor(row.bound, row.count),
      count: row.count,
      lastBucketAt: row.lastBucketAt,
    });
  }

  if (unattributed > 0) {
    nodes.push({ id: "unattributed", kind: "unattributed", count: unattributed });
    edges.push({
      id: "warehouse-unattributed",
      source: "warehouse",
      target: "unattributed",
      state: "unattributed",
      count: unattributed,
      lastBucketAt: null,
    });
  }
}

function edgeStateFor(bound: boolean, count: number): LineageEdgeState {
  if (!bound) {
    return "unbound";
  }
  return count > 0 ? "active" : "silent";
}

/** What the device ran to produce its rows: observed on the rows themselves. */
function appendExecutionInputs(
  input: BuildDeviceLineageInput,
  nodes: LineageNodeModel[],
  edges: LineageEdgeModel[],
): void {
  const { payload } = input.monitoring;

  appendAttributionKind(nodes, edges, {
    kind: "protocol",
    mix: payload.protocolMix.map((entry) => ({ id: entry.protocolId, count: entry.count })),
    accessible: input.visibleProtocols,
    buildHref: (id) => `/${input.locale}/platform/protocols/${id}`,
    privateLabel: input.labels.privateProtocol,
    edgeFor: (nodeId, count) => ({
      id: `${nodeId}-device`,
      source: nodeId,
      target: "device",
      state: "input",
      count,
      lastBucketAt: null,
    }),
  });
  appendAttributionKind(nodes, edges, {
    kind: "workbook",
    mix: payload.workbookMix.map((entry) => ({ id: entry.workbookVersionId, count: entry.count })),
    accessible: input.visibleWorkbooks,
    buildHref: (id) => `/${input.locale}/platform/workbooks/${id}`,
    privateLabel: input.labels.privateWorkbook,
    edgeFor: (nodeId, count) => ({
      id: `${nodeId}-device`,
      source: nodeId,
      target: "device",
      state: "input",
      count,
      lastBucketAt: null,
    }),
  });
}

/** Macros run in the pipeline: they process rows between arrival and the
 * experiment tables, so they hang off the warehouse as a processing stage. */
function appendMacros(
  input: BuildDeviceLineageInput,
  nodes: LineageNodeModel[],
  edges: LineageEdgeModel[],
): void {
  appendAttributionKind(nodes, edges, {
    kind: "macro",
    mix: input.monitoring.payload.macroMix.map((entry) => ({
      id: entry.macroId,
      count: entry.count,
    })),
    accessible: input.visibleMacros,
    buildHref: (id) => `/${input.locale}/platform/macros/${id}`,
    privateLabel: input.labels.privateMacro,
    edgeFor: (nodeId, count) => ({
      id: `warehouse-${nodeId}`,
      source: "warehouse",
      target: nodeId,
      state: "processing",
      count,
      lastBucketAt: null,
    }),
  });
}

interface AttributionKindInput {
  kind: LineageAttributionKind;
  mix: { id: string | null; count: number }[];
  accessible: EntityAccess[];
  buildHref: (id: string) => string;
  privateLabel: (index: number) => string;
  edgeFor: (nodeId: string, count: number | null) => LineageEdgeModel;
}

function appendAttributionKind(
  nodes: LineageNodeModel[],
  edges: LineageEdgeModel[],
  input: AttributionKindInput,
): void {
  // Null buckets (rows without this attribution) say nothing about lineage.
  const attributed = input.mix.flatMap((entry) =>
    entry.id === null ? [] : [{ id: entry.id, count: entry.count }],
  );
  if (attributed.length === 0) {
    return;
  }

  const sorted = [...attributed].sort((a, b) => b.count - a.count);
  const shown = sorted.slice(0, ATTRIBUTION_CAP);
  const folded = sorted.slice(ATTRIBUTION_CAP);

  const resolved = resolveEntities(
    shown.map((entry) => entry.id),
    input.accessible,
    input.buildHref,
    input.privateLabel,
  );

  // Driven by the resolved entities: `resolveEntities` returns one per id it
  // was given, so pairing back by id needs no absent-entity branch.
  const shownCounts = new Map(shown.map((entry) => [entry.id, entry.count]));
  for (const [id, entity] of resolved) {
    const nodeId = `${input.kind}:${id}`;
    const count = shownCounts.get(id) ?? 0;
    nodes.push({ id: nodeId, kind: input.kind, entity, count });
    edges.push(input.edgeFor(nodeId, count));
  }

  if (folded.length > 0) {
    const nodeId = `${input.kind}:other`;
    nodes.push({
      id: nodeId,
      kind: "attribution-other",
      attributionKind: input.kind,
      folded: folded.length,
      count: folded.reduce((sum, entry) => sum + entry.count, 0),
    });
    edges.push(input.edgeFor(nodeId, null));
  }
}
