import { describe, expect, it } from "vitest";

import {
  messageFromRuleError,
  messageOf,
  sampleDigest,
  utcMillis,
} from "./ingest-replay-messages.js";

const experiment = "11111111-1111-4111-8111-111111111111";
const topic = `experiment/data_ingest/v1/${experiment}/multispeq/v1.0/protocol`;
const archiveStream = "open-jii-dev-iot-raw-archive";

function message(fields: Record<string, unknown>): string {
  return JSON.stringify({ topic, client_id: "phone-1", device_id: "MS-1", ...fields });
}

describe("utcMillis", () => {
  it("reads a time without a zone as UTC", () => {
    expect(utcMillis("2026-10-07T12:00:00")).toBe(Date.parse("2026-10-07T12:00:00Z"));
    expect(utcMillis("2026-10-07T14:00:00+02:00")).toBe(Date.parse("2026-10-07T12:00:00Z"));
    expect(utcMillis("not a time")).toBeNull();
  });
});

describe("messageOf", () => {
  it("reads the experiment from the topic and the ids and time from the payload", () => {
    expect(
      messageOf("k", 3, message({ _client_id: "rec-1", timestamp: "2026-10-07T11:00:00Z" })),
    ).toEqual(
      expect.objectContaining({
        object: "k",
        line: 3,
        experimentId: experiment,
        clientId: "phone-1",
        recordId: "rec-1",
        deviceId: "MS-1",
        timestampMs: Date.parse("2026-10-07T11:00:00Z"),
      }),
    );
    expect(messageOf("k", 1, "{not json")).toBeNull();
    expect(messageOf("k", 1, JSON.stringify({ device_id: "MS-1" }))).toBeNull();
  });

  it("reads a numeric id as the text bronze keeps of it", () => {
    const numeric = messageOf("k", 1, message({ device_id: 4021, timestamp: "2026-10-07T11:00Z" }));

    expect(numeric?.deviceId).toBe("4021");
  });
});

describe("messageFromRuleError", () => {
  const payload = { device_id: "MS-1", timestamp: "2026-10-07T11:00:00Z", _client_id: "rec-1" };
  const errorObject = (failedResources: string[], body: Record<string, unknown> = payload) =>
    JSON.stringify({
      topic,
      clientId: "phone-1",
      base64OriginalPayload: Buffer.from(JSON.stringify(body)).toString("base64"),
      failures: failedResources.map((failedResource) => ({
        failedAction: "Action",
        failedResource,
        errorMessage: "throttled",
      })),
    });

  it("rebuilds the message the rule sends when its Kinesis delivery failed", () => {
    const rebuilt = messageFromRuleError(
      "k",
      errorObject(["open-jii-dev-data-ingest-stream"]),
      archiveStream,
    );

    expect(rebuilt).toEqual(
      expect.objectContaining({ experimentId: experiment, recordId: "rec-1" }),
    );
    expect(rebuilt !== null && rebuilt !== "reached kinesis" && JSON.parse(rebuilt.data)).toEqual({
      ...payload,
      topic,
      client_id: "phone-1",
    });
  });

  it("keeps the broker's topic and client over a payload's own fields of those names", () => {
    const rebuilt = messageFromRuleError(
      "k",
      errorObject(["open-jii-dev-data-ingest-stream"], { ...payload, client_id: "other-thing" }),
      archiveStream,
    );

    expect(rebuilt).toEqual(expect.objectContaining({ clientId: "phone-1" }));
  });

  it("says only a message that failed on the archive alone reached Kinesis", () => {
    expect(messageFromRuleError("k", errorObject([archiveStream]), archiveStream)).toBe(
      "reached kinesis",
    );
    expect(
      messageFromRuleError(
        "k",
        errorObject([archiveStream, "arn:aws:kinesis:eu-central-1:1:stream/x"]),
        archiveStream,
      ),
    ).toEqual(expect.objectContaining({ recordId: "rec-1" }));
    expect(messageFromRuleError("k", errorObject([]), archiveStream)).toEqual(
      expect.objectContaining({ recordId: "rec-1" }),
    );
  });
});

describe("sampleDigest", () => {
  it("matches a payload's JSON sample with bronze's compact text of it", () => {
    const sample = [{ measure_id: 221132, channel: "uart_2", values: [0.0001, 2.5] }];

    expect(sampleDigest(sample)).toBe(sampleDigest(JSON.stringify(sample)));
    expect(sampleDigest(sample)).toBe(sampleDigest(JSON.stringify(sample, null, 2)));
    expect(sampleDigest("raw text")).toBe(sampleDigest("raw text"));
    expect(sampleDigest(sample)).not.toBe(sampleDigest([{ ...sample[0], channel: "uart_3" }]));
    expect(sampleDigest(null)).toBe("");
  });
});
