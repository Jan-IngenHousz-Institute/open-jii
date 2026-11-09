import { describe, expect, it, vi } from "vitest";

import type { ArchiveObject, ArchiveReader, StreamRecord, StreamWriter } from "../lib/aws.js";
import type { Warehouse } from "../lib/databricks.js";
import {
  dayPrefixes,
  messageFromRuleError,
  messageOf,
  parseArgs,
  runReplay,
  utcMillis,
} from "./ingest-replay.js";
import type { ReplayArgs } from "./ingest-replay.js";

const experiment = "11111111-1111-4111-8111-111111111111";
const topic = `experiment/data_ingest/v1/${experiment}/multispeq/v1.0/protocol`;

function message(fields: Record<string, unknown>): string {
  return JSON.stringify({ topic, client_id: "phone-1", device_id: "MS-1", ...fields });
}

function args(overrides: Partial<ReplayArgs> = {}): ReplayArgs {
  return {
    environment: "dev",
    from: new Date("2026-10-07T12:00:00Z"),
    to: new Date("2026-10-07T13:00:00Z"),
    source: "archive",
    experiment: null,
    client: null,
    warehouse: "warehouse-1",
    awsProfile: "openjii-dev",
    databricksProfile: "dev",
    apply: false,
    ...overrides,
  };
}

function archive(objects: (ArchiveObject & { text: string })[]): ArchiveReader {
  return {
    list: vi.fn((prefix: string) =>
      Promise.resolve(objects.filter((object) => object.key.startsWith(prefix))),
    ),
    read: vi.fn((key: string) =>
      Promise.resolve(objects.find((object) => object.key === key)?.text ?? ""),
    ),
  };
}

function object(key: string, lines: string[], written = "2026-10-07T12:20:00Z") {
  return { key, lastModified: new Date(written), storageClass: "STANDARD", text: lines.join("\n") };
}

function warehouse(rows: (string | null)[][] = []): Warehouse {
  return { rows: vi.fn<Warehouse["rows"]>().mockResolvedValue(rows) };
}

function stream(refuseFirst = 0): StreamWriter & { sent: StreamRecord[] } {
  let refusals = refuseFirst;
  const sent: StreamRecord[] = [];
  return {
    sent,
    put: vi.fn((records: StreamRecord[]) => {
      sent.push(...records);
      return Promise.resolve(
        records.map((record) => {
          if (refusals > 0) {
            refusals -= 1;
            return {
              sequenceNumber: null,
              error: "ProvisionedThroughputExceededException: slow down",
            };
          }
          return { sequenceNumber: `seq-${record.partitionKey}`, error: null };
        }),
      );
    }),
  };
}

const deps = (overrides: Partial<Parameters<typeof runReplay>[1]> = {}) => ({
  archive: archive([]),
  stream: stream(),
  warehouse: warehouse(),
  wait: () => Promise.resolve(),
  runId: "run-1",
  ...overrides,
});

describe("parseArgs", () => {
  it("takes the environment, a window and a warehouse, with profiles named after the environment", () => {
    expect(
      parseArgs([
        "prod",
        "--from",
        "2026-10-07T12:00",
        "--to",
        "2026-10-07T13:00Z",
        "--warehouse",
        "w",
      ]),
    ).toEqual({
      environment: "prod",
      from: new Date("2026-10-07T12:00:00Z"),
      to: new Date("2026-10-07T13:00:00Z"),
      source: "archive",
      experiment: null,
      client: null,
      warehouse: "w",
      awsProfile: "openjii-prod",
      databricksProfile: "prod",
      apply: false,
    });
  });

  it("takes the arguments behind the `--` the root alias passes", () => {
    expect(
      parseArgs([
        "--",
        "dev",
        "--from",
        "2026-10-07T12:00Z",
        "--to",
        "2026-10-07T13:00Z",
        "--warehouse",
        "w",
      ]).environment,
    ).toBe("dev");
  });

  it("refuses a missing warehouse, a window that ends first, an unknown source or environment", () => {
    const window = ["--from", "2026-10-07T12:00Z", "--to", "2026-10-07T13:00Z"];
    expect(() => parseArgs(["dev", ...window])).toThrow("--warehouse is required");
    expect(() =>
      parseArgs([
        "dev",
        "--from",
        "2026-10-07T13:00Z",
        "--to",
        "2026-10-07T12:00Z",
        "--warehouse",
        "w",
      ]),
    ).toThrow("--to must be after --from");
    expect(() => parseArgs(["dev", ...window, "--warehouse", "w", "--source", "kinesis"])).toThrow(
      "--source",
    );
    expect(() => parseArgs(["staging", ...window, "--warehouse", "w"])).toThrow("Usage");
  });
});

describe("utcMillis", () => {
  it("reads a time without a zone as UTC, as the pipeline does", () => {
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
});

describe("messageFromRuleError", () => {
  const payload = { device_id: "MS-1", timestamp: "2026-10-07T11:00:00Z", _client_id: "rec-1" };
  const errorObject = (failedResource: string) =>
    JSON.stringify({
      topic,
      clientId: "phone-1",
      base64OriginalPayload: Buffer.from(JSON.stringify(payload)).toString("base64"),
      failures: [{ failedAction: "Action", failedResource, errorMessage: "throttled" }],
    });

  it("rebuilds the message the rule sends when its Kinesis delivery failed", () => {
    const rebuilt = messageFromRuleError(
      "k",
      errorObject("open-jii-dev-data-ingest-stream"),
      "open-jii-dev-data-ingest-stream",
    );

    expect(rebuilt).toEqual(
      expect.objectContaining({ experimentId: experiment, recordId: "rec-1" }),
    );
    expect(rebuilt !== null && rebuilt !== "reached kinesis" && JSON.parse(rebuilt.data)).toEqual({
      topic,
      client_id: "phone-1",
      ...payload,
    });
  });

  it("says a message that failed only on the archive reached Kinesis", () => {
    expect(
      messageFromRuleError(
        "k",
        errorObject("open-jii-dev-iot-raw-archive"),
        "open-jii-dev-data-ingest-stream",
      ),
    ).toBe("reached kinesis");
  });
});

describe("dayPrefixes", () => {
  it("covers every UTC day the window touches", () => {
    expect(
      dayPrefixes("raw-iot", new Date("2026-10-30T23:00:00Z"), new Date("2026-11-01T01:00:00Z")),
    ).toEqual(["raw-iot/2026/10/30/", "raw-iot/2026/10/31/", "raw-iot/2026/11/01/"]);
  });
});

describe("runReplay", () => {
  const missing = message({ _client_id: "rec-missing", timestamp: "2026-10-07T11:00:00Z" });
  const inBronzeById = message({ _client_id: "rec-kept", timestamp: "2026-10-07T11:05:00Z" });
  const inBronzeByContent = message({ _client_id: "rec-old", timestamp: "2026-10-07T11:10:00Z" });
  const healthCheck = JSON.stringify({
    topic: "experiment/data_ingest/v1/healthcheck/healthcheck/1/dev",
    timestamp: "2026-10-07T12:00:00Z",
  });
  const noTime = message({ _client_id: "rec-no-time" });
  const bronzeRows: (string | null)[][] = [
    [experiment, "rec-kept", "phone-1", "MS-1", String(Date.parse("2026-10-07T11:05:00Z"))],
    // Written before bronze kept the record id, so only its content matches.
    [experiment, null, "phone-1", "MS-1", String(Date.parse("2026-10-07T11:10:00Z"))],
  ];

  it("decides each message in the window and sends nothing on a dry run", async () => {
    const reader = archive([
      object("raw-iot/2026/10/07/a.gz", [
        missing,
        inBronzeById,
        inBronzeByContent,
        "{bad",
        "",
        missing,
      ]),
      object("raw-iot/2026/10/07/b.gz", [healthCheck, noTime]),
      object("raw-iot/2026/10/07/before.gz", [missing], "2026-10-07T11:30:00Z"),
    ]);
    const lake = warehouse(bronzeRows);
    const writer = stream();

    const manifest = await runReplay(
      args(),
      deps({ archive: reader, warehouse: lake, stream: writer }),
    );

    expect(manifest.counts).toEqual({
      "outside the filters": 0,
      unreadable: 1,
      missing: 1,
      "in bronze": 2,
      "repeated in the window": 1,
      "health check": 1,
      "no timestamp": 1,
    });
    expect(reader.read).not.toHaveBeenCalledWith("raw-iot/2026/10/07/before.gz");
    expect(writer.put).not.toHaveBeenCalled();
    expect(manifest.entries.find((entry) => entry.decision === "missing")).toEqual(
      expect.objectContaining({
        object: "raw-iot/2026/10/07/a.gz",
        line: 1,
        recordId: "rec-missing",
      }),
    );
    const [statement, parameters] = vi.mocked(lake.rows).mock.calls[0];
    expect(statement).toContain("FROM open_jii_dev.centrum.raw_data");
    expect(parameters).toEqual([
      { name: "experiment_0", value: experiment },
      { name: "earliest", value: "2026-10-07T11:00:00.000Z", type: "TIMESTAMP" },
      { name: "latest", value: "2026-10-07T11:10:00.000Z", type: "TIMESTAMP" },
    ]);
  });

  it("keeps to one experiment or one client when asked", async () => {
    const other = JSON.stringify({
      topic: "experiment/data_ingest/v1/22222222-2222-4222-8222-222222222222/x/1/p",
      client_id: "phone-2",
      timestamp: "2026-10-07T11:00:00Z",
    });

    const manifest = await runReplay(
      args({ experiment }),
      deps({ archive: archive([object("raw-iot/2026/10/07/a.gz", [missing, other])]) }),
    );

    expect(manifest.counts).toEqual({ "outside the filters": 1, missing: 1 });
  });

  it("sends the missing messages under their own partition keys, retrying a refused record", async () => {
    const writer = stream(1);
    const second = message({ _client_id: "rec-missing-2", timestamp: "2026-10-07T11:20:00Z" });

    const manifest = await runReplay(
      args({ apply: true }),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", [missing, second])]),
        stream: writer,
      }),
    );

    expect(writer.put).toHaveBeenCalledTimes(2);
    expect(writer.sent.map((record) => record.partitionKey)).toEqual([
      "replay/run-1/0",
      "replay/run-1/1",
      "replay/run-1/0",
    ]);
    expect(writer.sent[0].data).toBe(missing);
    expect(manifest.counts).toEqual(expect.objectContaining({ missing: 2, sent: 2, refused: 0 }));
    expect(manifest.entries.map((entry) => entry.sequenceNumber)).toEqual([
      "seq-replay/run-1/0",
      "seq-replay/run-1/1",
    ]);
  });

  it("lists archived objects without reading them, and refuses to send until they are restored", async () => {
    const cold = { ...object("raw-iot/2026/10/07/cold.gz", [missing]), storageClass: "GLACIER" };
    const reader = archive([cold]);

    const manifest = await runReplay(args(), deps({ archive: reader }));

    expect(manifest.restoreFirst).toEqual(["raw-iot/2026/10/07/cold.gz"]);
    expect(reader.read).not.toHaveBeenCalled();
    await expect(runReplay(args({ apply: true }), deps({ archive: reader }))).rejects.toThrow(
      "restore them",
    );
  });

  it("reads the rule's error objects and replays only those that missed Kinesis", async () => {
    const errorObject = (failedResource: string) =>
      JSON.stringify({
        topic,
        clientId: "phone-1",
        base64OriginalPayload: Buffer.from(
          JSON.stringify({ device_id: "MS-1", timestamp: "2026-10-07T11:00:00Z", _client_id: "r" }),
        ).toString("base64"),
        failures: [{ failedResource }],
      });
    const reader = archive([
      object("iot-rule-errors/2026/10/07/1.json", [errorObject("open-jii-dev-data-ingest-stream")]),
      object("iot-rule-errors/2026/10/07/2.json", [errorObject("open-jii-dev-iot-raw-archive")]),
    ]);

    const manifest = await runReplay(args({ source: "errors" }), deps({ archive: reader }));

    expect(manifest.counts).toEqual({ "outside the filters": 0, "reached kinesis": 1, missing: 1 });
  });
});
