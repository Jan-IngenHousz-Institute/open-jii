import type { StreamWriter } from "./aws.js";
import type { StatementParameter, Warehouse } from "./databricks.js";
import {
  HEALTH_CHECK_EXPERIMENT,
  contentKey,
  entryOf,
  isCandidate,
  sampleDigest,
} from "./ingest-replay-messages.js";
import type { Candidate, Entry, Message } from "./ingest-replay-messages.js";

export interface Statement {
  statement: string;
  parameters: StatementParameter[];
}

/** What bronze holds of a lookup's messages. */
export interface BronzeHolding {
  recordIds: Set<string>;
  /** Content of rows bronze wrote before it kept the record id. */
  earlyContent: Set<string>;
  /** Content of rows whose message carried no record id. */
  idlessContent: Set<string>;
}

const DAY_MS = 86_400_000;

// Samples a content lookup asks after at once, well under the warehouse's 25 MiB inline result.
const CONTENT_LOOKUP_BYTES = 8 * 1024 * 1024;
// A copy ingested further back than this before the window is not looked for, which bounds the
// scan; a message whose only copy is older is sent again, and the runbook's query lists the copy.
const LOOKBACK_DAYS = 30;

function dayOf(millis: number): string {
  return new Date(millis).toISOString().slice(0, 10);
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

/** The latest arrival bronze holds from each shard it read since the stream's retention began. */
export function bronzeProgressQuery(table: string, retentionStartMs: number): Statement {
  return {
    statement: [
      "SELECT kinesis_shard_id, unix_millis(max(kinesis_arrival_time))",
      `FROM ${table}`,
      "WHERE ingest_date >= :since AND kinesis_arrival_time >= :retention_start",
      "GROUP BY kinesis_shard_id",
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

/** What bronze holds of these messages, looking back from the window's start. */
export async function lookUpBronze(
  candidates: Candidate[],
  from: Date,
  table: string,
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

  let earliest = from.getTime();
  for (const message of candidates) {
    earliest = Math.min(earliest, message.timestampMs);
  }
  // A copy is ingested after it is measured; the day before allows for a device clock running
  // ahead of the broker's.
  const floor = from.getTime() - LOOKBACK_DAYS * DAY_MS;
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

/** Each message's decision, and the missing ones to send, in the order they were read. */
export function decide(
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

export interface BronzeProgress {
  /** The latest arrival on bronze's slowest shard, or null while a shard has no row. */
  readUpTo: number | null;
  shardsNotInBronze: string[];
}

/**
 * How far bronze has read the stream: the latest arrival on its slowest shard. A shard with no row
 * since the retention began may be idle or unread, and nothing but bronze's rows can tell, so its
 * progress is unknown.
 */
export async function bronzeProgress(
  stream: StreamWriter,
  warehouse: Warehouse,
  table: string,
  retentionStartMs: number,
): Promise<BronzeProgress> {
  const shards = await stream.shardsInRetention();
  const query = bronzeProgressQuery(table, retentionStartMs);
  const rows = await warehouse.rows(query.statement, query.parameters);

  const latest = new Map<string, number>();
  for (const [shard, millis] of rows) {
    if (shard && millis) {
      latest.set(shard, Number(millis));
    }
  }
  const shardsNotInBronze = shards.filter((shard) => !latest.has(shard));
  const isEveryShardRead = latest.size > 0 && shardsNotInBronze.length === 0;

  return {
    readUpTo: isEveryShardRead ? Math.min(...latest.values()) : null,
    shardsNotInBronze,
  };
}
