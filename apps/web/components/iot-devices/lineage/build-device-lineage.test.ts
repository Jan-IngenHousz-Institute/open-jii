import { createIotDeviceDetail } from "@/test/factories";
import { describe, expect, it } from "vitest";

import type { DeviceMonitoring } from "@repo/api/domains/iot/iot.schema";

import type { BuildDeviceLineageInput, LineageNodeModel } from "./build-device-lineage";
import { buildDeviceLineage } from "./build-device-lineage";

const EXPERIMENT_A = "11111111-1111-4111-8111-111111111111";
const EXPERIMENT_B = "22222222-2222-4222-8222-222222222222";
const EXPERIMENT_C = "33333333-3333-4333-8333-333333333333";

const EMPTY_MONITORING: DeviceMonitoring = {
  bucket: "hour",
  events: [],
  sessions: [],
  uptimePercent: null,
  truncated: false,
  throughput: [],
  battery: [],
  payload: {
    totalMeasurements: 0,
    withGps: 0,
    withBattery: 0,
    workbookRuns: 0,
    firmwareMix: [],
    protocolMix: [],
    workbookMix: [],
    macroMix: [],
  },
  firmwareHistory: [],
  recentMeasurements: [],
};

function buildInput(overrides: Partial<BuildDeviceLineageInput> = {}): BuildDeviceLineageInput {
  return {
    device: createIotDeviceDetail({ thingName: "ambyte_GW-1" }),
    deviceLabel: "Gateway",
    monitoring: EMPTY_MONITORING,
    lastDataAt: null,
    boundExperiments: [],
    visibleExperiments: [],
    visibleProtocols: [],
    visibleWorkbooks: [],
    visibleMacros: [],
    locale: "en-US",
    labels: {
      privateExperiment: (index) => `private-experiment-${String(index)}`,
      privateProtocol: () => "private-protocol",
      privateWorkbook: () => "private-workbook",
      privateMacro: () => "private-macro",
    },
    ...overrides,
  };
}

function nodeById(model: { nodes: LineageNodeModel[] }, id: string): LineageNodeModel | undefined {
  return model.nodes.find((node) => node.id === id);
}

describe("buildDeviceLineage", () => {
  it("always renders the identity chain, even with no data", () => {
    const model = buildDeviceLineage(buildInput());

    expect(model.nodes.map((node) => node.id)).toEqual(["device", "broker", "warehouse"]);
    expect(model.edges.map((edge) => `${edge.source}->${edge.target}`)).toEqual([
      "device->broker",
      "broker->warehouse",
    ]);
    const broker = nodeById(model, "broker");
    expect(broker?.kind === "broker" && broker.thingName).toBe("ambyte_GW-1");
  });

  it("reports the firmware version with the newest lastSeen, not array order", () => {
    const model = buildDeviceLineage(
      buildInput({
        monitoring: {
          ...EMPTY_MONITORING,
          firmwareHistory: [
            {
              version: "1.1.0",
              firstSeen: "2026-08-06T00:00:00.000Z",
              lastSeen: "2026-08-09T00:00:00.000Z",
              count: 2,
            },
            {
              version: "1.0.0",
              firstSeen: "2026-08-01T00:00:00.000Z",
              lastSeen: "2026-08-05T00:00:00.000Z",
              count: 3,
            },
            // A null report never wins, even as the newest entry.
            {
              version: null,
              firstSeen: "2026-08-10T00:00:00.000Z",
              lastSeen: "2026-08-11T00:00:00.000Z",
              count: 1,
            },
          ],
        },
      }),
    );

    const device = nodeById(model, "device");
    expect(device?.kind === "device" && device.firmwareVersion).toBe("1.1.0");
  });

  it("classifies experiment edges: receiving, bound-but-silent, and unbound arrivals", () => {
    const model = buildDeviceLineage(
      buildInput({
        boundExperiments: [
          { id: EXPERIMENT_A, name: "Soil", status: "active", addedAt: "2026-08-01T00:00:00Z" },
          { id: EXPERIMENT_B, name: "Field", status: "active", addedAt: "2026-08-01T00:00:00Z" },
        ],
        monitoring: {
          ...EMPTY_MONITORING,
          throughput: [
            { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: EXPERIMENT_A, count: 5 },
            { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: EXPERIMENT_A, count: 7 },
            { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: EXPERIMENT_C, count: 2 },
          ],
        },
      }),
    );

    const states = new Map(model.edges.map((edge) => [edge.target, edge]));
    const receiving = states.get(`experiment:${EXPERIMENT_A}`);
    expect(receiving?.state).toBe("active");
    expect(receiving?.count).toBe(12);
    expect(receiving?.lastBucketAt).toBe("2026-08-13T02:00:00.000Z");
    expect(states.get(`experiment:${EXPERIMENT_B}`)?.state).toBe("silent");
    expect(states.get(`experiment:${EXPERIMENT_C}`)?.state).toBe("unbound");

    // Unbound arrival outside the viewer's lists stays opaque and unlinked.
    const stranger = nodeById(model, `experiment:${EXPERIMENT_C}`);
    expect(stranger?.kind === "experiment" && stranger.entity.label).toBe("private-experiment-1");
    expect(stranger?.kind === "experiment" && stranger.entity.href).toBeNull();

    // Bound experiments resolve by their binding name and link out.
    const bound = nodeById(model, `experiment:${EXPERIMENT_A}`);
    expect(bound?.kind === "experiment" && bound.entity.label).toBe("Soil");
    expect(bound?.kind === "experiment" && bound.entity.href).toContain(EXPERIMENT_A);
  });

  it("collects null-experiment rows into an unattributed node", () => {
    const model = buildDeviceLineage(
      buildInput({
        monitoring: {
          ...EMPTY_MONITORING,
          throughput: [
            { bucketStart: "2026-08-13T01:00:00.000Z", experimentId: null, count: 4 },
            { bucketStart: "2026-08-13T02:00:00.000Z", experimentId: null, count: 6 },
          ],
        },
      }),
    );

    const unattributed = nodeById(model, "unattributed");
    expect(unattributed?.kind === "unattributed" && unattributed.count).toBe(10);
    expect(model.edges.find((edge) => edge.target === "unattributed")?.state).toBe("unattributed");
  });

  it("fans attribution out of the warehouse, capping each kind and folding the rest", () => {
    const protocolMix = Array.from({ length: 5 }, (_, index) => ({
      protocolId: `aaaaaaa${String(index)}-1111-4111-8111-111111111111`,
      count: 10 - index,
    }));
    const model = buildDeviceLineage(
      buildInput({
        visibleProtocols: [{ id: protocolMix[0].protocolId, name: "PAR burst" }],
        visibleWorkbooks: [{ id: "cccccccc-1111-4111-8111-111111111111", name: "Field workbook" }],
        visibleMacros: [{ id: "bbbbbbbb-1111-4111-8111-111111111111", name: "SPAD macro" }],
        monitoring: {
          ...EMPTY_MONITORING,
          payload: {
            ...EMPTY_MONITORING.payload,
            protocolMix: [...protocolMix, { protocolId: null, count: 99 }],
            workbookMix: [
              { workbookVersionId: null, count: 3 },
              { workbookVersionId: "cccccccc-1111-4111-8111-111111111111", count: 4 },
            ],
            macroMix: [{ macroId: "bbbbbbbb-1111-4111-8111-111111111111", count: 2 }],
          },
        },
      }),
    );

    const protocolNodes = model.nodes.filter((node) => node.kind === "protocol");
    expect(protocolNodes).toHaveLength(3);
    expect(protocolNodes[0].kind === "protocol" && protocolNodes[0].entity.label).toBe("PAR burst");

    const other = nodeById(model, "protocol:other");
    expect(other?.kind === "attribution-other" && other.folded).toBe(2);
    expect(other?.kind === "attribution-other" && other.count).toBe(7 + 6);

    // Null buckets contribute nothing; resolvable ids link to their pages.
    const workbook = model.nodes.find((node) => node.kind === "workbook");
    expect(workbook?.kind === "workbook" && workbook.entity.href).toContain("/workbooks/");
    const macro = model.nodes.find((node) => node.kind === "macro");
    expect(macro?.kind === "macro" && macro.entity.href).toContain("/macros/");
  });
});
