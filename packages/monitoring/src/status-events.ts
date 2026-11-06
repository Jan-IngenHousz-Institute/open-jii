import { z } from "zod/mini";

import {
  componentStateSchema,
  endedAt,
  incidentSchema,
  incidentUpdateSchema,
  nonEmptyText,
  noticeSchema,
  statusComponentIdSchema,
} from "./status-document.js";
import type {
  ComponentState,
  Incident,
  IncidentUpdate,
  StatusComponent,
  StatusDocument,
} from "./status-document.js";
import { isOpen } from "./status-judge.js";

// What changed on the status page since subscribers were last told, for a channel such as Slack.
// The publisher keeps the snapshot of what it announced, and only stores a new one once the events
// are sent, so a failed send is repeated on the next run.

export const STATUS_EVENTS_VERSION = 1;

/** An incident or maintenance window as the document has it, without its updates. */
const incidentSummarySchema = z.omit(incidentSchema, { updates: true });
export type IncidentSummary = z.infer<typeof incidentSummarySchema>;

const envelope = {
  version: z.literal(STATUS_EVENTS_VERSION),
  /** The same when a send is retried, and different for a later separate change of that kind. */
  id: nonEmptyText,
  environment: nonEmptyText,
  occurredAt: z.iso.datetime(),
  pageUrl: z.url(),
};

export const statusEventSchema = z.discriminatedUnion("type", [
  z.object({
    ...envelope,
    type: z.literal("incident.opened"),
    incident: incidentSummarySchema,
    update: z.optional(incidentUpdateSchema),
  }),
  z.object({
    ...envelope,
    type: z.literal("incident.updated"),
    incident: incidentSummarySchema,
    update: incidentUpdateSchema,
  }),
  z.object({
    ...envelope,
    type: z.literal("incident.resolved"),
    incident: incidentSummarySchema,
    update: z.optional(incidentUpdateSchema),
  }),
  z.object({
    ...envelope,
    type: z.literal("maintenance.updated"),
    maintenance: incidentSummarySchema,
    update: incidentUpdateSchema,
  }),
  z.object({
    ...envelope,
    type: z.literal("maintenance.scheduled"),
    maintenance: incidentSummarySchema,
    update: z.optional(incidentUpdateSchema),
  }),
  z.object({
    ...envelope,
    type: z.literal("maintenance.started"),
    maintenance: incidentSummarySchema,
    update: z.optional(incidentUpdateSchema),
  }),
  z.object({
    ...envelope,
    type: z.literal("maintenance.completed"),
    maintenance: incidentSummarySchema,
    update: z.optional(incidentUpdateSchema),
  }),
  z.object({
    ...envelope,
    type: z.literal("component.changed"),
    component: statusComponentIdSchema,
    from: componentStateSchema,
    to: componentStateSchema,
  }),
  z.object({
    ...envelope,
    type: z.literal("notice.posted"),
    notice: noticeSchema,
  }),
  z.object({
    ...envelope,
    type: z.literal("notice.removed"),
    notice: z.pick(noticeSchema, { id: true, title: true }),
  }),
]);
export type StatusEvent = z.infer<typeof statusEventSchema>;

const MAINTENANCE_PHASES = ["scheduled", "in-progress", "completed"] as const;
type MaintenancePhase = (typeof MAINTENANCE_PHASES)[number];

/** The ids of the updates told so far. */
const toldUpdatesSchema = z.array(z.string());

const announcedIncidentSchema = z.discriminatedUnion("kind", [
  z.object({
    id: nonEmptyText,
    kind: z.literal("incident"),
    phase: z.enum(["open", "resolved"]),
    updates: toldUpdatesSchema,
  }),
  z.object({
    id: nonEmptyText,
    kind: z.literal("maintenance"),
    phase: z.enum(MAINTENANCE_PHASES),
    updates: toldUpdatesSchema,
  }),
]);
export type AnnouncedIncident = z.infer<typeof announcedIncidentSchema>;

const announcedComponentSchema = z.object({
  state: componentStateSchema,
  /** The run that announced this state, which tells apart two changes to the same state. */
  since: z.iso.datetime(),
});

/** What subscribers were last told, which is all the next run needs to know what is new. */
export const announcedSchema = z.object({
  /** When this snapshot was taken, which tells a later occurrence of a change from a retried send. */
  at: z.iso.datetime(),
  incidents: z.array(announcedIncidentSchema),
  components: z.partialRecord(statusComponentIdSchema, announcedComponentSchema),
  notices: z.array(z.pick(noticeSchema, { id: true, title: true })),
});
export type Announced = z.infer<typeof announcedSchema>;

export interface StatusEventsInput {
  /** Undefined on the first run, which only records a baseline. */
  previous: Announced | undefined;
  document: StatusDocument;
  environment: string;
  pageUrl: string;
  now: Date;
}

export interface StatusEventsResult {
  events: StatusEvent[];
  announced: Announced;
}

type Stamp = Pick<StatusEvent, "version" | "environment" | "occurredAt" | "pageUrl">;

const PHASE_RANK: Record<MaintenancePhase, number> = {
  scheduled: 0,
  "in-progress": 1,
  completed: 2,
};

/** Operational and maintenance rank together, since a window speaks for a component on its own. */
const SEVERITY: Record<ComponentState, number> = {
  operational: 0,
  maintenance: 0,
  degraded: 1,
  outage: 2,
};

function oldestFirst(updates: IncidentUpdate[]): IncidentUpdate[] {
  return [...updates].sort((a, b) => Date.parse(a.postedAt) - Date.parse(b.postedAt));
}

/** When it ended, once that time has come. */
function endedBy(incident: Incident, atMs: number): string | undefined {
  const end = endedAt(incident);

  return end !== undefined && Date.parse(end) <= atMs ? end : undefined;
}

type MaintenanceNow =
  | { phase: "scheduled" | "in-progress" }
  | { phase: "completed"; endedAt: string };

function maintenanceNow(window: Incident, atMs: number): MaintenanceNow {
  const ended = endedBy(window, atMs);

  if (ended !== undefined) {
    return { phase: "completed", endedAt: ended };
  }

  return { phase: isOpen(window, atMs) ? "in-progress" : "scheduled" };
}

export function announcedIncidentOf(incident: Incident, atMs: number): AnnouncedIncident {
  const updates = incident.updates.map((update) => update.id);

  if (incident.kind === "maintenance") {
    return {
      id: incident.id,
      kind: "maintenance",
      phase: maintenanceNow(incident, atMs).phase,
      updates,
    };
  }

  return {
    id: incident.id,
    kind: "incident",
    phase: endedBy(incident, atMs) === undefined ? "open" : "resolved",
    updates,
  };
}

function snapshotOf(
  document: StatusDocument,
  previous: Announced | undefined,
  now: Date,
): Announced {
  const atMs = now.getTime();
  const components: Announced["components"] = {};

  for (const component of document.components) {
    const before = previous?.components[component.id];
    components[component.id] =
      before?.state === component.state
        ? before
        : { state: component.state, since: now.toISOString() };
  }

  return {
    at: now.toISOString(),
    incidents: document.incidents.map((incident) => announcedIncidentOf(incident, atMs)),
    components,
    notices: document.notices.map(({ id, title }) => ({ id, title })),
  };
}

function summaryOf(incident: Incident): IncidentSummary {
  const { updates: _updates, ...summary } = incident;
  return summary;
}

function incidentEvents(
  incident: Incident,
  before: Extract<AnnouncedIncident, { kind: "incident" }> | undefined,
  stamp: Stamp,
  atMs: number,
  previousAt: string,
): StatusEvent[] {
  const incidentSummary = summaryOf(incident);
  const told = new Set(before?.updates);
  const fresh = oldestFirst(incident.updates).filter((update) => !told.has(update.id));
  const latest = fresh.at(-1);

  function opened(update: IncidentUpdate | undefined): StatusEvent {
    return {
      ...stamp,
      id: `incident.opened:${incident.id}:${previousAt}`,
      type: "incident.opened",
      incident: incidentSummary,
      update,
    };
  }

  function updated(update: IncidentUpdate): StatusEvent {
    return {
      ...stamp,
      id: `incident.updated:${incident.id}:${update.id}`,
      type: "incident.updated",
      incident: incidentSummary,
      update,
    };
  }

  function resolved(resolvedAt: string, update: IncidentUpdate | undefined): StatusEvent {
    return {
      ...stamp,
      id: `incident.resolved:${incident.id}:${resolvedAt}`,
      type: "incident.resolved",
      incident: incidentSummary,
      update,
    };
  }

  const resolvedAt = endedBy(incident, atMs);

  if (before === undefined) {
    return [resolvedAt === undefined ? opened(latest) : resolved(resolvedAt, latest)];
  }

  const isResolving = resolvedAt !== undefined && before.phase === "open";
  if (!isResolving) {
    return fresh.map(updated);
  }

  return [...fresh.slice(0, -1).map(updated), resolved(resolvedAt, latest)];
}

function phaseEvent(
  maintenance: IncidentSummary,
  now: MaintenanceNow,
  update: IncidentUpdate | undefined,
  stamp: Stamp,
): StatusEvent {
  switch (now.phase) {
    case "scheduled":
      return {
        ...stamp,
        id: `maintenance.scheduled:${maintenance.id}:${maintenance.startsAt}`,
        type: "maintenance.scheduled",
        maintenance,
        update,
      };
    case "in-progress":
      return {
        ...stamp,
        id: `maintenance.started:${maintenance.id}:${maintenance.startsAt}`,
        type: "maintenance.started",
        maintenance,
        update,
      };
    case "completed":
      return {
        ...stamp,
        id: `maintenance.completed:${maintenance.id}:${now.endedAt}`,
        type: "maintenance.completed",
        maintenance,
        update,
      };
  }
}

function maintenanceEvents(
  window: Incident,
  before: Extract<AnnouncedIncident, { kind: "maintenance" }> | undefined,
  stamp: Stamp,
  atMs: number,
): StatusEvent[] {
  const maintenance = summaryOf(window);
  const now = maintenanceNow(window, atMs);
  const told = new Set(before?.updates);
  const fresh = oldestFirst(window.updates).filter((update) => !told.has(update.id));
  const latest = fresh.at(-1);

  function updated(update: IncidentUpdate): StatusEvent {
    return {
      ...stamp,
      id: `maintenance.updated:${window.id}:${update.id}`,
      type: "maintenance.updated",
      maintenance,
      update,
    };
  }

  if (before === undefined) {
    return [phaseEvent(maintenance, now, latest, stamp)];
  }

  const hasAdvanced = PHASE_RANK[now.phase] > PHASE_RANK[before.phase];
  if (!hasAdvanced) {
    return fresh.map(updated);
  }

  return [...fresh.slice(0, -1).map(updated), phaseEvent(maintenance, now, latest, stamp)];
}

function lifecycleEvents(
  document: StatusDocument,
  previous: Announced,
  stamp: Stamp,
  atMs: number,
): StatusEvent[] {
  const known = new Map(previous.incidents.map((entry) => [entry.id, entry]));

  return document.incidents.flatMap((incident): StatusEvent[] => {
    const before = known.get(incident.id);

    if (incident.kind === "incident") {
      return incidentEvents(
        incident,
        before?.kind === "incident" ? before : undefined,
        stamp,
        atMs,
        previous.at,
      );
    }

    return maintenanceEvents(
      incident,
      before?.kind === "maintenance" ? before : undefined,
      stamp,
      atMs,
    );
  });
}

function noticeEvents(document: StatusDocument, previous: Announced, stamp: Stamp): StatusEvent[] {
  const told = new Set(previous.notices.map((notice) => notice.id));
  const current = new Set(document.notices.map((notice) => notice.id));

  const posted = document.notices
    .filter((notice) => !told.has(notice.id))
    .map(
      (notice): StatusEvent => ({
        ...stamp,
        id: `notice.posted:${notice.id}:${previous.at}`,
        type: "notice.posted",
        notice,
      }),
    );
  const removed = previous.notices
    .filter((notice) => !current.has(notice.id))
    .map(
      (notice): StatusEvent => ({
        ...stamp,
        id: `notice.removed:${notice.id}:${previous.at}`,
        type: "notice.removed",
        notice,
      }),
    );

  return [...posted, ...removed];
}

function isLive(entry: AnnouncedIncident): boolean {
  return entry.phase === "open" || entry.phase === "in-progress";
}

/**
 * A change is held back while a window that names the component is open, or an open incident that
 * names it is at least as severe as the new state, since their events already say it. It is also
 * held back in the run an incident or window ends, since its closing event says the return.
 */
function isHeldBack(
  component: StatusComponent,
  incidents: Incident[],
  wasLive: Set<string>,
  atMs: number,
): boolean {
  return incidents
    .filter((incident) => incident.components.includes(component.id))
    .some((incident) => {
      const isNow = isOpen(incident, atMs);
      const isEnding = !isNow && wasLive.has(incident.id);
      const isWindow = isNow && incident.kind === "maintenance";
      const isAsSevere =
        isNow &&
        incident.kind === "incident" &&
        SEVERITY[incident.impact] >= SEVERITY[component.state];

      return isEnding || isWindow || isAsSevere;
    });
}

function componentEvents(
  document: StatusDocument,
  previous: Announced,
  stamp: Stamp,
  atMs: number,
): StatusEvent[] {
  const wasLive = new Set(previous.incidents.filter(isLive).map((entry) => entry.id));

  return document.components.flatMap((component): StatusEvent[] => {
    const before = previous.components[component.id];
    const isBaseline = before === undefined;

    if (
      isBaseline ||
      before.state === component.state ||
      isHeldBack(component, document.incidents, wasLive, atMs)
    ) {
      return [];
    }

    return [
      {
        ...stamp,
        id: `component.changed:${component.id}:${before.since}:${component.state}`,
        type: "component.changed",
        component: component.id,
        from: before.state,
        to: component.state,
      },
    ];
  });
}

/**
 * The events a run owes subscribers, and the snapshot to keep once they are sent. The first run
 * only records a baseline, so what is already open never floods a channel. The snapshot always
 * takes the current state, so a change held back is not announced later. An update is told once by
 * its id, whatever is edited on it afterwards.
 */
export function statusEvents(input: StatusEventsInput): StatusEventsResult {
  const { previous, document, now } = input;
  const atMs = now.getTime();
  const announced = snapshotOf(document, previous, now);

  if (previous === undefined) {
    return { events: [], announced };
  }

  const stamp: Stamp = {
    version: STATUS_EVENTS_VERSION,
    environment: input.environment,
    occurredAt: now.toISOString(),
    pageUrl: input.pageUrl,
  };

  return {
    events: [
      ...lifecycleEvents(document, previous, stamp, atMs),
      ...noticeEvents(document, previous, stamp),
      ...componentEvents(document, previous, stamp, atMs),
    ],
    announced,
  };
}

/** SNS takes at most 10 messages and 256 KiB per batch; the margin covers the type attribute. */
export const SNS_BATCH_SIZE = 10;
export const SNS_BATCH_BYTES = 250_000;

export interface EventMessage {
  event: StatusEvent;
  message: string;
}

/** Splits events into SNS batches in order; a message over the byte limit on its own goes alone. */
export function batchEvents(events: StatusEvent[]): EventMessage[][] {
  const batches: EventMessage[][] = [];
  let batch: EventMessage[] = [];
  let bytes = 0;

  for (const event of events) {
    const message = JSON.stringify(event);
    const size = Buffer.byteLength(message);
    const isFull = batch.length === SNS_BATCH_SIZE || bytes + size > SNS_BATCH_BYTES;

    if (isFull && batch.length > 0) {
      batches.push(batch);
      batch = [];
      bytes = 0;
    }

    batch.push({ event, message });
    bytes += size;
  }

  if (batch.length > 0) {
    batches.push(batch);
  }

  return batches;
}

/** One entry SNS refused, as `PublishBatch` reports it against the batch's own ids. */
export interface FailedEntry {
  Id: string;
  Code?: string;
  Message?: string;
}

/** Names each refused entry by the event it carried. */
export function failedEntriesText(sent: StatusEvent[], failed: FailedEntry[]): string {
  return failed
    .map(({ Id, Code, Message }) => {
      const event = sent.find((_, index) => String(index) === Id);
      return `${event?.id ?? Id} (${Code}: ${Message})`;
    })
    .join(", ");
}
