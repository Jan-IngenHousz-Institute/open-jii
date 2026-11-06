import { STATUS_COMPONENT_IDS, STATUS_DOCUMENT_VERSION } from "@repo/monitoring/status-document";
import type {
  Incident,
  IncidentUpdate,
  StatusComponent,
  StatusDocument,
} from "@repo/monitoring/status-document";
import { statusEvents } from "@repo/monitoring/status-events";
import type { Announced, StatusEvent } from "@repo/monitoring/status-events";
import { endedAt, isOpen } from "@repo/monitoring/status-judge";
import { STATUS_COMPONENT_NAMES, slackMessage } from "@repo/monitoring/status-slack";
import type { SlackMessage } from "@repo/monitoring/status-slack";

export type Target = "dev" | "prod";

// The publisher gets ENVIRONMENT from the deployment and STATUS_PAGE_URL from its status domain,
// and its Slack footer prints an environment line for anything but prod.
const PAGE_URLS: Record<Target, string> = {
  prod: "https://status.openjii.org",
  dev: "https://status.dev.openjii.org",
};

const EDGE_MS = 120_000;

const TIME = new Intl.DateTimeFormat("en-US", {
  dateStyle: "medium",
  timeStyle: "short",
  hourCycle: "h23",
  timeZone: "UTC",
});

export interface PreviewInput {
  /** The incident as the publisher last announced it, or nothing if it never saw it. */
  before: Incident | undefined;
  after: Incident;
  /** Ids of the updates the publisher has already announced. */
  told: string[];
  now: Date;
  /** Which deployment's publisher reads the space. Defaults to prod. */
  target?: Target;
}

export interface SlackPost {
  event: StatusEvent;
  message: SlackMessage;
}

function time(iso: string): string {
  return `${TIME.format(Date.parse(iso))} UTC`;
}

function announcedOf(before: Incident, told: string[], atMs: number): Announced["incidents"] {
  const end = endedAt(before);
  const hasEnded = end !== undefined && Date.parse(end) <= atMs;

  if (before.kind === "incident") {
    return [
      { id: before.id, kind: "incident", phase: hasEnded ? "resolved" : "open", updates: told },
    ];
  }

  if (hasEnded) {
    return [{ id: before.id, kind: "maintenance", phase: "completed", updates: told }];
  }

  const phase = isOpen(before, atMs) ? "in-progress" : "scheduled";
  return [{ id: before.id, kind: "maintenance", phase, updates: told }];
}

function componentOf(id: StatusComponent["id"]): StatusComponent {
  return { id, state: "operational", uptimePercent: 100, degradedMinutes: 0, days: [] };
}

/** Runs the publisher's own event logic, so the messages are the ones it will send. */
export function slackPosts(input: PreviewInput): SlackPost[] {
  const { before, after, told, now, target = "prod" } = input;

  const document: StatusDocument = {
    version: STATUS_DOCUMENT_VERSION,
    generatedAt: now.toISOString(),
    components: STATUS_COMPONENT_IDS.map(componentOf),
    incidents: [after],
    notices: [],
  };
  const previous: Announced = {
    incidents: before === undefined ? [] : announcedOf(before, told, now.getTime()),
    components: {},
    notices: [],
  };

  const { events } = statusEvents({
    previous,
    document,
    environment: target,
    pageUrl: PAGE_URLS[target],
    now,
  });

  return events.map((event) => ({ event, message: slackMessage(event) }));
}

function stageName(stage: IncidentUpdate["stage"]): string {
  const spaced = stage.replace("-", " ");
  return `${spaced.charAt(0).toUpperCase()}${spaced.slice(1)}`;
}

function indented(text: string, spaces: number): string[] {
  const pad = " ".repeat(spaces);
  return text.split("\n").map((line) => `${pad}${line}`);
}

function newestOf(incident: Incident): IncidentUpdate | undefined {
  return [...incident.updates]
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt))
    .at(0);
}

function windowLine(incident: Incident): string {
  if (incident.endsAt === undefined) {
    return `Window: from ${time(incident.startsAt)}`;
  }
  return `Window: ${time(incident.startsAt)} to ${time(incident.endsAt)}`;
}

function cardLines(incident: Incident): string[] {
  const isMaintenance = incident.kind === "maintenance";
  const heading = isMaintenance ? "Maintenance" : incident.impact.toUpperCase();
  const names = incident.components.map((id) => STATUS_COMPONENT_NAMES[id]);
  const newest = newestOf(incident);

  const lines = [
    `${heading}: ${incident.title}`,
    `Affected: ${names.join(", ")}`,
    isMaintenance ? windowLine(incident) : `Started: ${time(incident.startsAt)}`,
  ];

  if (incident.resolvedAt !== undefined) {
    lines.push(`Resolved: ${time(incident.resolvedAt)}`);
  }
  if (newest !== undefined) {
    lines.push(`Newest update: ${stageName(newest.stage)}, posted ${time(newest.postedAt)}`);
    lines.push(...indented(newest.text, 2));
  }
  if (newest?.nextUpdateBy !== undefined) {
    lines.push(`Next update by: ${time(newest.nextUpdateBy)}`);
  }

  return lines;
}

function messageLines({ event, message }: SlackPost, position: string): string[] {
  const lines = [`Message ${position} (${event.type})`, "  Notification text:"];
  lines.push(...indented(message.text, 4));

  for (const block of message.blocks) {
    if (block.type === "section") {
      lines.push("  Section:", ...indented(block.text.text, 4));
    } else {
      lines.push(`  Footer: ${block.elements.map((element) => element.text).join("  |  ")}`);
    }
  }

  return lines;
}

function isNear(iso: string | undefined, nowMs: number): boolean {
  return iso !== undefined && Math.abs(Date.parse(iso) - nowMs) <= EDGE_MS;
}

function edgeNotes({ after, now }: PreviewInput): string[] {
  if (after.kind !== "maintenance") {
    return [];
  }

  const nowMs = now.getTime();
  const notes: string[] = [];

  if (isNear(after.startsAt, nowMs)) {
    notes.push(
      "The window starts within two minutes of now. By the time the publisher reads this, the real message may be Maintenance started instead of the one above.",
    );
  }
  if (isNear(after.endsAt, nowMs)) {
    notes.push(
      "The window ends within two minutes of now. By the time the publisher reads this, the real message may be Maintenance completed instead of the one above.",
    );
  }

  return notes;
}

/** Plain text a person reads before anything reaches Contentful. */
export function renderPreview(input: PreviewInput): string {
  const { target = "prod" } = input;
  const posts = slackPosts(input);
  const slack =
    posts.length === 0
      ? ["No message: the publisher has nothing new to announce."]
      : posts.flatMap((post, index) => messageLines(post, `${index + 1} of ${posts.length}`));
  const notes = edgeNotes(input);

  return [
    `Target: ${target} (${PAGE_URLS[target]})`,
    "",
    "Status page card (approximate; the page lays it out its own way)",
    ...indented(cardLines(input.after).join("\n"), 2),
    "",
    "Slack (exact, as the publisher will send it; times are UTC)",
    ...indented(slack.join("\n"), 2),
    ...notes.flatMap((note) => ["", `Note: ${note}`]),
    "",
    "Slack posts are final. A message is never edited or deleted, and editing an update later",
    "does not post it again. Fix a mistake with a new update, not by editing this one.",
  ].join("\n");
}
