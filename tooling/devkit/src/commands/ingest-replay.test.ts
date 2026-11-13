import { describe, expect, it, vi } from "vitest";

import type { ArchiveObject, ArchiveReader, StreamRecord, StreamWriter } from "../lib/aws.js";
import type { Warehouse } from "../lib/databricks.js";
import {
  bronzeProgressQuery,
  contentQuery,
  dayPrefixes,
  isComplete,
  messageFromRuleError,
  messageOf,
  parseArgs,
  recordIdQuery,
  sampleDigest,
  runReplay,
  utcMillis,
} from "./ingest-replay.js";
import type { ReplayArgs, ReplayDeps } from "./ingest-replay.js";

const experiment = "11111111-1111-4111-8111-111111111111";
const topic = `experiment/data_ingest/v1/${experiment}/multispeq/v1.0/protocol`;
const archiveStream = "open-jii-dev-iot-raw-archive";

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
    device: null,
    warehouse: "warehouse-1",
    awsProfile: "openjii-dev",
    databricksProfile: "dev",
    apply: false,
    ...overrides,
  };
}

type StoredObject = ArchiveObject & { text: string };

function archive(objects: StoredObject[]): ArchiveReader {
  return {
    list: vi.fn((prefix: string) =>
      Promise.resolve(objects.filter((object) => object.key.startsWith(prefix))),
    ),
    read: vi.fn((key: string) =>
      Promise.resolve(objects.find((object) => object.key === key)?.text ?? ""),
    ),
  };
}

function object(key: string, lines: string[], written = "2026-10-07T12:20:00Z"): StoredObject {
  return {
    key,
    lastModified: new Date(written),
    storageClass: "STANDARD",
    restoredUntil: null,
    text: lines.join("\n"),
  };
}

interface Bronze {
  recordIds?: string[];
  /** Rows without a record id: experiment, _client_id (null or empty), client, device, millis. */
  contentRows?: (string | null)[][];
  /** The latest arrival on bronze's slowest shard, in epoch milliseconds. */
  readUpTo?: string | null;
}

function warehouse(bronze: Bronze = {}): Warehouse {
  return {
    rows: vi.fn<Warehouse["rows"]>((statement) => {
      if (statement.includes("kinesis_shard_id")) {
        return Promise.resolve([[bronze.readUpTo ?? null]]);
      }
      if (statement.includes("SELECT DISTINCT _client_id")) {
        return Promise.resolve((bronze.recordIds ?? []).map((id) => [id]));
      }
      return Promise.resolve(bronze.contentRows ?? []);
    }),
  };
}

function stream(refuse: (record: StreamRecord, call: number) => boolean = () => false) {
  const sent: StreamRecord[] = [];
  let call = 0;
  const writer: StreamWriter = {
    put: vi.fn((records: StreamRecord[]) => {
      call += 1;
      sent.push(...records);
      return Promise.resolve(
        records.map((record) =>
          refuse(record, call)
            ? { sequenceNumber: null, error: "ProvisionedThroughputExceededException: slow down" }
            : { sequenceNumber: `seq-${record.partitionKey}`, error: null },
        ),
      );
    }),
  };
  return Object.assign(writer, { sent });
}

function deps(overrides: Partial<ReplayDeps> = {}): ReplayDeps {
  return {
    archive: archive([]),
    stream: stream(),
    warehouse: warehouse(),
    wait: vi.fn(() => Promise.resolve()),
    // Long after the window, so the stream no longer holds it.
    now: new Date("2026-10-20T00:00:00Z"),
    runId: "run-1",
    stop: new AbortController().signal,
    ...overrides,
  };
}

function manyMissing(count: number): string[] {
  return Array.from({ length: count }, (_, index) =>
    message({
      _client_id: `rec-${index}`,
      timestamp: new Date(Date.parse("2026-10-07T11:00:00Z") + index).toISOString(),
    }),
  );
}

describe("parseArgs", () => {
  const window = ["--from", "2026-10-07T12:00Z", "--to", "2026-10-07T13:00Z"];

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
      device: null,
      warehouse: "w",
      awsProfile: "openjii-prod",
      databricksProfile: "prod",
      apply: false,
    });
  });

  it("takes the arguments behind the `--` the root alias passes", () => {
    expect(parseArgs(["--", "dev", ...window, "--warehouse", "w"]).environment).toBe("dev");
  });

  it("takes a sensor's device id to narrow a replay to it", () => {
    expect(parseArgs(["dev", ...window, "--warehouse", "w", "--device", "MS-1"]).device).toBe(
      "MS-1",
    );
  });

  it("refuses a missing warehouse, a window that ends first, an unknown source or environment", () => {
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

  it("refuses an argument it does not know, so a misspelt filter cannot widen a replay", () => {
    expect(() =>
      parseArgs(["dev", ...window, "--warehouse", "w", "--experimnet", experiment, "--apply"]),
    ).toThrow("Unknown argument --experimnet");
  });
});

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

describe("dayPrefixes", () => {
  it("covers every UTC day the window touches", () => {
    expect(
      dayPrefixes("raw-iot", new Date("2026-10-30T23:00:00Z"), new Date("2026-11-01T01:00:00Z")),
    ).toEqual(["raw-iot/2026/10/30/", "raw-iot/2026/10/31/", "raw-iot/2026/11/01/"]);
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

describe("bronze lookups", () => {
  it("finds a record id in any experiment, parsed or not", () => {
    const query = recordIdQuery("t", ["a", "b"], "2026-10-06");

    expect(query.statement).not.toContain("experiment_id");
    expect(query.statement).not.toContain("parsed_data");
    expect(query.parameters).toEqual([
      { name: "since", value: "2026-10-06", type: "DATE" },
      { name: "record_0", value: "a" },
      { name: "record_1", value: "b" },
    ]);
  });

  it("matches content only on rows without a record id, at the exact milliseconds asked", () => {
    const query = contentQuery("t", [experiment], [1, 2], "2026-10-06");

    expect(query.statement).toContain("(_client_id IS NULL OR _client_id = '')");
    expect(query.statement).toContain("unix_millis(parsed_data.timestamp) IN (:time_0, :time_1)");
    expect(query.parameters).toContainEqual({ name: "time_1", value: "2", type: "BIGINT" });
  });

  it("measures bronze's progress on its slowest shard, among shards heard from in the retention", () => {
    const query = bronzeProgressQuery("t", Date.parse("2026-10-06T14:00:00Z"));

    expect(query.statement).toContain("SELECT unix_millis(min(latest))");
    expect(query.statement).toContain("GROUP BY kinesis_shard_id");
    expect(query.parameters).toEqual([
      { name: "since", value: "2026-10-06", type: "DATE" },
      { name: "retention_start", value: "2026-10-06T14:00:00.000Z", type: "TIMESTAMP" },
    ]);
  });
});

describe("runReplay", () => {
  const missing = message({ _client_id: "rec-missing", timestamp: "2026-10-07T11:00:00Z" });
  const inBronzeById = message({ _client_id: "rec-kept", timestamp: "2026-10-07T11:05:00Z" });
  const inBronzeEarly = message({ _client_id: "rec-early", timestamp: "2026-10-07T11:10:00Z" });
  const idlessInBronze = message({ timestamp: "2026-10-07T11:15:00Z" });
  const healthCheck = JSON.stringify({
    topic: "experiment/data_ingest/v1/healthcheck/healthcheck/1/dev",
    timestamp: "2026-10-07T12:00:00Z",
  });
  const noTime = message({ _client_id: "rec-no-time" });
  const bronze: Bronze = {
    recordIds: ["rec-kept"],
    contentRows: [
      // Written before bronze kept the record id.
      [experiment, null, "phone-1", "MS-1", String(Date.parse("2026-10-07T11:10:00Z"))],
      // A message that carried no record id.
      [experiment, "", "phone-1", "MS-1", String(Date.parse("2026-10-07T11:15:00Z"))],
    ],
  };

  it("decides each message in the window and sends nothing on a dry run", async () => {
    const reader = archive([
      object("raw-iot/2026/10/07/a.gz", [
        missing,
        inBronzeById,
        inBronzeEarly,
        idlessInBronze,
        "{bad",
        "",
        missing,
      ]),
      object("raw-iot/2026/10/07/b.gz", [healthCheck, noTime]),
      object("raw-iot/2026/10/07/before.gz", [missing], "2026-10-07T11:30:00Z"),
    ]);
    const lake = warehouse(bronze);
    const writer = stream();

    const manifest = await runReplay(
      args(),
      deps({ archive: reader, warehouse: lake, stream: writer }),
    );

    expect(manifest.counts).toEqual({
      "outside the filters": 0,
      unreadable: 1,
      missing: 1,
      "in bronze": 3,
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

    const [byRecord, byContent] = vi.mocked(lake.rows).mock.calls;
    expect(byRecord[0]).toContain("FROM open_jii_dev.centrum.raw_data");
    expect(byRecord[1]).toEqual([
      { name: "since", value: "2026-10-06", type: "DATE" },
      { name: "record_0", value: "rec-missing" },
      { name: "record_1", value: "rec-kept" },
      { name: "record_2", value: "rec-early" },
    ]);
    expect(byContent[1]).toContainEqual({ name: "experiment_0", value: experiment });
  });

  it("tells apart samples a device sent without record ids under one timestamp", async () => {
    const channel = (name: string) =>
      message({ timestamp: "2026-10-07T11:00:00Z", sample: [{ measure_id: 1, channel: name }] });
    const kept = [
      experiment,
      "",
      "phone-1",
      "MS-1",
      String(Date.parse("2026-10-07T11:00:00Z")),
      '[{"measure_id":1,"channel":"uart_1"}]',
    ];

    const manifest = await runReplay(
      args(),
      deps({
        archive: archive([
          object("raw-iot/2026/10/07/a.gz", [
            channel("uart_1"),
            channel("uart_2"),
            channel("uart_1"),
          ]),
        ]),
        warehouse: warehouse({ contentRows: [kept] }),
      }),
    );

    expect(manifest.entries.map((entry) => entry.decision)).toEqual([
      "in bronze",
      "missing",
      "repeated in the window",
    ]);
  });

  it("replays a record whose content matches another record bronze holds", async () => {
    const kept = message({ _client_id: "rec-1", timestamp: "2026-10-07T11:00:00Z" });
    const sameMoment = message({ _client_id: "rec-2", timestamp: "2026-10-07T11:00:00Z" });

    const manifest = await runReplay(
      args(),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", [kept, sameMoment])]),
        warehouse: warehouse({ recordIds: ["rec-1"] }),
      }),
    );

    expect(manifest.entries.map((entry) => [entry.recordId, entry.decision])).toEqual([
      ["rec-1", "in bronze"],
      ["rec-2", "missing"],
    ]);
  });

  it("asks bronze about a late upload at its own time rather than a range reaching back to it", async () => {
    const late = message({ _client_id: "rec-late", timestamp: "2026-09-16T08:00:00Z" });
    const lake = warehouse();

    await runReplay(
      args(),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", [missing, late])]),
        warehouse: lake,
      }),
    );

    const [, byContent] = vi.mocked(lake.rows).mock.calls;
    expect(byContent[1]).toEqual([
      { name: "since", value: "2026-09-15", type: "DATE" },
      { name: "experiment_0", value: experiment },
      { name: "time_0", value: String(Date.parse("2026-10-07T11:00:00Z")), type: "BIGINT" },
      { name: "time_1", value: String(Date.parse("2026-09-16T08:00:00Z")), type: "BIGINT" },
    ]);
  });

  it("looks no further back than 30 days before the window, whatever a device clock says", async () => {
    const epoch = message({ _client_id: "rec-epoch", timestamp: "1970-01-01T00:00:00Z" });
    const lake = warehouse();

    await runReplay(
      args(),
      deps({ archive: archive([object("raw-iot/2026/10/07/a.gz", [epoch])]), warehouse: lake }),
    );

    const [byRecord] = vi.mocked(lake.rows).mock.calls;
    expect(byRecord[1][0]).toEqual({ name: "since", value: "2026-09-07", type: "DATE" });
  });

  it("asks after no more large samples at once than the warehouse returns inline", async () => {
    const lake = warehouse();
    const large = Array.from({ length: 3 }, (_, index) =>
      message({
        timestamp: new Date(Date.parse("2026-10-07T11:00:00Z") + index).toISOString(),
        sample: "x".repeat(3 * 1024 * 1024),
      }),
    );

    await runReplay(
      args(),
      deps({ archive: archive([object("raw-iot/2026/10/07/a.gz", large)]), warehouse: lake }),
    );

    const contentLookups = vi
      .mocked(lake.rows)
      .mock.calls.filter(([statement]) => statement.includes("parsed_data.sample"));
    expect(contentLookups.map(([, parameters]) => parameters.length)).toEqual([4, 3]);
  });

  it("asks bronze about a thousand messages at a time", async () => {
    const lake = warehouse();

    const manifest = await runReplay(
      args(),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", manyMissing(1001))]),
        warehouse: lake,
      }),
    );

    const recordLookups = vi
      .mocked(lake.rows)
      .mock.calls.filter(([statement]) => statement.includes("SELECT DISTINCT _client_id"));
    expect(recordLookups.map(([, parameters]) => parameters.length)).toEqual([1001, 2]);
    expect(manifest.counts.missing).toBe(1001);
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

  it("keeps to one sensor when asked", async () => {
    const otherSensor = message({
      _client_id: "rec-2",
      device_id: "MS-2",
      timestamp: "2026-10-07T11:01:00Z",
    });

    const manifest = await runReplay(
      args({ device: "MS-1" }),
      deps({ archive: archive([object("raw-iot/2026/10/07/a.gz", [missing, otherSensor])]) }),
    );

    expect(manifest.counts).toEqual({ "outside the filters": 1, missing: 1 });
  });

  it("stops after the batch in hand when the operator stops it, and says so", async () => {
    const stop = new AbortController();
    const lake = warehouse();
    vi.mocked(lake.rows).mockImplementation(() => {
      stop.abort();
      return Promise.resolve([]);
    });

    const manifest = await runReplay(
      args(),
      deps({
        archive: archive([
          object("raw-iot/2026/10/07/a.gz", manyMissing(1000)),
          object("raw-iot/2026/10/07/b.gz", [missing]),
        ]),
        warehouse: lake,
        stop: stop.signal,
      }),
    );

    expect(manifest.counts.missing).toBe(1000);
    expect(manifest.stopped).toContain("stopped by the operator");
    expect(isComplete(manifest)).toBe(false);
  });

  it("sends the missing messages under their own partition keys, retrying a refused record", async () => {
    const writer = stream((record, call) => call === 1 && record.partitionKey.endsWith("/0"));
    const second = message({ _client_id: "rec-missing-2", timestamp: "2026-10-07T11:20:00Z" });
    const wait = vi.fn(() => Promise.resolve());

    const manifest = await runReplay(
      args({ apply: true }),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", [missing, second])]),
        stream: writer,
        wait,
      }),
    );

    expect(writer.sent.map((record) => record.partitionKey)).toEqual([
      "replay/run-1/0",
      "replay/run-1/1",
      "replay/run-1/0",
    ]);
    expect(writer.sent[0].data).toBe(missing);
    expect(wait.mock.calls).toEqual([[4000], [1000]]);
    expect(manifest.counts).toEqual(
      expect.objectContaining({ missing: 2, sent: 2, refused: 0, unknown: 0, "not sent": 0 }),
    );
    expect(manifest.entries.map((entry) => [entry.outcome, entry.sequenceNumber])).toEqual([
      ["sent", "seq-replay/run-1/0"],
      ["sent", "seq-replay/run-1/1"],
    ]);
    expect(isComplete(manifest)).toBe(true);
  });

  it("sends at most 250 records or 256 KiB a second", async () => {
    const writer = stream();
    const wait = vi.fn(() => Promise.resolve());

    await runReplay(
      args({ apply: true }),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", manyMissing(600))]),
        stream: writer,
        wait,
      }),
    );

    expect(vi.mocked(writer.put).mock.calls.map(([records]) => records.length)).toEqual([
      250, 250, 100,
    ]);
    expect(wait.mock.calls).toEqual([[1000], [1000]]);
  });

  it("splits large messages so no request passes 256 KiB", async () => {
    const writer = stream();
    const large = Array.from({ length: 3 }, (_, index) =>
      message({
        _client_id: `rec-large-${index}`,
        timestamp: "2026-10-07T11:00:00Z",
        padding: "x".repeat(100 * 1024),
      }),
    );

    await runReplay(
      args({ apply: true }),
      deps({ archive: archive([object("raw-iot/2026/10/07/a.gz", large)]), stream: writer }),
    );

    expect(vi.mocked(writer.put).mock.calls.map(([records]) => records.length)).toEqual([2, 1]);
  });

  it("reports a record Kinesis refused on every attempt, and fails the run", async () => {
    const manifest = await runReplay(
      args({ apply: true }),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", [missing])]),
        stream: stream(() => true),
      }),
    );

    expect(manifest.counts).toEqual(expect.objectContaining({ sent: 0, refused: 1 }));
    expect(manifest.entries[0].outcome).toBe("refused");
    expect(manifest.entries[0].error).toContain("slow down");
    expect(isComplete(manifest)).toBe(false);
  });

  it("still returns the manifest when a request fails after others went out", async () => {
    let call = 0;
    const writer: StreamWriter = {
      put: vi.fn((records: StreamRecord[]) => {
        call += 1;
        if (call === 2) {
          return Promise.reject(new Error("socket hang up"));
        }
        return Promise.resolve(
          records.map((record) => ({ sequenceNumber: `seq-${record.partitionKey}`, error: null })),
        );
      }),
    };

    const manifest = await runReplay(
      args({ apply: true }),
      deps({
        archive: archive([object("raw-iot/2026/10/07/a.gz", manyMissing(600))]),
        stream: writer,
      }),
    );

    expect(manifest.stopped).toBe("socket hang up");
    expect(manifest.counts).toEqual(
      expect.objectContaining({ sent: 250, unknown: 250, "not sent": 100 }),
    );
    expect(manifest.entries[250].outcome).toBe("unknown");
    expect(manifest.entries[250].error).toContain("may hold it");
    expect(isComplete(manifest)).toBe(false);
  });

  it("throws when bronze fails before anything was sent", async () => {
    const failing: Warehouse = { rows: () => Promise.reject(new Error("warehouse stopped")) };

    await expect(
      runReplay(
        args({ apply: true }),
        deps({
          archive: archive([object("raw-iot/2026/10/07/a.gz", [missing])]),
          warehouse: failing,
        }),
      ),
    ).rejects.toThrow("warehouse stopped");
  });

  it("reads the object Firehose wrote after midnight under the day before, and one finished late", async () => {
    const window = args({
      from: new Date("2026-10-08T00:00:00Z"),
      to: new Date("2026-10-08T01:00:00Z"),
    });
    const reader = archive([
      object("raw-iot/2026/10/07/straddling.gz", [missing], "2026-10-08T00:12:51Z"),
      object("raw-iot/2026/10/07/earlier.gz", [missing], "2026-10-07T23:58:00Z"),
      object("raw-iot/2026/10/08/late.gz", [missing], "2026-10-08T01:15:04Z"),
      object("raw-iot/2026/10/08/after.gz", [missing], "2026-10-08T01:25:00Z"),
    ]);

    await runReplay(window, deps({ archive: reader }));

    expect(vi.mocked(reader.read).mock.calls.map(([key]) => key)).toEqual([
      "raw-iot/2026/10/07/straddling.gz",
      "raw-iot/2026/10/08/late.gz",
    ]);
  });

  it("lists archived objects without reading them, and refuses to send until they are restored", async () => {
    const cold = { ...object("raw-iot/2026/10/07/cold.gz", [missing]), storageClass: "GLACIER" };
    const expired = { ...cold, restoredUntil: new Date("2026-10-19T00:00:00Z") };
    const reader = archive([cold]);

    const manifest = await runReplay(args(), deps({ archive: reader }));

    expect(manifest.restoreFirst).toEqual(["raw-iot/2026/10/07/cold.gz"]);
    expect(reader.read).not.toHaveBeenCalled();
    await expect(runReplay(args({ apply: true }), deps({ archive: reader }))).rejects.toThrow(
      "restore them",
    );
    await expect(
      runReplay(args({ apply: true }), deps({ archive: archive([expired]) })),
    ).rejects.toThrow("restore them");
  });

  it("reads and sends an archived object whose restore has finished", async () => {
    const restored = {
      ...object("raw-iot/2026/10/07/cold.gz", [missing]),
      storageClass: "DEEP_ARCHIVE",
      restoredUntil: new Date("2026-10-27T00:00:00Z"),
    };
    const writer = stream();

    const manifest = await runReplay(
      args({ apply: true }),
      deps({ archive: archive([restored]), stream: writer }),
    );

    expect(manifest.restoreFirst).toEqual([]);
    expect(writer.sent).toHaveLength(1);
  });

  describe("inside the stream's retention", () => {
    const now = new Date("2026-10-07T14:00:00Z");
    const window = (apply: boolean) => args({ apply });
    const reader = () => archive([object("raw-iot/2026/10/07/a.gz", [missing])]);
    const readTo = (time: string) => warehouse({ readUpTo: String(Date.parse(time)) });

    it("refuses to send until bronze has read past the newest object read", async () => {
      const behind = readTo("2026-10-07T12:15:00Z");

      await expect(
        runReplay(window(true), deps({ archive: reader(), warehouse: behind, now })),
      ).rejects.toThrow("may still hold messages of the objects read");
      await expect(
        runReplay(window(true), deps({ archive: reader(), warehouse: warehouse(), now })),
      ).rejects.toThrow("Bronze has read the stream up to nothing");

      const dryRun = await runReplay(
        window(false),
        deps({ archive: reader(), warehouse: behind, now }),
      );
      expect(dryRun.streamMayHold).toBe(true);
      expect(dryRun.bronzeReadUpTo).toBe("2026-10-07T12:15:00.000Z");
    });

    it("sends once bronze holds a message that arrived after the newest object", async () => {
      const writer = stream();

      const manifest = await runReplay(
        window(true),
        deps({
          archive: reader(),
          warehouse: readTo("2026-10-07T12:30:00Z"),
          stream: writer,
          now,
        }),
      );

      expect(manifest.streamMayHold).toBe(false);
      expect(writer.sent).toHaveLength(1);
    });

    it("waits for an object Firehose wrote after the window's end, whose messages it sends too", async () => {
      const late = archive([
        object("raw-iot/2026/10/07/late.gz", [missing], "2026-10-07T13:10:00Z"),
      ]);

      await expect(
        runReplay(
          window(true),
          deps({ archive: late, warehouse: readTo("2026-10-07T13:05:00Z"), now }),
        ),
      ).rejects.toThrow("arrived after 2026-10-07T13:11:00.000Z");
    });

    it("asks bronze nothing once the newest object is older than the stream's retention", async () => {
      const lake = warehouse();

      await runReplay(
        window(true),
        deps({ archive: reader(), warehouse: lake, now: new Date("2026-10-08T12:30:00Z") }),
      );

      const progress = vi
        .mocked(lake.rows)
        .mock.calls.filter(([statement]) => statement.includes("kinesis_shard_id"));
      expect(progress).toHaveLength(0);
    });

    it("skips the check for error objects, whose messages never entered the stream", async () => {
      const lake = warehouse();

      await runReplay(args({ source: "errors", apply: true }), deps({ warehouse: lake, now }));

      expect(lake.rows).not.toHaveBeenCalled();
    });
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
      object("iot-rule-errors/2026/10/07/2.json", [errorObject(archiveStream)]),
    ]);

    const manifest = await runReplay(args({ source: "errors" }), deps({ archive: reader }));

    expect(manifest.counts).toEqual({ "outside the filters": 0, "reached kinesis": 1, missing: 1 });
  });
});
