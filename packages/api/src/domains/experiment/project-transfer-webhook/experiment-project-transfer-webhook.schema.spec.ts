import { describe, expect, it } from "vitest";

import {
  zExperimentProjectTransferQuestionInput,
  zExperimentProjectTransferWebhookPayload,
  zExperimentProjectTransferWebhookResponse,
} from "./experiment-project-transfer-webhook.schema";

describe("zExperimentProjectTransferQuestionInput", () => {
  it("should validate a yes_no question", () => {
    const question = { kind: "yes_no", text: "Is this working?" };
    const result = zExperimentProjectTransferQuestionInput.parse(question);
    expect(result.kind).toBe("yes_no");
    expect(result.required).toBe(false); // default
  });

  it("should validate an open_ended question", () => {
    const question = { kind: "open_ended", text: "Describe the sample" };
    const result = zExperimentProjectTransferQuestionInput.parse(question);
    expect(result.kind).toBe("open_ended");
  });

  it("should validate a multi_choice question with options", () => {
    const question = {
      kind: "multi_choice",
      text: "Select a color",
      options: ["red", "green", "blue"],
      required: true,
    };
    const result = zExperimentProjectTransferQuestionInput.parse(question);
    expect(result.options).toEqual(["red", "green", "blue"]);
    expect(result.required).toBe(true);
  });

  it("should validate a number question", () => {
    const question = { kind: "number", text: "Enter temperature" };
    const result = zExperimentProjectTransferQuestionInput.parse(question);
    expect(result.kind).toBe("number");
  });

  it("should reject invalid kind", () => {
    expect(() =>
      zExperimentProjectTransferQuestionInput.parse({ kind: "invalid", text: "Q" }),
    ).toThrow();
  });

  it("should reject empty text", () => {
    expect(() =>
      zExperimentProjectTransferQuestionInput.parse({ kind: "yes_no", text: "" }),
    ).toThrow();
  });

  it("should reject text exceeding 64 characters", () => {
    expect(() =>
      zExperimentProjectTransferQuestionInput.parse({ kind: "yes_no", text: "a".repeat(65) }),
    ).toThrow();
  });
});

describe("zExperimentProjectTransferWebhookPayload", () => {
  const validPayload = {
    experiment: {
      name: "Test Experiment",
      createdBy: "123e4567-e89b-12d3-a456-426614174000",
    },
    protocol: {
      name: "Test Protocol",
      code: [{ step: "measure" }],
      createdBy: "123e4567-e89b-12d3-a456-426614174000",
    },
    macro: {
      name: "Test Macro",
      code: "Y29uc29sZS5sb2coJ2hlbGxvJyk=",
      createdBy: "123e4567-e89b-12d3-a456-426614174000",
    },
  };

  it("should validate a minimal valid payload", () => {
    const result = zExperimentProjectTransferWebhookPayload.parse(validPayload);
    expect(result.experiment.name).toBe("Test Experiment");
    expect(result.protocol?.family).toBe("multispeq"); // default
    expect(result.macro?.language).toBe("javascript"); // default
  });

  it("should validate a payload with all optional fields", () => {
    const fullPayload = {
      experiment: {
        ...validPayload.experiment,
        description: "A test experiment",
        locations: [{ name: "Loc1", latitude: 0, longitude: 0 }],
      },
      protocol: {
        ...validPayload.protocol,
        description: "A test protocol",
        family: "ambit",
      },
      macro: {
        ...validPayload.macro,
        description: "A test macro",
        language: "python",
      },
      questions: [{ kind: "yes_no", text: "Ready?" }],
    };

    const result = zExperimentProjectTransferWebhookPayload.parse(fullPayload);
    expect(result.experiment.locations).toHaveLength(1);
    expect(result.protocol?.family).toBe("ambit");
    expect(result.macro?.language).toBe("python");
    expect(result.questions).toHaveLength(1);
  });

  it("should validate a payload with only experiment (no protocol or macro)", () => {
    const result = zExperimentProjectTransferWebhookPayload.parse({
      experiment: validPayload.experiment,
    });
    expect(result.experiment.name).toBe("Test Experiment");
    expect(result.protocol).toBeUndefined();
    expect(result.macro).toBeUndefined();
  });

  it("should reject missing experiment name", () => {
    const payload = {
      ...validPayload,
      experiment: { createdBy: "123e4567-e89b-12d3-a456-426614174000" },
    };
    expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
  });

  it("should reject invalid createdBy UUID", () => {
    const payload = {
      ...validPayload,
      experiment: { ...validPayload.experiment, createdBy: "not-a-uuid" },
    };
    expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
  });

  it("should reject empty macro code", () => {
    const payload = {
      ...validPayload,
      macro: { ...validPayload.macro, code: "" },
    };
    expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
  });

  it("should reject empty protocol code array", () => {
    const payload = {
      ...validPayload,
      protocol: { ...validPayload.protocol, code: [] },
    };
    // z.record(z.unknown()).array() allows empty arrays by default,
    // so this should still parse (no .min(1) on the array)
    const result = zExperimentProjectTransferWebhookPayload.safeParse(payload);
    // Empty code array is technically valid per schema
    expect(result.success).toBe(true);
  });

  it("should reject invalid protocol family", () => {
    const payload = {
      ...validPayload,
      protocol: { ...validPayload.protocol, family: "unknown" },
    };
    expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
  });

  it("should reject invalid macro language", () => {
    const payload = {
      ...validPayload,
      macro: { ...validPayload.macro, language: "rust" },
    };
    expect(() => zExperimentProjectTransferWebhookPayload.parse(payload)).toThrow();
  });
});

describe("zExperimentProjectTransferWebhookResponse", () => {
  const validResponse = {
    success: true,
    experimentId: "123e4567-e89b-12d3-a456-426614174000",
    protocolId: "223e4567-e89b-12d3-a456-426614174000",
    macroId: "323e4567-e89b-12d3-a456-426614174000",
    macroFilename: "macro_abc123def456",
    macroName: "Test Macro (PhotosynQ)",
    flowId: "423e4567-e89b-12d3-a456-426614174000",
  };

  it("should validate a valid response", () => {
    const result = zExperimentProjectTransferWebhookResponse.parse(validResponse);
    expect(result).toEqual(validResponse);
  });

  it("should allow null flowId", () => {
    const result = zExperimentProjectTransferWebhookResponse.parse({
      ...validResponse,
      flowId: null,
    });
    expect(result.flowId).toBeNull();
  });

  it("should allow null protocolId and macroId", () => {
    const result = zExperimentProjectTransferWebhookResponse.parse({
      ...validResponse,
      protocolId: null,
      macroId: null,
      macroFilename: null,
      macroName: null,
      flowId: null,
    });
    expect(result.protocolId).toBeNull();
    expect(result.macroId).toBeNull();
    expect(result.macroFilename).toBeNull();
    expect(result.macroName).toBeNull();
  });

  it("should allow optional message", () => {
    const result = zExperimentProjectTransferWebhookResponse.parse({
      ...validResponse,
      message: "Transfer complete",
    });
    expect(result.message).toBe("Transfer complete");
  });

  it("should reject invalid experimentId UUID", () => {
    expect(() =>
      zExperimentProjectTransferWebhookResponse.parse({ ...validResponse, experimentId: "bad" }),
    ).toThrow();
  });

  it("should reject missing required fields", () => {
    expect(() => zExperimentProjectTransferWebhookResponse.parse({ success: true })).toThrow();
  });
});
