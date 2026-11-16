import { createHash } from "node:crypto";

export type Source = "archive" | "errors";

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

export type Candidate = Message & { experimentId: string; timestampMs: number };

export type Content = Pick<
  Candidate,
  "experimentId" | "clientId" | "deviceId" | "timestampMs" | "sampleDigest"
>;

// Bronze's INGEST_TOPIC_EXPERIMENT_PATTERN and INGEST_HEALTHCHECK_EXPERIMENT_ID.
const EXPERIMENT_IN_TOPIC = /experiment\/data_ingest\/v1\/([^/]+)\//;
export const HEALTH_CHECK_EXPERIMENT = "healthcheck";

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

/** A time as UTC milliseconds; a time without a zone is read as UTC. */
export function utcMillis(value: unknown): number | null {
  if (typeof value !== "string") {
    return null;
  }
  const hasZone = /(?:[zZ]|[+-]\d{2}:?\d{2})$/.test(value);
  const millis = Date.parse(hasZone ? value : `${value}Z`);
  return Number.isNaN(millis) ? null : millis;
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
export function contentKey(content: Content): string {
  const { experimentId, clientId, deviceId, timestampMs } = content;
  return `${experimentId}|${clientId ?? ""}|${deviceId ?? ""}|${timestampMs}|${content.sampleDigest}`;
}

export function entryOf(message: Message, decision: Decision): Entry {
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

export function readObject(
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
export function isCandidate(message: Message): message is Candidate {
  return (
    message.experimentId !== null &&
    message.experimentId !== HEALTH_CHECK_EXPERIMENT &&
    message.timestampMs !== null
  );
}
