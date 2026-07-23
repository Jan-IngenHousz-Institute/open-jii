import { describe, expect, it, vi } from "vitest";

import { getMeasurementMqttTopic, QUESTIONS_PROTOCOL_ID } from "./measurement-topic";

const values = {
  MQTT_TOPIC: "openjii/:clientId/experiments/:experimentId/protocols/:protocolId",
  CLIENT_ID: "mobile-client-7",
};

vi.mock("~/shared/stores/environment-store", () => ({
  getEnvVar: (key: keyof typeof values) => values[key],
}));

describe("getMeasurementMqttTopic", () => {
  it("preserves the normal measurement topic bytes", () => {
    expect(
      getMeasurementMqttTopic({ experimentId: "experiment-42", protocolId: "protocol-9" }),
    ).toBe("openjii/mobile-client-7/experiments/experiment-42/protocols/protocol-9");
  });

  it("preserves the question-only upload topic bytes", () => {
    expect(
      getMeasurementMqttTopic({
        experimentId: "experiment-42",
        protocolId: QUESTIONS_PROTOCOL_ID,
      }),
    ).toBe("openjii/mobile-client-7/experiments/experiment-42/protocols/questions");
  });
});
