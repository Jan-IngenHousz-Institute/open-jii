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
//   blocks: 2
//
//   ## User story
//   ...
//   ## Testing criteria
//
//   <!-- comment -->
//   Suggested implementation. ...
//
// `{{2}}` anywhere in a body or comment becomes the second ticket's identifier once it exists.

export interface DraftTicket {
  index: number;
  title: string;
  labels: string[];
  blocks: number[];
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

type FrontMatter = Partial<Record<string, string>>;

// The block may be empty; a draft with no front matter at all is also fine.
function splitFrontMatter(text: string): { meta: FrontMatter; rest: string } {
  const match = /^---\n([\s\S]*?)---\n/.exec(text);
  if (!match) return { meta: {}, rest: text };
  const meta: FrontMatter = {};
  for (const line of match[1].split("\n")) {
    const pair = /^([a-z]+):\s*(.*)$/.exec(line.trim());
    if (pair) meta[pair[1]] = pair[2].trim();
  }
  return { meta, rest: text.slice(match[0].length) };
}

function list(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

function parseTicket(index: number, chunk: string): DraftTicket {
  const lines = chunk.split("\n");
  const title = lines[0].replace(/^# /, "").trim();
  if (title.length === 0) throw new Error(`Ticket ${index}: empty title`);

  let labels: string[] = [];
  let blocks: number[] = [];
  let bodyStart = -1;
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line.startsWith("## ")) {
      bodyStart = i;
      break;
    }
    if (line.trim().length === 0) continue;
    const pair = /^(labels|blocks):\s*(.*)$/.exec(line);
    if (!pair) {
      throw new Error(
        `Ticket ${index} ("${title}"): only "labels:" and "blocks:" may sit between the title and the first "## " heading`,
      );
    }
    if (pair[1] === "labels") labels = list(pair[2]);
    if (pair[1] === "blocks") {
      blocks = list(pair[2]).map((item) => {
        const n = Number(item);
        if (!Number.isInteger(n) || n < 1) {
          throw new Error(`Ticket ${index} ("${title}"): blocks must list ticket numbers`);
        }
        return n;
      });
    }
  }
  if (bodyStart < 0) throw new Error(`Ticket ${index} ("${title}"): no "## " section`);

  const rest = lines.slice(bodyStart).join("\n");
  const marker = rest.indexOf(COMMENT_MARKER);
  const body = (marker < 0 ? rest : rest.slice(0, marker)).trim();
  const comment = marker < 0 ? null : rest.slice(marker + COMMENT_MARKER.length).trim();

  return { index, title, labels, blocks, body, comment: comment === "" ? null : comment };
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
    const targets = [...ticket.blocks, ...referencesIn(`${ticket.body}\n${ticket.comment ?? ""}`)];
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
