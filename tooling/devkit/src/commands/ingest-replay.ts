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
  | "too large for one kinesis record"
  | "unreadable";

export interface Message {
  object: string;
  line: number;
  data: string;
  experimentId: string | null;
  clientId: string | null;
  recordId: string | null;
  deviceId: string | null;
  timestampMs: number | null;
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
  applied: boolean;
  restoreFirst: string[];
  counts: Record<string, number>;
  entries: Entry[];
}

export interface ReplayDeps {
  archive: ArchiveReader;
  stream: StreamWriter;
  warehouse: Warehouse;
  wait: (ms: number) => Promise<void>;
  runId: string;
}

const USAGE =
  "Usage: ingest:replay <dev|prod> --from <UTC time> --to <UTC time> --warehouse <id> " +
  "[--source archive|errors] [--experiment <id>] [--client <thing name>] " +
  "[--aws-profile <name>] [--databricks-profile <name>] [--apply]";

// Bronze's INGEST_TOPIC_EXPERIMENT_PATTERN.
const EXPERIMENT_IN_TOPIC = /experiment\/data_ingest\/v1\/([^/]+)\//;
const HEALTH_CHECK_EXPERIMENT = "healthcheck";
// Firehose writes an archive object up to 15 minutes after the first message it buffered.
const ARCHIVE_DELAY_MS = 15 * 60_000;
// Kinesis's limits: a record of 1 MiB, and 500 records or 5 MiB a call.
const MAX_RECORD_BYTES = 1024 * 1024;
const BATCH_RECORDS = 500;
const BATCH_BYTES = 5 * 1024 * 1024;
const PUT_ATTEMPTS = 3;
// Objects in these classes have to be restored before they can be read.
const ARCHIVED_CLASSES = new Set(["GLACIER", "DEEP_ARCHIVE"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function textOf(value: unknown): string | null {
  return typeof value === "string" && value !== "" ? value : null;
}

/** A time as UTC milliseconds; a time without a zone is read as UTC, as the pipeline reads it. */
export function utcMillis(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const millis = Date.parse(hasZone ? value : `${value}Z`);
  return Number.isNaN(millis) ? null : millis;
}

function timeAfter(args: string[], flag: string): Date {
  const value = optionAfter(args, flag);
  if (value === null) throw new Error(`${flag} is required. ${USAGE}`);
  const millis = utcMillis(value);
  if (millis === null) throw new Error(`${flag} is not a time: ${value}`);
  return new Date(millis);
}

export function parseArgs(given: string[]): ReplayArgs {
  // The root alias passes a `--` through ahead of the arguments.
  const args = given[0] === "--" ? given.slice(1) : given;
  const environment = args[0];
  if (environment !== "dev" && environment !== "prod") throw new Error(USAGE);

  const from = timeAfter(args, "--from");
  const to = timeAfter(args, "--to");
  if (to <= from) throw new Error("--to must be after --from");

  const source = optionAfter(args, "--source") ?? "archive";
  if (source !== "archive" && source !== "errors") {
    throw new Error("--source is archive or errors");
  }

  const warehouse = optionAfter(args, "--warehouse");
  if (warehouse === null) throw new Error(`--warehouse is required. ${USAGE}`);

  return {
    environment,
    from,
    to,
    source,
    experiment: optionAfter(args, "--experiment"),
    client: optionAfter(args, "--client"),
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
    bronze: `open_jii_${environment}.centrum.raw_data`,
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
  if (!isRecord(parsed) || typeof parsed.topic !== "string") return null;

  return {
    object,
    line,
    data,
    experimentId: EXPERIMENT_IN_TOPIC.exec(parsed.topic)?.[1] ?? null,
    clientId: textOf(parsed.client_id),
    recordId: textOf(parsed._client_id),
    deviceId: textOf(parsed.device_id),
    timestampMs: utcMillis(parsed.timestamp),
  };
}

/**
 * The message one of the rule's error objects holds, rebuilt as the rule's SELECT writes it, when
 * the Kinesis delivery failed. One whose failures name only the archive reached Kinesis.
 */
export function messageFromRuleError(
  object: string,
  text: string,
  stream: string,
): Message | "reached kinesis" | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(parsed) || typeof parsed.base64OriginalPayload !== "string") return null;

  const failures: unknown[] = Array.isArray(parsed.failures) ? parsed.failures : [];
  const missedKinesis = failures.some(
    (failure) => isRecord(failure) && failure.failedResource === stream,
  );
  if (!missedKinesis) return "reached kinesis";

  let payload: unknown;
  try {
    payload = JSON.parse(Buffer.from(parsed.base64OriginalPayload, "base64").toString("utf8"));
  } catch {
    return null;
  }
  if (!isRecord(payload)) return null;
  return messageOf(
    object,
    1,
    JSON.stringify({ topic: parsed.topic, client_id: parsed.clientId, ...payload }),
  );
}

function recordKey(experimentId: string, recordId: string): string {
  return `id|${experimentId}|${recordId}`;
}

function contentKey(
  experimentId: string,
  clientId: string | null,
  deviceId: string | null,
  timestampMs: number,
): string {
  return `content|${experimentId}|${clientId ?? ""}|${deviceId ?? ""}|${timestampMs}`;
}

/** The query for what bronze holds of these experiments between two measurement times. */
export function bronzeQuery(
  table: string,
  experimentIds: string[],
  earliestMs: number,
  latestMs: number,
): { statement: string; parameters: StatementParameter[] } {
  const markers = experimentIds.map((_, index) => `:experiment_${index}`).join(", ");
  return {
    statement: [
      "SELECT experiment_id, _client_id, client_id, parsed_data.device_id,",
      "       unix_millis(parsed_data.timestamp)",
      `FROM ${table}`,
      `WHERE experiment_id IN (${markers})`,
      "  AND parsed_data.timestamp BETWEEN :earliest AND :latest",
    ].join("\n"),
    parameters: [
      ...experimentIds.map((id, index) => ({ name: `experiment_${index}`, value: id })),
      { name: "earliest", value: new Date(earliestMs).toISOString(), type: "TIMESTAMP" },
      { name: "latest", value: new Date(latestMs).toISOString(), type: "TIMESTAMP" },
    ],
  };
}

/**
 * Both keys of every bronze row: the phone's record id when it sent one, and its content, so a
 * message also matches a row bronze wrote before it kept the record id.
 */
function bronzeKeys(rows: (string | null)[][]): Set<string> {
  const keys = new Set<string>();
  for (const [experimentId, recordId, clientId, deviceId, millis] of rows) {
    if (experimentId === null) continue;
    if (recordId) keys.add(recordKey(experimentId, recordId));
    if (millis)
      keys.add(contentKey(experimentId, clientId ?? null, deviceId ?? null, Number(millis)));
  }
  return keys;
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

async function windowObjects(args: ReplayArgs, archive: ArchiveReader): Promise<ArchiveObject[]> {
  const root = args.source === "archive" ? "raw-iot" : "iot-rule-errors";
  const until = new Date(args.to.getTime() + (args.source === "archive" ? ARCHIVE_DELAY_MS : 0));
  const objects: ArchiveObject[] = [];
  for (const prefix of dayPrefixes(root, args.from, until)) {
    objects.push(...(await archive.list(prefix)));
  }
  return objects.filter(
    (object) => object.lastModified >= args.from && object.lastModified <= until,
  );
}

async function readMessages(
  args: ReplayArgs,
  archive: ArchiveReader,
  objects: ArchiveObject[],
): Promise<{ messages: Message[]; entries: Entry[] }> {
  const messages: Message[] = [];
  const entries: Entry[] = [];
  const stream = targetsOf(args.environment).stream;

  for (const object of objects) {
    const text = await archive.read(object.key);
    if (args.source === "errors") {
      const message = messageFromRuleError(object.key, text, stream);
      if (message === null) entries.push(entryWithoutMessage(object.key, 1, "unreadable"));
      else if (message === "reached kinesis") {
        entries.push(entryWithoutMessage(object.key, 1, "reached kinesis"));
      } else messages.push(message);
      continue;
    }
    text.split("\n").forEach((line, index) => {
      if (line.trim() === "") return;
      const message = messageOf(object.key, index + 1, line);
      if (message === null) entries.push(entryWithoutMessage(object.key, index + 1, "unreadable"));
      else messages.push(message);
    });
  }
  return { messages, entries };
}

/** A message bronze could hold: one of an experiment, with a measurement time. */
function isCandidate(
  message: Message,
): message is Message & { experimentId: string; timestampMs: number } {
  return (
    message.experimentId !== null &&
    message.experimentId !== HEALTH_CHECK_EXPERIMENT &&
    message.timestampMs !== null
  );
}

function isWithinFilters(args: ReplayArgs, message: Message): boolean {
  const isExperiment = args.experiment === null || message.experimentId === args.experiment;
  const isClient = args.client === null || message.clientId === args.client;
  return isExperiment && isClient;
}

/** Each message's decision, and the missing ones to send, in the order they were read. */
function decide(
  messages: Message[],
  inBronze: Set<string>,
): { entries: Entry[]; missing: { message: Message; entry: Entry }[] } {
  const entries: Entry[] = [];
  const missing: { message: Message; entry: Entry }[] = [];
  const seen = new Set<string>();

  for (const message of messages) {
    const { experimentId, recordId, timestampMs } = message;
    if (experimentId === HEALTH_CHECK_EXPERIMENT) {
      entries.push(entryOf(message, "health check"));
      continue;
    }
    if (experimentId === null) {
      entries.push(entryOf(message, "no experiment in its topic"));
      continue;
    }
    // Silver drops a measurement without a time, so sending it again would not land it.
    if (timestampMs === null) {
      entries.push(entryOf(message, "no timestamp"));
      continue;
    }

    const byContent = contentKey(experimentId, message.clientId, message.deviceId, timestampMs);
    const byRecord = recordId === null ? null : recordKey(experimentId, recordId);
    const key = byRecord ?? byContent;
    if (seen.has(key)) {
      entries.push(entryOf(message, "repeated in the window"));
      continue;
    }
    seen.add(key);

    const isInBronze = (byRecord !== null && inBronze.has(byRecord)) || inBronze.has(byContent);
    if (isInBronze) {
      entries.push(entryOf(message, "in bronze"));
      continue;
    }
    if (Buffer.byteLength(message.data) > MAX_RECORD_BYTES) {
      entries.push(entryOf(message, "too large for one kinesis record"));
      continue;
    }

    const entry = entryOf(message, "missing");
    entries.push(entry);
    missing.push({ message, entry });
  }
  return { entries, missing };
}

function batches<T extends { record: StreamRecord }>(items: T[]): T[][] {
  const result: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const item of items) {
    const size = Buffer.byteLength(item.record.data) + Buffer.byteLength(item.record.partitionKey);
    if (current.length === BATCH_RECORDS || (current.length > 0 && bytes + size > BATCH_BYTES)) {
      result.push(current);
      current = [];
      bytes = 0;
    }
    current.push(item);
    bytes += size;
  }
  if (current.length > 0) result.push(current);
  return result;
}

/** Sends the missing messages, retrying the records Kinesis refused, and notes each outcome. */
async function send(
  missing: { message: Message; entry: Entry }[],
  deps: ReplayDeps,
): Promise<void> {
  let pending = missing.map(({ message, entry }, index) => ({
    entry,
    record: { data: message.data, partitionKey: `replay/${deps.runId}/${index}` },
  }));

  for (let attempt = 1; attempt <= PUT_ATTEMPTS && pending.length > 0; attempt += 1) {
    if (attempt > 1) await deps.wait(1000 * attempt);
    const refused: typeof pending = [];
    for (const batch of batches(pending)) {
      const results = await deps.stream.put(batch.map(({ record }) => record));
      batch.forEach((item, index) => {
        const result = results[index];
        if (result.sequenceNumber) {
          item.entry.sequenceNumber = result.sequenceNumber;
          delete item.entry.error;
        } else {
          item.entry.error = result.error ?? "refused without a reason";
          refused.push(item);
        }
      });
    }
    pending = refused;
  }
}

export async function runReplay(args: ReplayArgs, deps: ReplayDeps): Promise<Manifest> {
  const objects = await windowObjects(args, deps.archive);
  const restoreFirst = objects
    .filter((object) => ARCHIVED_CLASSES.has(object.storageClass))
    .map((object) => object.key);
  if (args.apply && restoreFirst.length > 0) {
    throw new Error(
      `${restoreFirst.length} objects in the window are archived; restore them, then run again`,
    );
  }

  const readable = objects.filter((object) => !ARCHIVED_CLASSES.has(object.storageClass));
  const read = await readMessages(args, deps.archive, readable);
  const messages = read.messages.filter((message) => isWithinFilters(args, message));

  const candidates = messages.filter(isCandidate);
  let inBronze = new Set<string>();
  if (candidates.length > 0) {
    const experiments = [...new Set(candidates.map((message) => message.experimentId))];
    const times = candidates.map((message) => message.timestampMs);
    const query = bronzeQuery(
      targetsOf(args.environment).bronze,
      experiments,
      Math.min(...times),
      Math.max(...times),
    );
    inBronze = bronzeKeys(await deps.warehouse.rows(query.statement, query.parameters));
  }

  const decided = decide(messages, inBronze);
  if (args.apply) await send(decided.missing, deps);

  const entries = [...read.entries, ...decided.entries];
  const counts: Record<string, number> = {
    "outside the filters": read.messages.length - messages.length,
  };
  for (const entry of entries) counts[entry.decision] = (counts[entry.decision] ?? 0) + 1;
  if (args.apply) {
    counts.sent = decided.missing.filter(({ entry }) => entry.sequenceNumber).length;
    counts.refused = decided.missing.length - counts.sent;
  }

  return {
    run: deps.runId,
    environment: args.environment,
    source: args.source,
    from: args.from.toISOString(),
    to: args.to.toISOString(),
    experiment: args.experiment,
    client: args.client,
    applied: args.apply,
    restoreFirst,
    counts,
    entries,
  };
}

async function run(args: string[]): Promise<number> {
  const parsed = parseArgs(args);
  const targets = targetsOf(parsed.environment);
  const runId = new Date().toISOString().replace(/[:.]/g, "-");

  const manifest = await runReplay(parsed, {
    archive: createArchiveReader(targets.bucket, parsed.awsProfile),
    stream: createStreamWriter(targets.stream, parsed.awsProfile),
    warehouse: createWarehouse(parsed.databricksProfile, parsed.warehouse),
    wait: (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
    runId,
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
  process.stdout.write(`manifest: ${path}\n`);
  if (!parsed.apply) process.stdout.write("dry run; pass --apply to send the missing messages\n");
  return manifest.counts.refused ? 1 : 0;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
