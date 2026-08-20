import type { Node } from "@xyflow/react";
import { describe, expect, it } from "vitest";

import type { LineageNodeModel } from "./build-device-lineage";
import { layoutLineage } from "./layout-lineage";

function node(model: LineageNodeModel): Node {
  return { id: model.id, type: "lineage", position: { x: 0, y: 0 }, data: { model } };
}

const DEVICE = node({
  id: "device",
  kind: "device",
  label: "Gateway",
  family: "ambyte",
  status: "active",
  firmwareVersion: null,
});
const BROKER = node({
  id: "broker",
  kind: "broker",
  thingName: "ambyte_GW-1",
  connectivity: null,
  uptimePercent: null,
  sessionCount: 0,
});
const WAREHOUSE = node({
  id: "warehouse",
  kind: "warehouse",
  totalMeasurements: 10,
  lastDataAt: null,
  withGps: 0,
  withBattery: 0,
  workbookRuns: 0,
});
const PROTOCOL = node({
  id: "protocol:p-1",
  kind: "protocol",
  entity: { id: "p-1", label: "PAR", href: null, accessible: false },
  count: 10,
});
const MACRO = node({
  id: "macro:m-1",
  kind: "macro",
  entity: { id: "m-1", label: "SPAD", href: null, accessible: false },
  count: 4,
});
const EXPERIMENT = node({
  id: "experiment:e-1",
  kind: "experiment",
  entity: { id: "e-1", label: "Soil", href: null, accessible: false },
  count: 10,
  lastBucketAt: null,
  bound: true,
});

function xById(nodes: Node[]): Record<string, number> {
  return Object.fromEntries(nodes.map((laid) => [laid.id, laid.position.x]));
}

describe("layoutLineage", () => {
  it("orders the pipeline left to right, with macros between warehouse and experiments", () => {
    const x = xById(layoutLineage([PROTOCOL, DEVICE, BROKER, WAREHOUSE, MACRO, EXPERIMENT]));

    expect(x["protocol:p-1"]).toBeLessThan(x.device);
    expect(x.device).toBeLessThan(x.broker);
    expect(x.broker).toBeLessThan(x.warehouse);
    // The point of the reshape: processing sits before the experiments it
    // precedes, instead of sharing their column.
    expect(x.warehouse).toBeLessThan(x["macro:m-1"]);
    expect(x["macro:m-1"]).toBeLessThan(x["experiment:e-1"]);
  });

  it("collapses the macro column when nothing was processed", () => {
    const withMacro = xById(layoutLineage([DEVICE, BROKER, WAREHOUSE, MACRO, EXPERIMENT]));
    const withoutMacro = xById(layoutLineage([DEVICE, BROKER, WAREHOUSE, EXPERIMENT]));

    expect(withoutMacro["experiment:e-1"]).toBeLessThan(withMacro["experiment:e-1"]);
    expect(withoutMacro["experiment:e-1"] - withoutMacro.warehouse).toBe(380);
  });

  it("puts folded inputs in the input column and folded macros in the macro column", () => {
    const foldedInputs = node({
      id: "protocol:other",
      kind: "attribution-other",
      attributionKind: "protocol",
      folded: 2,
      count: 5,
    });
    const foldedMacros = node({
      id: "macro:other",
      kind: "attribution-other",
      attributionKind: "macro",
      folded: 3,
      count: 6,
    });

    const x = xById(
      layoutLineage([foldedInputs, DEVICE, BROKER, WAREHOUSE, foldedMacros, EXPERIMENT]),
    );

    expect(x["protocol:other"]).toBeLessThan(x.device);
    expect(x["macro:other"]).toBeGreaterThan(x.warehouse);
    expect(x["macro:other"]).toBeLessThan(x["experiment:e-1"]);
  });

  it("stacks a column's nodes without overlapping and centres each column", () => {
    const second = node({
      id: "experiment:e-2",
      kind: "experiment",
      entity: { id: "e-2", label: "Field", href: null, accessible: false },
      count: 2,
      lastBucketAt: null,
      bound: false,
    });

    const laid = layoutLineage([DEVICE, BROKER, WAREHOUSE, EXPERIMENT, second]);
    const experiments = laid.filter((laidNode) => laidNode.id.startsWith("experiment:"));
    const device = laid.find((laidNode) => laidNode.id === "device");

    expect(experiments[0].position.y).not.toBe(experiments[1].position.y);
    expect(Math.abs(experiments[0].position.y - experiments[1].position.y)).toBeGreaterThanOrEqual(
      96,
    );
    // A single-node column sits between the two stacked ones.
    expect(device?.position.y).toBeGreaterThan(experiments[0].position.y);
    expect(device?.position.y).toBeLessThan(experiments[1].position.y);
  });
});
