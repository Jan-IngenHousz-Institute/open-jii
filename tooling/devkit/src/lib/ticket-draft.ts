// A draft file holds one or more tickets for `linear:check` and `linear:create`:
//
//   ---
//   project: Platform home and research discovery
//   team: OJD
//   state: Backlog
//   ---
//
//   # Researcher can sort any resource list
//
//   labels: Feature, Fullstack
//   blocks: 2, OJD-1500
//   milestone: 1. Researchers can find a resource
//
//   ## User story
//   ...
//   ## Testing criteria
//
//   <!-- comment -->
//   Suggested implementation. ...
//
// Between the title and the first "## " heading a ticket may carry labels, blocks, blocked-by,
// related, milestone and state. A relation target is a ticket number in this draft or an existing
// identifier. `{{2}}` anywhere in a body or comment becomes the second ticket's identifier once it
// exists.
// A title that starts with an identifier, `# OJD-1810 Home shows public research`, updates that
// ticket's title, body and labels instead of creating one; its state is left alone.

// A ticket number in the same draft, or an identifier that already exists.
export type Target = number | string;

export interface DraftTicket {
  index: number;
  identifier: string | null;
  title: string;
  labels: string[];
  blocks: Target[];
  blockedBy: Target[];
  related: Target[];
  milestone: string | null;
  // Overrides the front matter state; an update only moves state when this is set.
  state: string | null;
  body: string;
  comment: string | null;
}

export interface Draft {
  project: string | null;
  team: string;
  state: string;
  tickets: DraftTicket[];
}

export const REFERENCE = /\{\{(\d+)\}\}/g;
const COMMENT_MARKER = "<!-- comment -->";
const DEFAULT_TEAM = "OJD";
const DEFAULT_STATE = "Backlog";

export type FrontMatter = Partial<Record<string, string>>;

// The block may be empty; a draft with no front matter at all is also fine.
export function splitFrontMatter(text: string): { meta: FrontMatter; rest: string } {
  const match = /^---\n([\s\S]*?)---\n/.exec(text);
  if (!match) return { meta: {}, rest: text };
  const meta: FrontMatter = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([a-z]+):\s*(.*)$/.exec(line.trim());
    if (pair) meta[pair[1]] = unquoted(pair[2].trim());
  }
  return { meta, rest: text.slice(match[0].length) };
}

export function unquoted(value: string): string {
  const quoted = /^(["'])(.*)\1$/.exec(value);
  return quoted ? quoted[2] : value;
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseTarget(index: number, title: string, item: string): Target {
  if (/^\d+$/.test(item) && Number(item) >= 1) return Number(item);
  if (/^[A-Za-z]+-\d+$/.test(item)) return item.toUpperCase();
  throw new Error(
    `Ticket ${index} ("${title}"): "${item}" is neither a ticket number nor an identifier like OJD-1234`,
  );
}

function parseTicket(index: number, chunk: string): DraftTicket {
  const lines = chunk.split("\n");
  const heading = lines[0].replace(/^# /, "").trim();
  const headed = /^([A-Z]+-\d+)\s+(.+)$/.exec(heading);
  const identifier = headed?.[1] ?? null;
  const title = (headed?.[2] ?? heading).trim();
  if (title.length === 0) throw new Error(`Ticket ${index}: empty title`);

  let labels: string[] = [];
  let blocks: Target[] = [];
  let blockedBy: Target[] = [];
  let related: Target[] = [];
  let milestone: string | null = null;
  let state: string | null = null;
  let bodyStart = -1;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      bodyStart = i;
      break;
    }
    if (line.trim().length === 0) continue;
    const pair = /^(labels|blocks|blocked-by|related|milestone|state):\s*(.*)$/.exec(line);
    if (!pair) {
      throw new Error(
        `Ticket ${index} ("${title}"): only labels, blocks, blocked-by, related, milestone and state may sit between the title and the first "## " heading`,
      );
    }
    const value = pair[2].trim();
    const targets = (): Target[] => list(value).map((item) => parseTarget(index, title, item));
    if (pair[1] === "labels") labels = list(value);
    if (pair[1] === "blocks") blocks = targets();
    if (pair[1] === "blocked-by") blockedBy = targets();
    if (pair[1] === "related") related = targets();
    if (pair[1] === "milestone") milestone = unquoted(value) || null;
    if (pair[1] === "state") state = unquoted(value) || null;
  }
  if (bodyStart < 0) throw new Error(`Ticket ${index} ("${title}"): no "## " section`);

  const rest = lines.slice(bodyStart).join("\n");
  const marker = rest.indexOf(COMMENT_MARKER);
  const body = (marker < 0 ? rest : rest.slice(0, marker)).trim();
  const comment = marker < 0 ? null : rest.slice(marker + COMMENT_MARKER.length).trim();

  return {
    index,
    identifier,
    title,
    labels,
    blocks,
    blockedBy,
    related,
    milestone,
    state,
    body,
    comment: comment === "" ? null : comment,
  };
}

function referencesIn(text: string): number[] {
  return [...text.matchAll(REFERENCE)].map((match) => Number(match[1]));
}

export function parseDraft(text: string): Draft {
  const { meta, rest } = splitFrontMatter(text);
  const chunks = rest
    .split(/^(?=# )/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
  if (chunks.length === 0)
    throw new Error('A draft holds at least one ticket, each under a "# " title');
  const stray = chunks.find((chunk) => !chunk.startsWith("# "));
  if (stray !== undefined) {
    throw new Error(`Text before the first "# " title: "${stray.slice(0, 40)}..."`);
  }

  const tickets = chunks.map((chunk, i) => parseTicket(i + 1, chunk));
  for (const ticket of tickets) {
    const relations = [...ticket.blocks, ...ticket.blockedBy, ...ticket.related];
    const targets = [
      ...relations.filter((target): target is number => typeof target === "number"),
      ...referencesIn(`${ticket.body}\n${ticket.comment ?? ""}`),
    ];
    for (const target of targets) {
      if (target === ticket.index) {
        throw new Error(`Ticket ${ticket.index} ("${ticket.title}") refers to itself`);
      }
      if (target > tickets.length) {
        throw new Error(
          `Ticket ${ticket.index} ("${ticket.title}") refers to ticket ${target}; there are ${tickets.length}`,
        );
      }
    }
  }

  return {
    project: meta.project ?? null,
    team: meta.team ?? DEFAULT_TEAM,
    state: meta.state ?? DEFAULT_STATE,
    tickets,
  };
}

export function substituteReferences(
  text: string,
  identifiers: ReadonlyMap<number, string>,
): string {
  return text.replace(
    REFERENCE,
    (whole, digits: string) => identifiers.get(Number(digits)) ?? whole,
  );
}
