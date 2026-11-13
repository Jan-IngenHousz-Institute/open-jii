import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { optionAfter } from "../lib/args.js";
import { createArchiveReader, createStreamWriter } from "../lib/aws.js";
import type { ArchiveObject, ArchiveReader, StreamRecord, StreamWriter } from "../lib/aws.js";
import { pathFromRoot, repositoryRoot } from "../lib/config.js";
import { createWarehouse } from "../lib/databricks.js";
import type { StatementParameter, Warehouse } from "../lib/databricks.js";

type Environment = "dev" | "prod";
type Source = "archive" | "errors";

export interface ReplayArgs {
  environment: Environment;
  from: Date;
  to: Date;
  source: Source;
  experiment: string | null;
  client: string | null;
  device: string | null;
  warehouse: string;
  awsProfile: string;
  databricksProfile: string;
  apply: boolean;
}

/** One message the replay read, and what it decided. */
export type Decision =
  | "missing"
  | "in bronze"
  | "repeated in the window"
  | "reached kinesis"
  | "health check"
  | "no experiment in its topic"
  | "no timestamp"
  | "unreadable";

/** What became of a missing message under --apply. */
export type Outcome = "sent" | "refused" | "unknown" | "not sent";

export interface Message {
  object: string;
  line: number;
  data: string;
  experimentId: string | null;
  clientId: string | null;
  recordId: string | null;
  deviceId: string | null;
  timestampMs: number | null;
  sampleDigest: string;
  /** The sample's size as text, which bounds what a content lookup brings back. */
  sampleBytes: number;
}

export interface Entry {
  object: string;
  line: number;
  decision: Decision;
  experimentId: string | null;
  clientId: string | null;
  recordId: string | null;
  deviceId: string | null;
  timestamp: string | null;
  outcome?: Outcome;
  sequenceNumber?: string;
  error?: string;
}

export interface Manifest {
  run: string;
  environment: Environment;
  source: Source;
  from: string;
  to: string;
  experiment: string | null;
  client: string | null;
  device: string | null;
  applied: boolean;
  /** How far bronze had read the stream on its slowest shard, when the stream may still hold what was read. */
  bronzeReadUpTo: string | null;
  streamMayHold: boolean;
  restoreFirst: string[];
  stopped: string | null;
  counts: Record<string, number>;
  entries: Entry[];
}

export interface ReplayDeps {
  archive: ArchiveReader;
  stream: StreamWriter;
  warehouse: Warehouse;
  wait: (ms: number) => Promise<void>;
  now: Date;
  runId: string;
  /** Aborted when the operator stops the run; it then ends after the batch in hand. */
  stop: AbortSignal;
}

interface Statement {
  statement: string;
  parameters: StatementParameter[];
}

type Candidate = Message & { experimentId: string; timestampMs: number };

type Content = Pick<
  Candidate,
  "experimentId" | "clientId" | "deviceId" | "timestampMs" | "sampleDigest"
>;

/** What bronze holds of a lookup's messages. */
interface BronzeHolding {
  recordIds: Set<string>;
  /** Content of rows bronze wrote before it kept the record id. */
  earlyContent: Set<string>;
  /** Content of rows whose message carried no record id. */
  idlessContent: Set<string>;
}

const USAGE =
  "Usage: ingest:replay <dev|prod> --from <UTC time> --to <UTC time> --warehouse <id> " +
  "[--source archive|errors] [--experiment <id>] [--client <thing name>] [--device <device id>] " +
  "[--aws-profile <name>] [--databricks-profile <name>] [--apply]";
const VALUE_FLAGS = new Set([
  "--from",
  "--to",
  "--source",
  "--experiment",
  "--client",
  "--device",
  "--warehouse",
  "--aws-profile",
  "--databricks-profile",
]);

// Bronze's INGEST_TOPIC_EXPERIMENT_PATTERN and INGEST_HEALTHCHECK_EXPERIMENT_ID.
const EXPERIMENT_IN_TOPIC = /experiment\/data_ingest\/v1\/([^/]+)\//;
const HEALTH_CHECK_EXPERIMENT = "healthcheck";

// Firehose writes an object about 15 minutes after the first message it buffered, under that
// message's day, so the archive is listed this much wider than the window on both sides.
const ARCHIVE_MARGIN_MS = 20 * 60_000;
const ERRORS_MARGIN_MS = 5 * 60_000;
const BRONZE_CAUGHT_UP_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

// Objects read at once. Each can hold up to 128 MB once unzipped, Firehose's buffer.
const READ_CONCURRENCY = 4;
// The messages bronze is asked about at a time, which bounds each statement's parameters.
const LOOKUP_SIZE = 1000;
// Samples a content lookup asks after at once, well under the warehouse's 25 MiB inline result.
const CONTENT_LOOKUP_BYTES = 8 * 1024 * 1024;
// A copy ingested further back than this before the window is not looked for, which bounds the
// scan; a message whose only copy is older is sent again, and the runbook's query lists the copy.
const LOOKBACK_DAYS = 30;

// A quarter of a shard's write limit (1,000 records, 1 MiB a second), leaving live ingest the rest.
const BATCH_RECORDS = 250;
const BATCH_BYTES = 256 * 1024;
const BATCH_INTERVAL_MS = 1000;
const PUT_ATTEMPTS = 3;

// Objects in these classes have to be restored before they can be read.
const ARCHIVED_CLASSES = new Set(["GLACIER", "DEEP_ARCHIVE"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A field as bronze keeps it: text, or a number or flag written as text. */
function textOf(value: unknown): string | null {
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }
  return typeof value === "string" && value !== "" ? value : null;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** A time as UTC milliseconds; a time without a zone is read as UTC. */
export function utcMillis(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const millis = Date.parse(hasZone ? value : `${value}Z`);
  return Number.isNaN(millis) ? null : millis;
}

function dayOf(millis: number): string {
  return new Date(millis).toISOString().slice(0, 10);
}

function timeAfter(args: string[], flag: string): Date {
  const value = optionAfter(args, flag);
  if (value === null) {
    throw new Error(`${flag} is required. ${USAGE}`);
  }
  const millis = utcMillis(value);
  if (millis === null) {
    throw new Error(`${flag} is not a time: ${value}`);
  }
  return new Date(millis);
}

// A misspelt filter would otherwise widen what --apply sends.
function rejectUnknownArguments(args: string[]): void {
  let expectsValue = false;
  for (const arg of args.slice(1)) {
    if (expectsValue) {
      expectsValue = false;
    } else if (VALUE_FLAGS.has(arg)) {
      expectsValue = true;
    } else if (arg !== "--apply") {
      throw new Error(`Unknown argument ${arg}. ${USAGE}`);
    }
  }
}

export function parseArgs(given: string[]): ReplayArgs {
  // The root alias passes a `--` through ahead of the arguments.
  const args = given[0] === "--" ? given.slice(1) : given;
  const environment = args[0];
  if (environment !== "dev" && environment !== "prod") {
    throw new Error(USAGE);
  }
  rejectUnknownArguments(args);

  const from = timeAfter(args, "--from");
  const to = timeAfter(args, "--to");
  if (to <= from) {
    throw new Error("--to must be after --from");
  }

  const source = optionAfter(args, "--source") ?? "archive";
  if (source !== "archive" && source !== "errors") {
    throw new Error("--source is archive or errors");
  }

  const warehouse = optionAfter(args, "--warehouse");
  if (warehouse === null) {
    throw new Error(`--warehouse is required. ${USAGE}`);
  }

  return {
    environment,
    from,
    to,
    source,
    experiment: optionAfter(args, "--experiment"),
    client: optionAfter(args, "--client"),
    device: optionAfter(args, "--device"),
    warehouse,
    awsProfile: optionAfter(args, "--aws-profile") ?? `openjii-${environment}`,
    databricksProfile: optionAfter(args, "--databricks-profile") ?? environment,
    apply: args.includes("--apply"),
  };
}

/** Where an environment's rule streams and archives messages, as `infrastructure/env` names them. */
export function targetsOf(environment: Environment) {
  return {
    bucket: `open-jii-iot-raw-archive-${environment}`,
    stream: `open-jii-${environment}-data-ingest-stream`,
    archiveStream: `open-jii-${environment}-iot-raw-archive`,
    bronze: `open_jii_${environment}.centrum.raw_data`,
    retentionHours: environment === "prod" ? 72 : 24,
  };
}

/** A message as the IoT rule sends it to Kinesis, or null when it is not one. */
export function messageOf(object: string, line: number, data: string): Message | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(data);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.topic !== "string") {
    return null;
  }

  const sample = canonicalSample(parsed.sample);
  return {
    object,
    line,
    data,
    experimentId: EXPERIMENT_IN_TOPIC.exec(parsed.topic)?.[1] ?? null,
    clientId: textOf(parsed.client_id),
    recordId: textOf(parsed._client_id),
    deviceId: textOf(parsed.device_id),
    timestampMs: utcMillis(parsed.timestamp),
    sampleDigest: digestOf(sample),
    sampleBytes: Buffer.byteLength(sample),
  };
}

/**
 * The message one of the rule's error objects holds, rebuilt as the rule's SELECT writes it. Only
 * an object whose failures all name the archive's delivery stream reached Kinesis; any other leaves
 * the message to the bronze check.
 */
export function messageFromRuleError(
  object: string,
  text: string,
  archiveStream: string,
): Message | "reached kinesis" | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.base64OriginalPayload !== "string") {
    return null;
  }

  const failures: unknown[] = Array.isArray(parsed.failures) ? parsed.failures : [];
  const isArchiveOnly =
    failures.length > 0 &&
    failures.every((failure) => isRecord(failure) && failure.failedResource === archiveStream);
  if (isArchiveOnly) {
    return "reached kinesis";
  }

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parsed.base64OriginalPayload, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!isRecord(payload)) {
    return null;
  }
  // The broker's topic and client replace a payload's own fields of those names.
  return messageOf(
    object,
    1,
    JSON.stringify({ ...payload, topic: parsed.topic, client_id: parsed.clientId }),
  );
}

/**
 * A sample as one text however it was written. Bronze keeps `sample` as text and rewrites a JSON
 * one compactly, so both sides are parsed and written again before they are compared.
 */
function canonicalSample(value: unknown): string {
  if (value === null || value === undefined) {
    return "";
  }

  const text = typeof value === "string" ? value : JSON.stringify(value);
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === "object" && parsed !== null ? JSON.stringify(parsed) : text;
  } catch {
    // A sample that is not JSON is compared as written.
    return text;
  }
}

function digestOf(sample: string): string {
  return sample === "" ? "" : createHash("sha256").update(sample).digest("base64");
}

export function sampleDigest(value: unknown): string {
  return digestOf(canonicalSample(value));
}

/**
 * What tells one capture without a record id from another. A device can send several samples under
 * one timestamp, so the sample counts, as it does in silver's id.
 */
function contentKey(content: Content): string {
  const { experimentId, clientId, deviceId, timestampMs } = content;
  return `${experimentId}|${clientId ?? ""}|${deviceId ?? ""}|${timestampMs}|${content.sampleDigest}`;
}

function markers(prefix: string, count: number): string {
  return Array.from({ length: count }, (_, index) => `:${prefix}_${index}`).join(", ");
}

/**
 * Which of these record ids bronze holds, whatever the experiment and whether bronze could parse
 * the row. Bronze ingests a row after it is measured or published, which bounds the scan.
 */
export function recordIdQuery(table: string, recordIds: string[], since: string): Statement {
  return {
    statement: [
      "SELECT DISTINCT _client_id",
      `FROM ${table}`,
      "WHERE ingest_date >= :since",
      `  AND _client_id IN (${markers("record", recordIds.length)})`,
    ].join("\n"),
    parameters: [
      { name: "since", value: since, type: "DATE" },
      ...recordIds.map((id, index) => ({ name: `record_${index}`, value: id })),
    ],
  };
}

/** Bronze's rows without a record id, of these experiments, measured at these milliseconds. */
export function contentQuery(
  table: string,
  experimentIds: string[],
  times: number[],
  since: string,
): Statement {
  return {
    statement: [
      "SELECT experiment_id, _client_id, client_id, parsed_data.device_id,",
      "       unix_millis(parsed_data.timestamp), parsed_data.sample",
      `FROM ${table}`,
      "WHERE ingest_date >= :since",
      "  AND (_client_id IS NULL OR _client_id = '')",
      `  AND experiment_id IN (${markers("experiment", experimentIds.length)})`,
      `  AND unix_millis(parsed_data.timestamp) IN (${markers("time", times.length)})`,
    ].join("\n"),
    parameters: [
      { name: "since", value: since, type: "DATE" },
      ...experimentIds.map((id, index) => ({ name: `experiment_${index}`, value: id })),
      ...times.map((time, index) => ({
        name: `time_${index}`,
        value: String(time),
        type: "BIGINT",
      })),
    ],
  };
}

/**
 * How far bronze has read the stream: the latest arrival on its slowest shard, among the shards
 * that delivered anything since the retention began. A shard further behind than that has nothing
 * left in the stream to deliver twice.
 */
export function bronzeProgressQuery(table: string, retentionStartMs: number): Statement {
  return {
    statement: [
      "SELECT unix_millis(min(latest)) FROM (",
      "  SELECT kinesis_shard_id, max(kinesis_arrival_time) AS latest",
      `  FROM ${table}`,
      "  WHERE ingest_date >= :since AND kinesis_arrival_time >= :retention_start",
      "  GROUP BY kinesis_shard_id",
      ")",
    ].join("\n"),
    parameters: [
      { name: "since", value: dayOf(retentionStartMs), type: "DATE" },
      {
        name: "retention_start",
        value: new Date(retentionStartMs).toISOString(),
        type: "TIMESTAMP",
      },
    ],
  };
}

async function lookUpBronze(
  candidates: Candidate[],
  args: ReplayArgs,
  warehouse: Warehouse,
): Promise<BronzeHolding> {
  const holding: BronzeHolding = {
    recordIds: new Set(),
    earlyContent: new Set(),
    idlessContent: new Set(),
  };
  if (candidates.length === 0) {
    return holding;
  }

  const table = targetsOf(args.environment).bronze;
  let earliest = args.from.getTime();
  for (const message of candidates) {
    earliest = Math.min(earliest, message.timestampMs);
  }
  // A copy is ingested after it is measured; the day before allows for a device clock running
  // ahead of the broker's.
  const floor = args.from.getTime() - LOOKBACK_DAYS * DAY_MS;
  const since = dayOf(Math.max(earliest - DAY_MS, floor));

  const recordIds = [
    ...new Set(candidates.flatMap((message) => (message.recordId ? [message.recordId] : []))),
  ];
  if (recordIds.length > 0) {
    const byRecord = recordIdQuery(table, recordIds, since);
    for (const [recordId] of await warehouse.rows(byRecord.statement, byRecord.parameters)) {
      if (recordId) {
        holding.recordIds.add(recordId);
      }
    }
  }

  for (const group of bySampleSize(candidates)) {
    const experiments = [...new Set(group.map((message) => message.experimentId))];
    const times = [...new Set(group.map((message) => message.timestampMs))];
    const byContent = contentQuery(table, experiments, times, since);
    for (const row of await warehouse.rows(byContent.statement, byContent.parameters)) {
      addContent(holding, row);
    }
  }
  return holding;
}

/** Candidates in groups whose samples a content lookup can bring back in one result. */
function bySampleSize(candidates: Candidate[]): Candidate[][] {
  const groups: Candidate[][] = [];
  let group: Candidate[] = [];
  let bytes = 0;
  for (const candidate of candidates) {
    const isFull = group.length > 0 && bytes + candidate.sampleBytes > CONTENT_LOOKUP_BYTES;
    if (isFull) {
      groups.push(group);
      group = [];
      bytes = 0;
    }
    group.push(candidate);
    bytes += candidate.sampleBytes;
  }
  if (group.length > 0) {
    groups.push(group);
  }
  return groups;
}

function addContent(holding: BronzeHolding, row: (string | null)[]): void {
  const [experimentId, recordId, clientId, deviceId, millis, sample] = row;
  if (!experimentId || !millis) {
    return;
  }

  const key = contentKey({
    experimentId,
    clientId: clientId ?? null,
    deviceId: deviceId ?? null,
    timestampMs: Number(millis),
    sampleDigest: sampleDigest(sample),
  });
  if (recordId === null) {
    holding.earlyContent.add(key);
  } else {
    holding.idlessContent.add(key);
  }
}

/**
 * A message with a record id matches that id, or the content of a row bronze wrote before it kept
 * record ids. One without matches the content of a row that has none either.
 */
function isInBronze(message: Candidate, holding: BronzeHolding): boolean {
  const content = contentKey(message);
  if (message.recordId !== null) {
    return holding.recordIds.has(message.recordId) || holding.earlyContent.has(content);
  }
  return holding.earlyContent.has(content) || holding.idlessContent.has(content);
}

function entryOf(message: Message, decision: Decision): Entry {
  return {
    object: message.object,
    line: message.line,
    decision,
    experimentId: message.experimentId,
    clientId: message.clientId,
    recordId: message.recordId,
    deviceId: message.deviceId,
    timestamp: message.timestampMs === null ? null : new Date(message.timestampMs).toISOString(),
  };
}

/** An entry for something read that holds no message to send. */
function entryWithoutMessage(object: string, line: number, decision: Decision): Entry {
  return {
    object,
    line,
    decision,
    experimentId: null,
    clientId: null,
    recordId: null,
    deviceId: null,
    timestamp: null,
  };
}

/** The UTC day prefixes a window's objects sit under. */
export function dayPrefixes(root: string, from: Date, to: Date): string[] {
  const prefixes: string[] = [];
  const day = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  while (day <= to) {
    const month = String(day.getUTCMonth() + 1).padStart(2, "0");
    const date = String(day.getUTCDate()).padStart(2, "0");
    prefixes.push(`${root}/${day.getUTCFullYear()}/${month}/${date}/`);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return prefixes;
}

/** The objects written while the window's messages could still arrive in them. */
async function windowObjects(args: ReplayArgs, archive: ArchiveReader): Promise<ArchiveObject[]> {
  const isArchive = args.source === "archive";
  const root = isArchive ? "raw-iot" : "iot-rule-errors";
  const margin = isArchive ? ARCHIVE_MARGIN_MS : ERRORS_MARGIN_MS;
  const until = new Date(args.to.getTime() + margin);

  const objects: ArchiveObject[] = [];
  for (const prefix of dayPrefixes(root, new Date(args.from.getTime() - margin), until)) {
    objects.push(...(await archive.list(prefix)));
  }
  return objects.filter(
    (object) => object.lastModified >= args.from && object.lastModified <= until,
  );
}

function isArchived(object: ArchiveObject, now: Date): boolean {
  const isRestored = object.restoredUntil !== null && object.restoredUntil > now;
  return ARCHIVED_CLASSES.has(object.storageClass) && !isRestored;
}

function readObject(
  source: Source,
  key: string,
  text: string,
  archiveStream: string,
): { messages: Message[]; entries: Entry[] } {
  if (source === "errors") {
    const message = messageFromRuleError(key, text, archiveStream);
    if (message === null) {
      return { messages: [], entries: [entryWithoutMessage(key, 1, "unreadable")] };
    }
    if (message === "reached kinesis") {
      return { messages: [], entries: [entryWithoutMessage(key, 1, "reached kinesis")] };
    }
    return { messages: [message], entries: [] };
  }

  const messages: Message[] = [];
  const entries: Entry[] = [];
  text.split("\n").forEach((line, index) => {
    if (line.trim() === "") {
      return;
    }
    const message = messageOf(key, index + 1, line);
    if (message === null) {
      entries.push(entryWithoutMessage(key, index + 1, "unreadable"));
    } else {
      messages.push(message);
    }
  });
  return { messages, entries };
}

/** A message bronze could hold: one of an experiment, with a measurement time. */
function isCandidate(message: Message): message is Candidate {
  return (
    message.experimentId !== null &&
    message.experimentId !== HEALTH_CHECK_EXPERIMENT &&
    message.timestampMs !== null
  );
}

function isWithinFilters(args: ReplayArgs, message: Message): boolean {
  const isExperiment = args.experiment === null || message.experimentId === args.experiment;
  const isClient = args.client === null || message.clientId === args.client;
  const isDevice = args.device === null || message.deviceId === args.device;
  return isExperiment && isClient && isDevice;
}

/** Each message's decision, and the missing ones to send, in the order they were read. */
function decide(
  messages: Message[],
  holding: BronzeHolding,
  seen: Set<string>,
): { entries: Entry[]; missing: { message: Message; entry: Entry }[] } {
  const entries: Entry[] = [];
  const missing: { message: Message; entry: Entry }[] = [];

  for (const message of messages) {
    if (message.experimentId === HEALTH_CHECK_EXPERIMENT) {
      entries.push(entryOf(message, "health check"));
      continue;
    }
    if (message.experimentId === null) {
      entries.push(entryOf(message, "no experiment in its topic"));
      continue;
    }
    // Silver drops a measurement without a time, so sending it again would not land it.
    if (!isCandidate(message)) {
      entries.push(entryOf(message, "no timestamp"));
      continue;
    }

    const key =
      message.recordId === null ? `content|${contentKey(message)}` : `record|${message.recordId}`;
    if (seen.has(key)) {
      entries.push(entryOf(message, "repeated in the window"));
      continue;
    }
    seen.add(key);

    if (isInBronze(message, holding)) {
      entries.push(entryOf(message, "in bronze"));
      continue;
    }

    const entry = entryOf(message, "missing");
    entries.push(entry);
    missing.push({ message, entry });
  }
  return { entries, missing };
}

interface Outgoing {
  entry: Entry;
  record: StreamRecord;
}

function batches(items: Outgoing[]): Outgoing[][] {
  const result: Outgoing[][] = [];
  let current: Outgoing[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = Buffer.byteLength(item.record.data) + Buffer.byteLength(item.record.partitionKey);
    const isFull = current.length === BATCH_RECORDS || bytes + size > BATCH_BYTES;
    if (current.length > 0 && isFull) {
      result.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) {
    result.push(current);
  }
  return result;
}

/**
 * Sends missing messages a batch a second, retrying the records Kinesis refused. When a request
 * fails outright it notes which records it cannot vouch for and throws.
 */
function createSender(deps: ReplayDeps) {
  let nextKey = 0;
  let hasSent = false;

  async function put(batch: Outgoing[]): Promise<Outgoing[]> {
    if (hasSent) {
      await deps.wait(BATCH_INTERVAL_MS);
    }
    hasSent = true;

    const results = await deps.stream.put(batch.map(({ record }) => record));
    const refused: Outgoing[] = [];
    batch.forEach((item, index) => {
      const result = results[index];
      if (result.sequenceNumber) {
        item.entry.outcome = "sent";
        item.entry.sequenceNumber = result.sequenceNumber;
        delete item.entry.error;
      } else {
        item.entry.outcome = "refused";
        item.entry.error = result.error ?? "refused without a reason";
        refused.push(item);
      }
    });
    return refused;
  }

  async function send(missing: { message: Message; entry: Entry }[]): Promise<void> {
    let pending: Outgoing[] = missing.map(({ message, entry }) => ({
      entry,
      record: { data: message.data, partitionKey: `replay/${deps.runId}/${nextKey++}` },
    }));

    for (let attempt = 1; attempt <= PUT_ATTEMPTS && pending.length > 0; attempt += 1) {
      if (attempt > 1) {
        await deps.wait(1000 * 2 ** attempt);
      }
      const refused: Outgoing[] = [];
      for (const batch of batches(pending)) {
        try {
          refused.push(...(await put(batch)));
        } catch (error) {
          for (const item of batch) {
            item.entry.outcome = "unknown";
            item.entry.error = `the request failed, so Kinesis may hold it or not: ${errorText(error)}`;
          }
          for (const item of pending) {
            item.entry.outcome ??= "not sent";
          }
          throw error;
        }
      }
      pending = refused;
    }
  }

  return { send, hasSent: () => hasSent };
}

async function bronzeReadUpTo(
  deps: ReplayDeps,
  table: string,
  retentionStartMs: number,
): Promise<number | null> {
  const progress = bronzeProgressQuery(table, retentionStartMs);
  const [[millis] = []] = await deps.warehouse.rows(progress.statement, progress.parameters);
  return millis ? Number(millis) : null;
}

export async function runReplay(args: ReplayArgs, deps: ReplayDeps): Promise<Manifest> {
  const targets = targetsOf(args.environment);
  const objects = await windowObjects(args, deps.archive);
  const restoreFirst = objects
    .filter((object) => isArchived(object, deps.now))
    .map((object) => object.key);
  if (args.apply && restoreFirst.length > 0) {
    throw new Error(
      `${restoreFirst.length} objects in the window are archived; restore them, then run again`,
    );
  }

  // The stream may still hold messages of the objects read, for bronze to read later, and a replay
  // would then land them twice. Each message arrived before its object was written, so bronze has
  // to have read past the newest one. Only bronze's own rows show that: the stream's other reader
  // keeps reading while bronze's flow is down.
  const readable = objects.filter((object) => !isArchived(object, deps.now));
  let newestWrite = 0;
  for (const object of readable) {
    newestWrite = Math.max(newestWrite, object.lastModified.getTime());
  }
  const retentionStart = deps.now.getTime() - targets.retentionHours * HOUR_MS;
  const isInRetention = args.source === "archive" && newestWrite > retentionStart;
  const caughtUpAt = newestWrite + BRONZE_CAUGHT_UP_MS;
  const readUpTo = isInRetention
    ? await bronzeReadUpTo(deps, targets.bronze, retentionStart)
    : null;
  const streamMayHold = isInRetention && (readUpTo === null || readUpTo < caughtUpAt);
  if (args.apply && streamMayHold) {
    const readTo = readUpTo === null ? "nothing" : new Date(readUpTo).toISOString();
    throw new Error(
      `Bronze has read the stream up to ${readTo} on its slowest shard, so the stream may still ` +
        `hold messages of the objects read. Run again once bronze holds a message that arrived ` +
        `after ${new Date(caughtUpAt).toISOString()}, or once the newest object is older than ` +
        `the stream's ${targets.retentionHours} hours`,
    );
  }

  const entries: Entry[] = [];
  const missing: Entry[] = [];
  const seen = new Set<string>();
  const sender = createSender(deps);
  let outsideFilters = 0;
  let stopped: string | null = null;
  const isStopped = () => deps.stop.aborted;

  async function settle(messages: Message[]): Promise<void> {
    const kept = messages.filter((message) => isWithinFilters(args, message));
    outsideFilters += messages.length - kept.length;
    const holding = await lookUpBronze(kept.filter(isCandidate), args, deps.warehouse);
    const decided = decide(kept, holding, seen);
    for (const entry of decided.entries) {
      entries.push(entry);
    }
    for (const { entry } of decided.missing) {
      missing.push(entry);
    }
    if (args.apply) {
      await sender.send(decided.missing);
    }
  }

  try {
    const pending: Message[] = [];
    for (let start = 0; start < readable.length && !isStopped(); start += READ_CONCURRENCY) {
      const slice = readable.slice(start, start + READ_CONCURRENCY);
      const texts = await Promise.all(slice.map((object) => deps.archive.read(object.key)));
      slice.forEach((object, index) => {
        const read = readObject(args.source, object.key, texts[index], targets.archiveStream);
        for (const entry of read.entries) {
          entries.push(entry);
        }
        for (const message of read.messages) {
          pending.push(message);
        }
      });
      while (pending.length >= LOOKUP_SIZE && !isStopped()) {
        await settle(pending.splice(0, LOOKUP_SIZE));
      }
    }
    if (isStopped()) {
      stopped = "stopped by the operator; messages after the last batch are not in this manifest";
    } else {
      await settle(pending.splice(0));
    }
  } catch (error) {
    // Once anything may have reached the stream, the manifest has to say what.
    if (!sender.hasSent()) {
      throw error;
    }
    stopped = errorText(error);
  }

  const counts: Record<string, number> = { "outside the filters": outsideFilters };
  for (const entry of entries) {
    counts[entry.decision] = (counts[entry.decision] ?? 0) + 1;
  }
  if (args.apply) {
    for (const outcome of ["sent", "refused", "unknown", "not sent"] satisfies Outcome[]) {
      counts[outcome] = missing.filter((entry) => entry.outcome === outcome).length;
    }
  }

  return {
    run: deps.runId,
    environment: args.environment,
    source: args.source,
    from: args.from.toISOString(),
    to: args.to.toISOString(),
    experiment: args.experiment,
    client: args.client,
    device: args.device,
    applied: args.apply,
    bronzeReadUpTo: readUpTo === null ? null : new Date(readUpTo).toISOString(),
    streamMayHold,
    restoreFirst,
    stopped,
    counts,
    entries,
  };
}

/** Whether every missing message reached the stream. */
export function isComplete(manifest: Manifest): boolean {
  const unsent = ["refused", "unknown", "not sent"].reduce(
    (total, outcome) => total + (manifest.counts[outcome] ?? 0),
    0,
  );
  return manifest.stopped === null && unsent === 0;
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const targets = targetsOf(parsed.environment);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");
  process.stdout.write(`run: ${runId} (partition keys replay/${runId}/<n>)\n`);

  // The first Ctrl-C finishes the batch in hand and writes the manifest; a second one quits.
  const stop = new AbortController();
  process.once("SIGINT", () => {
    process.stdout.write("stopping after the batch in hand; press Ctrl-C again to quit at once\n");
    stop.abort();
    process.once("SIGINT", () => process.exit(130));
  });

  const manifest = await runReplay(parsed, {
    archive: createArchiveReader(targets.bucket, parsed.awsProfile),
    stream: createStreamWriter(targets.stream, parsed.awsProfile),
    warehouse: createWarehouse(parsed.databricksProfile, parsed.warehouse),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    now: new Date(),
    runId,
    stop: stop.signal,
  });

  // The manifest names devices and measurements, so it stays in the gitignored .claude folder.
  const path = pathFromRoot(
    `.claude/ingest-replays/${parsed.environment}-${runId}.json`,
    repositoryRoot(),
  );
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${JSON.stringify(manifest, null, 2)}\n`);

  for (const [decision, count] of Object.entries(manifest.counts)) {
    process.stdout.write(`${String(count).padStart(7)}  ${decision}\n`);
  }
  if (manifest.restoreFirst.length > 0) {
    process.stdout.write(
      `${manifest.restoreFirst.length} objects are archived and were not read; the runbook says how to restore them\n`,
    );
  }
  if (manifest.streamMayHold) {
    process.stdout.write(
      "bronze has not read past the objects read yet, so messages the stream still holds count as missing\n",
    );
  }
  if (manifest.stopped !== null) {
    process.stdout.write(`stopped: ${manifest.stopped}\n`);
  }
  process.stdout.write(`manifest: ${path}\n`);
  if (!parsed.apply) {
    process.stdout.write("dry run; pass --apply to send the missing messages\n");
  }
  return isComplete(manifest) ? 0 : 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
