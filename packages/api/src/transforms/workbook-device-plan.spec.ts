import { describe, expect, it } from "vitest";

import type { DeviceOnboardingConfig } from "../domains/iot/iot.schema";
import { applyPlanAnswers, compileDevicePlan } from "./workbook-device-plan";

const PROTOCOL_ID = "11111111-1111-4111-8111-111111111111";
const CODE = [{ _protocol_set: [{ label: "SoilMoisture", interval: 5 }] }];

const snapshots = {
  protocols: { [PROTOCOL_ID]: { code: CODE, family: "ambyte" as const } },
  macros: {},
};

const cells = [
  { id: "c-md", type: "markdown" as const, content: "## Steps", isCollapsed: false },
  {
    id: "c-q",
    type: "question" as const,
    name: "plot",
    question: {
      kind: "multi_choice" as const,
      text: "Which plot?",
      options: ["A1", "B1"],
      required: true,
    },
    isCollapsed: false,
    isAnswered: false,
  },
  {
    id: "c-cmd",
    type: "command" as const,
    payload: { format: "string" as const, content: "battery" },
    isCollapsed: false,
  },
  {
    id: "c-p",
    type: "protocol" as const,
    payload: { protocolId: PROTOCOL_ID, version: 1, name: "Soil Moisture" },
    isCollapsed: false,
  },
];

describe("compileDevicePlan", () => {
  it("projects actionable cells in order and drops the rest", () => {
    const plan = compileDevicePlan(cells, snapshots);

    expect(plan.missingProtocolIds).toEqual([]);
    expect(plan.procedures.map((p) => p.type)).toEqual(["question", "command", "protocol"]);
  });

  it("inlines the protocol snapshot code and family", () => {
    const plan = compileDevicePlan(cells, snapshots);

    expect(plan.procedures[2]).toEqual({
      type: "protocol",
      protocolId: PROTOCOL_ID,
      name: "Soil Moisture",
      family: "ambyte",
      code: CODE,
    });
  });

  it("projects questions with the pipeline column key and a null answer", () => {
    const plan = compileDevicePlan(cells, snapshots);

    expect(plan.procedures[0]).toEqual({
      type: "question",
      id: "c-q",
      name: "plot",
      kind: "multi_choice",
      text: "Which plot?",
      options: ["A1", "B1"],
      required: true,
      answer: null,
    });
  });

  it("carries an authoring-time answer when the cell has one", () => {
    const answered = [{ ...cells[1], answer: "A1" }];
    const plan = compileDevicePlan(answered, snapshots);

    expect(plan.procedures[0]).toMatchObject({ type: "question", answer: "A1" });
  });

  it("skips a protocol cell whose snapshot is missing and reports it", () => {
    const plan = compileDevicePlan(cells, { protocols: {}, macros: {} });

    expect(plan.procedures.map((p) => p.type)).toEqual(["question", "command"]);
    expect(plan.missingProtocolIds).toEqual([PROTOCOL_ID]);
  });
});

describe("applyPlanAnswers", () => {
  const config: DeviceOnboardingConfig = {
    thingName: "seed-ambyte-gw-01",
    deviceType: "ambyte",
    endpoint: "abc-ats.iot.eu-central-1.amazonaws.com",
    issuedAt: "2026-08-28T09:00:00.000Z",
    experiments: [
      {
        experimentId: "22222222-2222-4222-8222-222222222222",
        experimentName: "Corn",
        topicPrefix: "experiment/data_ingest/v1/22222222-2222-4222-8222-222222222222/ambyte",
        workbookVersion: 1,
        procedures: [
          {
            type: "question",
            id: "c-q",
            name: "plot",
            kind: "multi_choice",
            text: "Which plot?",
            options: ["A1", "B1"],
            required: true,
            answer: null,
          },
          { type: "command", format: "string", content: "battery" },
        ],
      },
    ],
  };

  it("fills answers by cell id without touching other procedures", () => {
    const delivered = applyPlanAnswers(config, { "c-q": "A1" });

    expect(delivered.experiments[0].procedures[0]).toMatchObject({ answer: "A1" });
    expect(delivered.experiments[0].procedures[1]).toEqual(config.experiments[0].procedures[1]);
  });

  it("leaves unanswered questions and the input config untouched", () => {
    const delivered = applyPlanAnswers(config, {});

    expect(delivered.experiments[0].procedures[0]).toMatchObject({ answer: null });
    expect(config.experiments[0].procedures[0]).toMatchObject({ answer: null });
    expect(delivered).not.toBe(config);
  });
});
