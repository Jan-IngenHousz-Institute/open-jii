import { describe, it, expect } from "vitest";

import {
  zExperimentFlowNode,
  zExperimentMeasurementCommandContent,
  zExperimentMeasurementContent,
} from "./experiment.schema";

const uuid = "11111111-1111-1111-1111-111111111111";

function measurementNode(content: unknown) {
  return zExperimentFlowNode.safeParse({
    id: "n1",
    type: "measurement",
    name: "n1",
    content,
    isStart: true,
  });
}

describe("measurement carrier mutual exclusivity", () => {
  it("accepts a pure protocol measurement content", () => {
    expect(zExperimentMeasurementContent.safeParse({ protocolId: uuid }).success).toBe(true);
    expect(measurementNode({ protocolId: uuid }).success).toBe(true);
  });

  it("accepts a pure static command carrier", () => {
    expect(
      zExperimentMeasurementCommandContent.safeParse({
        command: { format: "string", content: "battery" },
      }).success,
    ).toBe(true);
    expect(measurementNode({ command: { format: "string", content: "battery" } }).success).toBe(
      true,
    );
  });

  it("accepts a pure ref command carrier", () => {
    expect(
      measurementNode({ command: { kind: "ref", ref: { sourceCellId: "m1", field: "f" } } })
        .success,
    ).toBe(true);
  });

  it("rejects protocol + static command", () => {
    expect(
      measurementNode({ protocolId: uuid, command: { format: "string", content: "battery" } })
        .success,
    ).toBe(false);
  });

  it("rejects protocol + ref command", () => {
    expect(
      measurementNode({
        protocolId: uuid,
        command: { kind: "ref", ref: { sourceCellId: "m1", field: "f" } },
      }).success,
    ).toBe(false);
  });

  it("rejects a command carrier with an extra protocolId key (strict)", () => {
    expect(
      zExperimentMeasurementCommandContent.safeParse({
        command: { format: "string", content: "battery" },
        protocolId: uuid,
      }).success,
    ).toBe(false);
  });

  it("rejects a protocol carrier with an extra command key (strict)", () => {
    expect(
      zExperimentMeasurementContent.safeParse({
        protocolId: uuid,
        command: { format: "string", content: "battery" },
      }).success,
    ).toBe(false);
  });
});
