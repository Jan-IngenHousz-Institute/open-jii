import { endedAt } from "./status-document.js";
import type {
  ComponentState,
  IncidentUpdate,
  Notice,
  StatusComponentId,
} from "./status-document.js";
import type { IncidentSummary, StatusEvent } from "./status-events.js";

interface MrkdwnText {
  type: "mrkdwn";
  text: string;
}

type SlackBlock =
  | { type: "section"; text: MrkdwnText }
  | { type: "context"; elements: MrkdwnText[] };

/** The JSON body of a Slack incoming webhook. `text` is what notifications show. */
export interface SlackMessage {
  text: string;
  blocks: SlackBlock[];
}

/**
 * The English names the page shows, kept beside the ids because the Lambda cannot import the
 * translations. A test in the status app fails when they differ from `component.<id>.name`.
 */
export const STATUS_COMPONENT_NAMES: Record<StatusComponentId, string> = {
  website: "Website",
  "sign-in": "Sign-in",
  platform: "Platform",
  "data-intake": "Data intake",
  "data-delivery": "Data delivery",
  "macro-processing": "Macro processing",
  exports: "Exports",
};

const STAGE_NAMES: Record<IncidentUpdate["stage"], string> = {
  investigating: "Investigating",
  identified: "Identified",
  monitoring: "Monitoring",
  resolved: "Resolved",
  scheduled: "Scheduled",
  "in-progress": "In progress",
  completed: "Completed",
};

const STATE_NAMES: Record<ComponentState, string> = {
  operational: "Operational",
  degraded: "Degraded",
  outage: "Outage",
  maintenance: "Maintenance",
};

const STATE_NOW: Record<ComponentState, string> = {
  operational: "working normally",
  degraded: "degraded",
  outage: "down",
  maintenance: "under planned maintenance",
};

const IMPACT_NAMES: Record<IncidentSummary["impact"], string> = {
  degraded: "degraded",
  outage: "outage",
};

const SEVERITY_SENTENCES: Record<Notice["severity"], string> = {
  info: "This notice is for information.",
  warning: "This notice is a warning.",
  critical: "This notice is critical.",
};

// Slack refuses a section whose text is over 3000 characters (Block Kit, section block). The
// update text is the only long part, so it gets most of that and the stage and next update lines
// fit in the rest.
const UPDATE_TEXT_LIMIT = 2500;
const TITLE_LIMIT = 300;
const ELLIPSIS = "...";

const PRODUCTION = "prod";

const ESCAPED = new Map([
  ["&", "&amp;"],
  ["<", "&lt;"],
  [">", "&gt;"],
]);

const WEEKDAY_DATE = new Intl.DateTimeFormat("en-US", { dateStyle: "full", timeZone: "UTC" });
const TIME = new Intl.DateTimeFormat("en-US", {
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
  timeZone: "UTC",
});
const DATE_TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
  timeZone: "UTC",
});
const NAMES = new Intl.ListFormat("en-US", { style: "long", type: "conjunction" });

function weekdayDateTime(iso: string): string {
  return `${WEEKDAY_DATE.format(Date.parse(iso))}, ${TIME.format(Date.parse(iso))} UTC`;
}

function dateTime(iso: string): string {
  return `${DATE_TIME.format(Date.parse(iso))} UTC`;
}

/**
 * Slack reads `&`, `<` and `>` as markup, so user text has them replaced, which also stops a
 * pasted `<!channel>` from notifying anyone. A cut never lands inside a replacement or a
 * surrogate pair.
 */
function clip(text: string, limit: number, isQuote: boolean): string {
  const prefix = isQuote ? "> " : "";
  const lineBreak = isQuote ? "\n> " : " ";
  const pieces = Array.from(text.replace(/\r\n?/g, "\n").trim(), (char) =>
    char === "\n" ? lineBreak : (ESCAPED.get(char) ?? char),
  );
  const whole = `${prefix}${pieces.join("")}`;

  if (whole.length <= limit) {
    return whole;
  }

  let kept = prefix;
  for (const piece of pieces) {
    if (kept.length + piece.length + ELLIPSIS.length > limit) {
      break;
    }
    kept += piece;
  }

  return `${kept}${ELLIPSIS}`;
}

function escaped(text: string): string {
  return clip(text, Infinity, false);
}

function affects(components: StatusComponentId[]): string {
  return `Affects ${NAMES.format(components.map((id) => STATUS_COMPONENT_NAMES[id]))}.`;
}

function plannedWindow(maintenance: IncidentSummary): string {
  const { startsAt, endsAt } = maintenance;

  if (endsAt === undefined) {
    return `Planned window: from ${dateTime(startsAt)}.`;
  }

  const isSingleDay = startsAt.slice(0, 10) === endsAt.slice(0, 10);

  return isSingleDay
    ? `Planned window: ${WEEKDAY_DATE.format(Date.parse(startsAt))}, ${TIME.format(Date.parse(startsAt))} to ${TIME.format(Date.parse(endsAt))} UTC.`
    : `Planned window: ${dateTime(startsAt)} to ${dateTime(endsAt)}.`;
}

interface MessageParts {
  headline: string;
  lines: string[];
  update?: IncidentUpdate;
  quote?: string;
}

// A time after the event has not happened yet, so it prints nothing.
function finishedLine(
  label: "Resolved" | "Ended",
  finishedAt: string | undefined,
  occurredAt: string,
): string[] {
  const hasHappened = finishedAt !== undefined && Date.parse(finishedAt) <= Date.parse(occurredAt);

  return hasHappened ? [`${label} ${weekdayDateTime(finishedAt)}.`] : [];
}

function incidentParts(
  label: string,
  incident: IncidentSummary,
  update: IncidentUpdate | undefined,
  occurredAt: string,
): MessageParts {
  return {
    headline: `${label}: ${clip(incident.title, TITLE_LIMIT, false)}`,
    lines: [
      `Impact: ${IMPACT_NAMES[incident.impact]}. ${affects(incident.components)}`,
      `Started ${weekdayDateTime(incident.startsAt)}.`,
      ...finishedLine("Resolved", incident.resolvedAt, occurredAt),
    ],
    update,
  };
}

function maintenanceParts(
  label: string,
  maintenance: IncidentSummary,
  update: IncidentUpdate | undefined,
  occurredAt: string,
): MessageParts {
  return {
    headline: `${label}: ${clip(maintenance.title, TITLE_LIMIT, false)}`,
    lines: [
      affects(maintenance.components),
      plannedWindow(maintenance),
      ...finishedLine("Ended", endedAt(maintenance), occurredAt),
    ],
    update,
  };
}

function partsOf(event: StatusEvent): MessageParts {
  switch (event.type) {
    case "incident.opened":
      return incidentParts("Incident opened", event.incident, event.update, event.occurredAt);
    case "incident.updated":
      return incidentParts("Incident updated", event.incident, event.update, event.occurredAt);
    case "incident.resolved":
      return incidentParts("Incident resolved", event.incident, event.update, event.occurredAt);
    case "maintenance.scheduled":
      return maintenanceParts(
        "Maintenance scheduled",
        event.maintenance,
        event.update,
        event.occurredAt,
      );
    case "maintenance.started":
      return maintenanceParts(
        "Maintenance started",
        event.maintenance,
        event.update,
        event.occurredAt,
      );
    case "maintenance.updated":
      return maintenanceParts(
        "Maintenance updated",
        event.maintenance,
        event.update,
        event.occurredAt,
      );
    case "maintenance.completed":
      return maintenanceParts(
        "Maintenance completed",
        event.maintenance,
        event.update,
        event.occurredAt,
      );
    case "component.changed": {
      const name = STATUS_COMPONENT_NAMES[event.component];

      return {
        headline: `Component changed: ${name} is ${STATE_NOW[event.to]}`,
        lines: [`${name} changed from ${STATE_NAMES[event.from]} to ${STATE_NAMES[event.to]}.`],
      };
    }
    case "notice.posted":
      return {
        headline: `Notice posted: ${clip(event.notice.title, TITLE_LIMIT, false)}`,
        lines: [SEVERITY_SENTENCES[event.notice.severity]],
        quote: event.notice.body.trim() === "" ? undefined : event.notice.body,
      };
    case "notice.removed":
      return {
        headline: `Notice removed: ${clip(event.notice.title, TITLE_LIMIT, false)}`,
        lines: ["The notice is no longer on the status page."],
      };
  }
}

function updateText(update: IncidentUpdate): string {
  const next =
    update.nextUpdateBy === undefined ? [] : [`Next update by ${dateTime(update.nextUpdateBy)}.`];

  return [
    `*${STAGE_NAMES[update.stage]}* (posted ${dateTime(update.postedAt)})`,
    clip(update.text, UPDATE_TEXT_LIMIT, true),
    ...next,
  ].join("\n");
}

function section(text: string): SlackBlock {
  return { type: "section", text: { type: "mrkdwn", text } };
}

function footer(event: StatusEvent): SlackBlock {
  const environment =
    event.environment === PRODUCTION ? [] : [`Environment: ${escaped(event.environment)}`];
  const link = new URL(event.pageUrl).href.replaceAll("|", "%7C");

  return {
    type: "context",
    elements: [`<${link}|View the status page>`, dateTime(event.occurredAt), ...environment].map(
      (text): MrkdwnText => ({ type: "mrkdwn", text }),
    ),
  };
}

/** The Slack message for one status event. Times are UTC, as on the page. */
export function slackMessage(event: StatusEvent): SlackMessage {
  const { headline, lines, update, quote } = partsOf(event);

  return {
    text: [headline, lines[0]].join("\n"),
    blocks: [
      section(`*${headline}*`),
      section(lines.join("\n")),
      ...(quote === undefined ? [] : [section(clip(quote, UPDATE_TEXT_LIMIT, true))]),
      ...(update === undefined ? [] : [section(updateText(update))]),
      footer(event),
    ],
  };
}
