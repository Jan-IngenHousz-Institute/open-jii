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
  it("recovers the experiment id from a current lean topic", () => {
    const topic = getMeasurementMqttTopic({ experimentId: "experiment-42" });

    expect(parseMeasurementTopic(topic)).toEqual({ experimentId: "experiment-42" });
  });

  it("recovers the experiment id from a legacy templated topic", () => {
    // Rows stored by older app versions carry the pre-lean format; both put the
    // experiment id at segment 3 of the same prefix.
    expect(
      parseMeasurementTopic("experiment/data_ingest/v1/exp-7/multispeq/v1.0/client-1/proto-3"),
    ).toEqual({ experimentId: "exp-7" });
  });

  it("returns nothing for a topic this app never wrote", () => {
    expect(parseMeasurementTopic("some/other/topic")).toEqual({});
    // Same prefix, but the literal segments don't match the ingest channel.
    expect(parseMeasurementTopic("openjii/data_ingest/v1/exp-7/mobile/2.4.1/thing-1")).toEqual({});
  });

  it("returns undefined rather than an empty id for an empty segment", () => {
    expect(parseMeasurementTopic("experiment/data_ingest/v1//mobile/2.4.1/thing-1")).toEqual({
      experimentId: undefined,
    });
  });
});
