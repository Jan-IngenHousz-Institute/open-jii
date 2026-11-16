import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

import { optionAfter } from "../lib/args.js";
import { createArchiveReader, createStreamWriter } from "../lib/aws.js";
import type { ArchiveReader, StreamWriter } from "../lib/aws.js";
import { pathFromRoot, repositoryRoot } from "../lib/config.js";
import { createWarehouse } from "../lib/databricks.js";
import type { Warehouse } from "../lib/databricks.js";
import { isArchived, windowObjects } from "../lib/ingest-replay-archive.js";
import { bronzeProgress, decide, lookUpBronze } from "../lib/ingest-replay-bronze.js";
import { isCandidate, readObject, utcMillis } from "../lib/ingest-replay-messages.js";
import type { Entry, Message, Outcome, Source } from "../lib/ingest-replay-messages.js";
import { StreamSender } from "../lib/ingest-replay-sender.js";

type Environment = "dev" | "prod";

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
  /** Shards the stream can hold records on that bronze has no row from since its retention began. */
  shardsNotInBronze: string[];
  streamMayHold: boolean;
  restoreFirst: string[];
  /** Objects Firehose wrote after the window's end and margin that were read, from their names. */
  lateObjects: string[];
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

const BRONZE_CAUGHT_UP_MS = 60_000;
const HOUR_MS = 3_600_000;

// Objects read at once. Each can hold up to 128 MB once unzipped, Firehose's buffer.
const READ_CONCURRENCY = 4;
// The messages bronze is asked about at a time, which bounds each statement's parameters.
const LOOKUP_SIZE = 1000;

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
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

function isWithinFilters(args: ReplayArgs, message: Message): boolean {
  const isExperiment = args.experiment === null || message.experimentId === args.experiment;
  const isClient = args.client === null || message.clientId === args.client;
  const isDevice = args.device === null || message.deviceId === args.device;
  return isExperiment && isClient && isDevice;
}

export async function runReplay(args: ReplayArgs, deps: ReplayDeps): Promise<Manifest> {
  const targets = targetsOf(args.environment);
  const { objects, late } = await windowObjects(args, deps.archive);
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
  const { readUpTo, shardsNotInBronze } = isInRetention
    ? await bronzeProgress(deps.stream, deps.warehouse, targets.bronze, retentionStart)
    : { readUpTo: null, shardsNotInBronze: [] };
  const streamMayHold = isInRetention && (readUpTo === null || readUpTo < caughtUpAt);
  if (args.apply && shardsNotInBronze.length > 0) {
    throw new Error(
      `Bronze has no row since the stream's retention began from ${shardsNotInBronze.join(", ")}, ` +
        `which it may have stopped reading, so the stream may still hold messages of the objects ` +
        `read. Find out why before replaying, or run again once the newest object is older than ` +
        `the stream's ${targets.retentionHours} hours`,
    );
  }
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
  const sender = new StreamSender(deps);
  let outsideFilters = 0;
  let stopped: string | null = null;
  const isStopped = () => deps.stop.aborted;

  async function settle(messages: Message[]): Promise<void> {
    const kept = messages.filter((message) => isWithinFilters(args, message));
    outsideFilters += messages.length - kept.length;
    const holding = await lookUpBronze(
      kept.filter(isCandidate),
      args.from,
      targets.bronze,
      deps.warehouse,
    );
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
    let next = 0;
    for (; next < readable.length && !isStopped(); next += READ_CONCURRENCY) {
      const slice = readable.slice(next, next + READ_CONCURRENCY);
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
    // A stop after the last message was settled left nothing out.
    const isCutShort = isStopped() && (next < readable.length || pending.length > 0);
    if (isCutShort) {
      stopped = "stopped by the operator; messages after the last batch are not in this manifest";
    } else {
      await settle(pending.splice(0));
    }
  } catch (error) {
    // Once anything may have reached the stream, the manifest has to say what.
    if (!sender.hasSent) {
      throw error;
    }
    stopped = errorText(error);
  }
  if (stopped === null && sender.wasCut) {
    stopped = "stopped by the operator before every missing message was sent";
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
    shardsNotInBronze,
    streamMayHold,
    restoreFirst,
    lateObjects: late,
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
  if (manifest.shardsNotInBronze.length > 0) {
    process.stdout.write(
      `bronze has no row since the stream's retention began from ${manifest.shardsNotInBronze.join(", ")}; the runbook says what to check\n`,
    );
  }
  if (manifest.streamMayHold) {
    process.stdout.write(
      "bronze has not read past the objects read yet, so messages the stream still holds count as missing\n",
    );
  }
  if (manifest.lateObjects.length > 0) {
    process.stdout.write(
      `${manifest.lateObjects.length} objects Firehose wrote after the window were read, since their names place them in it\n`,
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
