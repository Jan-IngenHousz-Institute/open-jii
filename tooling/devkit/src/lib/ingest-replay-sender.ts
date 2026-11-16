import type { StreamRecord, StreamWriter } from "./aws.js";
import type { Entry, Message } from "./ingest-replay-messages.js";

// A quarter of a shard's write limit (1,000 records, 1 MiB a second), leaving live ingest the rest.
const BATCH_RECORDS = 250;
const BATCH_BYTES = 256 * 1024;
const BATCH_INTERVAL_MS = 1000;
const PUT_ATTEMPTS = 3;

interface Outgoing {
  entry: Entry;
  record: StreamRecord;
}

export interface SenderDeps {
  stream: StreamWriter;
  wait: (ms: number) => Promise<void>;
  runId: string;
  /** Aborted when the operator stops the run; it then ends after the batch in hand. */
  stop: AbortSignal;
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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
 * fails outright it notes which records it cannot vouch for and throws. Once the operator stops the
 * run it sends no further batch and marks the rest not sent.
 */
export class StreamSender {
  private nextKey = 0;
  private hasRequested = false;
  private isCut = false;

  constructor(private readonly deps: SenderDeps) {}

  /** Whether any request went out, so Kinesis may hold some of the records. */
  get hasSent(): boolean {
    return this.hasRequested;
  }

  /** Whether a stop left missing messages unsent. */
  get wasCut(): boolean {
    return this.isCut;
  }

  async send(missing: { message: Message; entry: Entry }[]): Promise<void> {
    let pending: Outgoing[] = missing.map(({ message, entry }) => ({
      entry,
      record: { data: message.data, partitionKey: `replay/${this.deps.runId}/${this.nextKey++}` },
    }));

    for (let attempt = 1; attempt <= PUT_ATTEMPTS && pending.length > 0; attempt += 1) {
      if (attempt > 1) {
        await this.deps.wait(1000 * 2 ** attempt);
      }
      const refused: Outgoing[] = [];
      for (const batch of batches(pending)) {
        if (this.hasRequested) {
          await this.deps.wait(BATCH_INTERVAL_MS);
        }
        if (this.deps.stop.aborted) {
          for (const item of pending) {
            item.entry.outcome ??= "not sent";
          }
          this.isCut = true;
          return;
        }
        try {
          refused.push(...(await this.put(batch)));
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

  private async put(batch: Outgoing[]): Promise<Outgoing[]> {
    this.hasRequested = true;
    const results = await this.deps.stream.put(batch.map(({ record }) => record));
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
}
