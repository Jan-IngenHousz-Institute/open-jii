import type { ArchiveObject, ArchiveReader } from "./aws.js";
import type { Source } from "./ingest-replay-messages.js";

// Firehose writes an object about 15 minutes after the first message it buffered, under that
// message's day, so the archive is listed this much wider than the window on both sides.
const ARCHIVE_MARGIN_MS = 20 * 60_000;
const ERRORS_MARGIN_MS = 5 * 60_000;

// Firehose names an object `<stream>-<version>-YYYY-MM-DD-HH-MM-SS-<uuid>.gz`. AWS documents only the
// day prefix (the oldest record's arrival); on dev each name's time is the previous object's write,
// 15 minutes before its own, so it is read as the start of the buffer the object flushed.
const FIREHOSE_NAME_TIME = /-(\d{4})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-(\d{2})-[0-9a-f-]{36}\.gz$/;

// Objects in these classes have to be restored before they can be read.
const ARCHIVED_CLASSES = new Set(["GLACIER", "DEEP_ARCHIVE"]);

/** The window a replay reads, and which of the rule's two archives it reads it from. */
export interface ReplayWindow {
  source: Source;
  from: Date;
  to: Date;
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

/** When the buffer a Firehose object flushed began, from its name; null for any other object. */
export function bufferStartOf(key: string): Date | null {
  const match = FIREHOSE_NAME_TIME.exec(key);
  if (match === null) {
    return null;
  }
  const [year, month, day, hour, minute, second] = match.slice(1).map(Number);
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second));
}

export interface WindowObjects {
  objects: ArchiveObject[];
  /** Objects written after the window's end and margin, read because their names place them in it. */
  late: string[];
}

/**
 * The objects written while the window's messages could still arrive in them, and any Firehose
 * wrote later, after retrying S3 for up to a day, whose buffer began in the window. A late object
 * stays under its oldest record's day, which the listed prefixes already cover.
 */
export async function windowObjects(
  window: ReplayWindow,
  archive: ArchiveReader,
): Promise<WindowObjects> {
  const isArchive = window.source === "archive";
  const root = isArchive ? "raw-iot" : "iot-rule-errors";
  const margin = isArchive ? ARCHIVE_MARGIN_MS : ERRORS_MARGIN_MS;
  const since = new Date(window.from.getTime() - margin);
  const until = new Date(window.to.getTime() + margin);

  const listed: ArchiveObject[] = [];
  for (const prefix of dayPrefixes(root, since, until)) {
    listed.push(...(await archive.list(prefix)));
  }

  const objects: ArchiveObject[] = [];
  const late: string[] = [];
  for (const object of listed) {
    if (object.lastModified < window.from) {
      continue;
    }
    if (object.lastModified <= until) {
      objects.push(object);
      continue;
    }
    const bufferStart = isArchive ? bufferStartOf(object.key) : null;
    const isLate = bufferStart !== null && bufferStart >= since && bufferStart <= window.to;
    if (isLate) {
      objects.push(object);
      late.push(object.key);
    }
  }
  return { objects, late };
}

export function isArchived(object: ArchiveObject, now: Date): boolean {
  const isRestored = object.restoredUntil !== null && object.restoredUntil > now;
  return ARCHIVED_CLASSES.has(object.storageClass) && !isRestored;
}
