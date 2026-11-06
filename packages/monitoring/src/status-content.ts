import { z } from "zod/mini";

import {
  STATUS_HISTORY_DAYS,
  incidentSchema,
  incidentUpdateSchema,
  noticeSchema,
} from "./status-document.js";
import type { Incident, IncidentUpdate, Notice } from "./status-document.js";

// What an editor writes in Contentful for the status page: incidents with their updates, and the
// notices that reuse the site's alert entries. The publisher POSTs STATUS_CONTENT_QUERY and maps
// the answer here, so nothing an editor types can reach the document without passing its schema.

export const STATUS_CONTENT_LOCALE = "en-US";

/** The Contentful environment both the publisher and the devkit read. */
export const STATUS_CONTENTFUL_ENVIRONMENT = "master";

/** The most updates an incident carries, as the content model caps them. */
export const STATUS_UPDATES_LIMIT = 20;

const DAY_MS = 86_400_000;

// Each incident collection costs its limit times 21 (the incident and up to 20 updates), so these
// limits come to about 4,200 of Contentful's 11,000 query complexity.
export const STATUS_CONTENT_QUERY = `
fragment StatusIncidentFields on StatusIncident {
  sys {
    id
  }
  title
  kind
  impact
  components
  startsAt
  endsAt
  resolvedAt
  updatesCollection(limit: ${STATUS_UPDATES_LIMIT}, locale: $locale) {
    items {
      sys {
        id
      }
      stage
      postedAt
      text
      nextUpdateBy
    }
  }
}

query statusContent($now: DateTime!, $since: DateTime!, $locale: String!) {
  open: statusIncidentCollection(
    locale: $locale
    limit: 50
    order: [startsAt_DESC]
    where: { resolvedAt_exists: false, startsAt_lte: $now }
  ) {
    items {
      ...StatusIncidentFields
    }
  }
  recent: statusIncidentCollection(
    locale: $locale
    limit: 100
    order: [startsAt_DESC]
    where: { startsAt_lte: $now, OR: [{ startsAt_gte: $since }, { resolvedAt_gte: $since }] }
  ) {
    items {
      ...StatusIncidentFields
    }
  }
  upcoming: statusIncidentCollection(
    locale: $locale
    limit: 50
    order: [startsAt_ASC]
    where: { kind: "maintenance", startsAt_gt: $now }
  ) {
    items {
      ...StatusIncidentFields
    }
  }
  notices: componentAlertCollection(
    locale: $locale
    limit: 20
    where: {
      active: true
      audience: "status"
      startAt_lte: $now
      OR: [{ endAt_gt: $now }, { endAt_exists: false }]
    }
  ) {
    items {
      sys {
        id
      }
      title
      body {
        json
      }
      severity
    }
  }
}
`;

export interface StatusContentVariables {
  now: string;
  since: string;
  locale: string;
}

export function statusContentVariables(now: Date): StatusContentVariables {
  return {
    now: now.toISOString(),
    since: new Date(now.getTime() - STATUS_HISTORY_DAYS * DAY_MS).toISOString(),
    locale: STATUS_CONTENT_LOCALE,
  };
}

const rawUpdateSchema = z.object({
  sys: z.object({ id: z.string() }),
  stage: z.nullish(z.string()),
  postedAt: z.nullish(z.string()),
  text: z.nullish(z.string()),
  nextUpdateBy: z.nullish(z.string()),
});
type RawUpdate = z.infer<typeof rawUpdateSchema>;

const rawIncidentSchema = z.object({
  sys: z.object({ id: z.string() }),
  title: z.nullish(z.string()),
  kind: z.nullish(z.string()),
  impact: z.nullish(z.string()),
  components: z.nullish(z.array(z.string())),
  startsAt: z.nullish(z.string()),
  endsAt: z.nullish(z.string()),
  resolvedAt: z.nullish(z.string()),
  updatesCollection: z.nullish(z.object({ items: z.array(z.nullable(rawUpdateSchema)) })),
});
type RawIncident = z.infer<typeof rawIncidentSchema>;

const rawNoticeSchema = z.object({
  sys: z.object({ id: z.string() }),
  title: z.nullish(z.string()),
  body: z.nullish(z.object({ json: z.unknown() })),
  severity: z.nullish(z.string()),
});
type RawNotice = z.infer<typeof rawNoticeSchema>;

const incidentCollectionSchema = z.object({ items: z.array(z.nullable(rawIncidentSchema)) });

/**
 * The `data` of Contentful's answer. A missing collection is an error rather than an empty one,
 * since an empty one would clear the incidents already on the page. Entries stay loose: one that
 * is half written is dropped when mapped, not here, so it cannot fail the whole read.
 */
export const statusContentResponseSchema = z.object({
  open: incidentCollectionSchema,
  recent: incidentCollectionSchema,
  upcoming: incidentCollectionSchema,
  notices: z.object({ items: z.array(z.nullable(rawNoticeSchema)) }),
});
export type StatusContentResponse = z.infer<typeof statusContentResponseSchema>;

const graphqlErrorSchema = z.object({
  message: z.optional(z.string()),
  extensions: z.nullish(
    z.object({ contentful: z.nullish(z.object({ code: z.nullish(z.string()) })) }),
  ),
});

const graphqlBodySchema = z.object({
  data: z.unknown(),
  errors: z.optional(z.array(graphqlErrorSchema)),
});

// Contentful answers 200 with this code in extensions.contentful.code, and the linked field null,
// when an incident links an update that is unpublished, archived or deleted. That is a draft in
// progress and not a failed read (https://www.contentful.com/developers/docs/references/graphql/graphql-errors/).
const UNRESOLVABLE_LINK = "UNRESOLVABLE_LINK";

/** Throws on any GraphQL error but an unresolvable link, since the data beside it may be partial. */
export function parseStatusContentResponse(body: unknown): StatusContentResponse {
  const { data, errors = [] } = graphqlBodySchema.parse(body);
  const failures = errors.filter(
    (error) => error.extensions?.contentful?.code !== UNRESOLVABLE_LINK,
  );

  if (failures.length > 0) {
    const messages = failures.map((error) => error.message ?? "unknown error").join("; ");
    throw new Error(`Contentful answered with errors: ${messages}`);
  }

  return statusContentResponseSchema.parse(data);
}

export interface StatusContent {
  incidents: Incident[];
  notices: Notice[];
}

/** The entries left out for not satisfying the contract, by id, so the publisher can log them. */
export interface DroppedEntries {
  incidents: string[];
  notices: string[];
}

export interface StatusContentRead extends StatusContent {
  dropped: DroppedEntries;
}

/** The last good read, kept so the page keeps its notes while Contentful is unreachable. */
export const cachedStatusContentSchema = z.object({
  fetchedAt: z.iso.datetime(),
  incidents: z.array(incidentSchema),
  notices: z.array(noticeSchema),
});
export type CachedStatusContent = z.infer<typeof cachedStatusContentSchema>;

interface RichTextNode {
  nodeType: string;
  value?: string | undefined;
  content?: RichTextNode[] | undefined;
}

const richTextNodeSchema: z.ZodMiniType<RichTextNode> = z.lazy(() =>
  z.object({
    nodeType: z.string(),
    value: z.optional(z.string()),
    content: z.optional(z.array(richTextNodeSchema)),
  }),
);

function isInline(node: RichTextNode): boolean {
  return (
    node.nodeType === "text" ||
    node.nodeType.endsWith("hyperlink") ||
    node.nodeType.endsWith("-inline")
  );
}

function inlineText(node: RichTextNode): string {
  if (node.nodeType === "text") {
    return node.value ?? "";
  }
  return (node.content ?? []).map(inlineText).join("");
}

/** A block holding text is a paragraph; any other block only holds more blocks. */
function paragraphsOf(node: RichTextNode): string[] {
  const children = node.content ?? [];

  return children.some(isInline) ? [inlineText(node)] : children.flatMap(paragraphsOf);
}

function plainTextOf(json: unknown): string {
  const parsed = richTextNodeSchema.safeParse(json);

  return parsed.success
    ? paragraphsOf(parsed.data)
        .filter((paragraph) => paragraph.trim() !== "")
        .join("\n\n")
    : "";
}

/** An unreadable value is passed on as it is, so the contract rejects the entry that carries it. */
export function isoOf(value: string | null | undefined): string | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}

function updateOf(raw: RawUpdate | null): IncidentUpdate | undefined {
  if (raw === null) {
    return undefined;
  }

  const nextUpdateBy = isoOf(raw.nextUpdateBy);

  const parsed = incidentUpdateSchema.safeParse({
    id: raw.sys.id,
    stage: raw.stage,
    postedAt: isoOf(raw.postedAt),
    text: raw.text,
    ...(nextUpdateBy === undefined ? {} : { nextUpdateBy }),
  });

  return parsed.success ? parsed.data : undefined;
}

function incidentOf(raw: RawIncident): Incident | undefined {
  const updates = (raw.updatesCollection?.items ?? [])
    .map(updateOf)
    .filter((update) => update !== undefined)
    .sort((a, b) => Date.parse(b.postedAt) - Date.parse(a.postedAt));

  const endsAt = isoOf(raw.endsAt);
  const resolvedAt = isoOf(raw.resolvedAt);

  const parsed = incidentSchema.safeParse({
    id: raw.sys.id,
    kind: raw.kind,
    title: raw.title,
    impact: raw.impact,
    components: raw.components,
    startsAt: isoOf(raw.startsAt),
    ...(endsAt === undefined ? {} : { endsAt }),
    ...(resolvedAt === undefined ? {} : { resolvedAt }),
    updates,
  });

  return parsed.success ? parsed.data : undefined;
}

function severityOf(value: string | null | undefined): Notice["severity"] {
  const parsed = noticeSchema.shape.severity.safeParse(value);

  return parsed.success ? parsed.data : "info";
}

function noticeOf(raw: RawNotice): Notice | undefined {
  const parsed = noticeSchema.safeParse({
    id: raw.sys.id,
    title: raw.title,
    body: plainTextOf(raw.body?.json),
    severity: severityOf(raw.severity),
  });

  return parsed.success ? parsed.data : undefined;
}

const SEVERITY_RANK: Record<Notice["severity"], number> = { critical: 0, warning: 1, info: 2 };

function byStart(a: Incident, b: Incident): number {
  return Date.parse(a.startsAt) - Date.parse(b.startsAt) || a.id.localeCompare(b.id);
}

function bySeverity(a: Notice, b: Notice): number {
  return SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id);
}

/**
 * Maps what Contentful returned onto the document contract. An entry that does not satisfy it is
 * left out, and so is an update it links to, so a draft in progress cannot stop the publisher.
 * Incidents come oldest start first, updates newest first as the page shows them, and notices
 * most severe first.
 */
export function toStatusContent(response: StatusContentResponse): StatusContentRead {
  const raw = new Map<string, RawIncident>();

  for (const { items } of [response.open, response.recent, response.upcoming]) {
    for (const item of items) {
      if (item !== null && !raw.has(item.sys.id)) {
        raw.set(item.sys.id, item);
      }
    }
  }

  const incidents: Incident[] = [];
  const notices: Notice[] = [];
  const dropped: DroppedEntries = { incidents: [], notices: [] };

  for (const item of raw.values()) {
    const incident = incidentOf(item);
    if (incident === undefined) {
      dropped.incidents.push(item.sys.id);
    } else {
      incidents.push(incident);
    }
  }

  for (const item of response.notices.items) {
    if (item === null) {
      continue;
    }

    const notice = noticeOf(item);
    if (notice === undefined) {
      dropped.notices.push(item.sys.id);
    } else {
      notices.push(notice);
    }
  }

  return { incidents: incidents.sort(byStart), notices: notices.sort(bySeverity), dropped };
}
