import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getMeasurementMqttTopic,
  parseMeasurementTopic,
  QUESTIONS_PROTOCOL_ID,
} from "./measurement-topic";

vi.mock("~/shared/stores/device-identity-store", () => ({
  getLocalThingName: () => "mobile_9f2c1a2e-1111-4111-8111-111111111111",
}));

let appVersion: string | null = "2.4.1";
vi.mock("expo-application", () => ({
  get nativeApplicationVersion() {
    return appVersion;
  },
}));

beforeEach(() => {
  appVersion = "2.4.1";
});

describe("getMeasurementMqttTopic", () => {
  it("builds the lean 7-segment topic with the phone's thing name as sensorId", () => {
    expect(getMeasurementMqttTopic({ experimentId: "experiment-42" })).toBe(
      "experiment/data_ingest/v1/experiment-42/mobile/2.4.1/mobile_9f2c1a2e-1111-4111-8111-111111111111",
    );
  });

  it("falls back to sensorVersion 0 when the app version is unknown", () => {
    appVersion = null;

    expect(getMeasurementMqttTopic({ experimentId: "experiment-42" })).toBe(
      "experiment/data_ingest/v1/experiment-42/mobile/0/mobile_9f2c1a2e-1111-4111-8111-111111111111",
    );
  });

  it("sanitizes topic-hostile characters out of the version segment", () => {
    appVersion = "2.4.1(beta)";

    expect(getMeasurementMqttTopic({ experimentId: "experiment-42" })).toContain("/2.4.1-beta-/");
  });

  it("keeps the questions sentinel exported for payload attribution", () => {
    // The lean topic carries no protocol segment; question-only uploads mark
    // themselves in the payload instead.
    expect(QUESTIONS_PROTOCOL_ID).toBe("questions");
  });
});

describe("parseMeasurementTopic", () => {
  it("recovers the ids a topic was built from", () => {
    const topic = getMeasurementMqttTopic({
      experimentId: "experiment-42",
      protocolId: "protocol-9",
    });

    expect(parseMeasurementTopic(topic)).toEqual({
      experimentId: "experiment-42",
      protocolId: "protocol-9",
    });
  });

  it("reads positions off the template, not a hardcoded layout", () => {
    expect(
      parseMeasurementTopic(
        "experiment/data_ingest/v1/exp-7/multispeq/v1.0/client-1/proto-3",
        "experiment/data_ingest/v1/:experimentId/multispeq/v1.0/:clientId/:protocolId",
      ),
    ).toEqual({ experimentId: "exp-7", protocolId: "proto-3" });
  });

  it("returns nothing for a topic that doesn't match the template shape", () => {
    expect(parseMeasurementTopic("some/other/topic")).toEqual({});
  });

  it("returns nothing for an empty segment rather than an empty id", () => {
    expect(
      parseMeasurementTopic("openjii/mobile-client-7/experiments//protocols/protocol-9"),
    ).toEqual({ experimentId: undefined, protocolId: "protocol-9" });
  });
});
