import { z } from "zod/mini";

// The one file the public status page reads. The status publisher writes it every minute and
// validates it against this schema first; the page parses what it fetches with the same schema.
// It holds nothing the page does not show, because anyone can fetch it. Mini rather than classic
// zod, because the page ships this schema to every visitor.

/** Bumped when the document's shape changes in a way an older page cannot read. */
export const STATUS_DOCUMENT_VERSION = 1;

/**
 * The page polls every minute, so a change reaches it within two minutes only while the file is
 * cached for at most 30 seconds. stale-if-error keeps the last file served through an origin outage.
 */
export const STATUS_DOCUMENT_CACHE_CONTROL = "public, max-age=30, stale-if-error=86400";

/** Days of history kept and shown, counted in UTC. */
export const STATUS_HISTORY_DAYS = 90;

export const DAY_MINUTES = 1440;

export const STATUS_COMPONENT_IDS = [
  "website",
  "sign-in",
  "platform",
  "data-intake",
  "data-delivery",
  "macro-processing",
  "exports",
] as const;

export const statusComponentIdSchema = z.enum(STATUS_COMPONENT_IDS);
export type StatusComponentId = z.infer<typeof statusComponentIdSchema>;

/** "maintenance" while a planned window that names the component is open, whatever was measured. */
export const componentStateSchema = z.enum(["operational", "degraded", "outage", "maintenance"]);
export type ComponentState = z.infer<typeof componentStateSchema>;

/** A day's worst state; "none" marks a day before checks began. */
const dayStateSchema = z.enum(["operational", "degraded", "outage", "maintenance", "none"]);
export type DayState = z.infer<typeof dayStateSchema>;

const minutesInDay = z.int().check(z.minimum(0), z.maximum(DAY_MINUTES));

const wholeMinutes = z.int().check(z.nonnegative());

export const dayRecordSchema = z.object({
  date: z.iso.date(),
  state: dayStateSchema,
  /** Minutes of this day since records began; less than 1440 only on the first day and today. */
  recordedMinutes: minutesInDay,
  downMinutes: minutesInDay,
  degradedMinutes: minutesInDay,
  maintenanceMinutes: minutesInDay,
  /** Minutes our checks could not run; they count as down in uptime. */
  unknownMinutes: minutesInDay,
});
export type DayRecord = z.infer<typeof dayRecordSchema>;

const statusComponentSchema = z.object({
  id: statusComponentIdSchema,
  state: componentStateSchema,
  /** How far behind new measurements are, shown only while it matters. */
  delayMinutes: z.optional(wholeMinutes),
  uptimePercent: z.number().check(z.minimum(0), z.maximum(100)),
  degradedMinutes: wholeMinutes,
  /** Oldest first, ending with today; `recordedMinutes` includes the unknown ones. */
  days: z.array(dayRecordSchema).check(z.maxLength(STATUS_HISTORY_DAYS)),
});
export type StatusComponent = z.infer<typeof statusComponentSchema>;

export const incidentStageSchema = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "scheduled",
  "in-progress",
  "completed",
]);

export const nonEmptyText = z.string().check(z.minLength(1));

export const incidentUpdateSchema = z.object({
  id: nonEmptyText,
  stage: incidentStageSchema,
  postedAt: z.iso.datetime(),
  text: nonEmptyText,
  nextUpdateBy: z.optional(z.iso.datetime()),
});

export const incidentSchema = z.object({
  id: nonEmptyText,
  kind: z.enum(["incident", "maintenance"]),
  title: nonEmptyText,
  impact: z.enum(["degraded", "outage"]),
  components: z.array(statusComponentIdSchema).check(z.minLength(1)),
  startsAt: z.iso.datetime(),
  endsAt: z.optional(z.iso.datetime()),
  resolvedAt: z.optional(z.iso.datetime()),
  updates: z.array(incidentUpdateSchema),
});
export type Incident = z.infer<typeof incidentSchema>;

/**
 * When it is over: its resolution, or for planned work the earlier of that and its scheduled end.
 * It may still be ahead of now.
 */
export function endedAt(
  incident: Pick<Incident, "kind" | "endsAt" | "resolvedAt">,
): string | undefined {
  const ends = [incident.resolvedAt, incident.kind === "maintenance" ? incident.endsAt : undefined]
    .filter((at) => at !== undefined)
    .sort((a, b) => Date.parse(a) - Date.parse(b));

  return ends[0];
}
export type IncidentUpdate = z.infer<typeof incidentUpdateSchema>;

export const noticeSchema = z.object({
  id: nonEmptyText,
  title: nonEmptyText,
  body: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
});
export type Notice = z.infer<typeof noticeSchema>;

/** An empty list would read as every component operational. */
const componentsSchema = z.array(statusComponentSchema).check(z.minLength(1));

export const statusDocumentSchema = z.object({
  version: z.literal(STATUS_DOCUMENT_VERSION),
  generatedAt: z.iso.datetime(),
  components: componentsSchema,
  incidents: z.array(incidentSchema),
  notices: z.array(noticeSchema),
});
export type StatusDocument = z.infer<typeof statusDocumentSchema>;

const newerComponentIdSchema = z
  .string()
  .check(z.refine((id) => !statusComponentIdSchema.safeParse(id).success));

const newerComponentSchema = z.object({ id: newerComponentIdSchema });

const namedComponentsSchema = z.looseObject({ components: z.array(z.unknown()) });

/**
 * The incident without the components added after the page was built, or nothing when it names
 * only those. An entry that is not shaped like an incident passes on, for the contract to reject.
 */
function readableIncidents(item: unknown): unknown[] {
  const named = namedComponentsSchema.safeParse(item);
  if (!named.success) {
    return [item];
  }

  const known = named.data.components.filter((id) => !newerComponentIdSchema.safeParse(id).success);
  const isOnlyNewer = known.length === 0 && named.data.components.length > 0;

  return isOnlyNewer ? [] : [{ ...named.data, components: known }];
}

/**
 * What a page parses. A component added after the page was built is dropped rather than failing
 * the whole document, and so is an incident left naming none, so a publisher deployed before the
 * page cannot take the page down.
 */
export const readableStatusDocumentSchema = z.extend(statusDocumentSchema, {
  components: z.pipe(
    z.pipe(
      z.array(z.unknown()),
      z.transform((items) => items.filter((item) => !newerComponentSchema.safeParse(item).success)),
    ),
    componentsSchema,
  ),
  incidents: z.pipe(
    z.pipe(
      z.array(z.unknown()),
      z.transform((items) => items.flatMap(readableIncidents)),
    ),
    z.array(incidentSchema),
  ),
});
