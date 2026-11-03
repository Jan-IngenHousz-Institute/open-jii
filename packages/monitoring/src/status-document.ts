import { z } from "zod/mini";

// The one file the public status page reads. The status publisher writes it every minute and
// validates it against this schema first; the page parses what it fetches with the same schema.
// It holds nothing the page does not show, because anyone can fetch it. Mini rather than classic
// zod, because the page ships this schema to every visitor.

/** Bumped when the document's shape changes in a way an older page cannot read. */
export const STATUS_DOCUMENT_VERSION = 1;

/** Days of history kept and shown, counted in UTC. */
export const STATUS_HISTORY_DAYS = 90;

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
const componentStateSchema = z.enum(["operational", "degraded", "outage", "maintenance"]);
export type ComponentState = z.infer<typeof componentStateSchema>;

/** A day's worst state; "none" marks a day before checks began. */
const dayStateSchema = z.enum(["operational", "degraded", "outage", "maintenance", "none"]);
export type DayState = z.infer<typeof dayStateSchema>;

const minutesInDay = z.int().check(z.minimum(0), z.maximum(1440));

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
  incidentIds: z.array(z.string()),
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

const incidentStageSchema = z.enum([
  "investigating",
  "identified",
  "monitoring",
  "resolved",
  "scheduled",
  "in-progress",
  "completed",
]);

const nonEmptyText = z.string().check(z.minLength(1));

const incidentUpdateSchema = z.object({
  stage: incidentStageSchema,
  postedAt: z.iso.datetime(),
  text: nonEmptyText,
  nextUpdateBy: z.optional(z.iso.datetime()),
});

const incidentSchema = z.object({
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

const noticeSchema = z.object({
  id: nonEmptyText,
  title: nonEmptyText,
  body: z.string(),
  severity: z.enum(["info", "warning", "critical"]),
});

/** An empty list would read as every component operational. */
const componentsSchema = z.array(statusComponentSchema).check(z.minLength(1));

export const statusDocumentSchema = z.object({
  version: z.literal(STATUS_DOCUMENT_VERSION),
  generatedAt: z.iso.datetime(),
  components: componentsSchema,
  incidents: z.array(incidentSchema),
  notices: z.array(noticeSchema),
  /** Messages IoT accepted over the last few minutes, per minute. */
  messagesPerMinute: z.optional(z.number().check(z.nonnegative())),
});
export type StatusDocument = z.infer<typeof statusDocumentSchema>;

const newerComponentSchema = z.object({
  id: z.string().check(z.refine((id) => !statusComponentIdSchema.safeParse(id).success)),
});

/**
 * What a page parses. A component added after the page was built is dropped rather than failing
 * the whole document, so a publisher deployed before the page cannot take the page down.
 */
export const readableStatusDocumentSchema = z.extend(statusDocumentSchema, {
  components: z.pipe(
    z.pipe(
      z.array(z.unknown()),
      z.transform((items) => items.filter((item) => !newerComponentSchema.safeParse(item).success)),
    ),
    componentsSchema,
  ),
});
