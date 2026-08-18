import { beforeEach, describe, expect, it, vi } from "vitest";

import { getMeasurementMqttTopic, QUESTIONS_PROTOCOL_ID } from "./measurement-topic";

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
