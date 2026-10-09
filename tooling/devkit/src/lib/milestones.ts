// A milestone file sequences a project's work:
//
//   ---
//   project: Notifications
//   ---
//
//   # 1. Members see what happened to their work
//   was: Phase one
//   Nothing else can be tested without the feed, so it comes first.
//
// Each "# " heading is a milestone, in order of work. A "was:" line renames the milestone that
// carries the old name instead of creating a second one. The rest is the one-sentence reason it
// comes before the next.
import { plannedPositions } from "./ordering.js";
import type { ProjectMilestone } from "./projects.js";
import { sameName } from "./projects.js";
import { splitFrontMatter, unquoted } from "./ticket-draft.js";
import { endsAsSentence, proseFindings } from "./ticket-standard.js";
import type { Finding } from "./ticket-standard.js";

export interface DesiredMilestone {
  name: string;
  was: string | null;
  description: string;
}

export interface MilestoneFile {
  project: string | null;
  milestones: DesiredMilestone[];
}

export type MilestoneAction =
  | { kind: "create"; name: string; description: string; sortOrder: number }
  | {
      kind: "update";
      id: string;
      name: string;
      description: string;
      sortOrder: number;
      changes: string[];
    }
  | { kind: "keep"; name: string };

export interface MilestonePlan {
  actions: MilestoneAction[];
  // In Linear but not in the file. Nothing here deletes a milestone, so they stay as they are.
  leftAlone: ProjectMilestone[];
}

function parseMilestone(chunk: string): DesiredMilestone {
  const [heading = "", ...rest] = chunk.split("\n");
  const name = heading.replace(/^# /, "").trim();
  const lines = [...rest];
  while (lines.length > 0 && lines[0]?.trim() === "") lines.shift();
  const rename = /^was:\s*(.+)$/.exec(lines[0] ?? "")?.[1];
  if (rename !== undefined) lines.shift();
  return {
    name,
    was: rename === undefined ? null : unquoted(rename.trim()),
    description: lines.join("\n").trim(),
  };
}

export function parseMilestones(text: string): MilestoneFile {
  const { meta, rest } = splitFrontMatter(text);
  const chunks = rest
    .split(/^(?=# )/m)
    .map((chunk) => chunk.trim())
    .filter((chunk) => chunk.length > 0);
  if (chunks.length === 0) {
    throw new Error('A milestone file holds at least one milestone, each under a "# " heading');
  }
  const stray = chunks.find((chunk) => !chunk.startsWith("# "));
  if (stray !== undefined) {
    throw new Error(`Text before the first "# " heading: "${stray.slice(0, 40)}..."`);
  }
  return { project: meta.project ?? null, milestones: chunks.map(parseMilestone) };
}

export function checkMilestones(file: MilestoneFile): Finding[] {
  const findings: Finding[] = [];
  const seen = new Set<string>();
  file.milestones.forEach((milestone, offset) => {
    const position = offset + 1;
    const label = `${position}. "${milestone.name}"`;
    if (!milestone.name.startsWith(`${position}. `)) {
      findings.push({
        rule: "name",
        detail: `${label} must start with its position, as in "${position}. Members see their work"`,
      });
    }
    if (milestone.description.length === 0) {
      findings.push({
        rule: "reason",
        detail: `${label} has no reason for coming before the next`,
      });
    } else {
      if (!endsAsSentence(milestone.description)) {
        findings.push({
          rule: "reason",
          detail: `${label}: the reason does not end as a sentence`,
        });
      }
      if (/[.?!]["')\]]*\s+[A-Z]/.test(milestone.description)) {
        findings.push({ rule: "reason", detail: `${label}: the reason is more than one sentence` });
      }
    }
    if (seen.has(milestone.name.toLowerCase())) {
      findings.push({ rule: "name", detail: `${label} repeats an earlier name` });
    }
    seen.add(milestone.name.toLowerCase());
    findings.push(...proseFindings(`${milestone.name}\n${milestone.description}`));
  });
  return findings;
}

function descriptionOf(milestone: ProjectMilestone): string {
  return (milestone.description ?? "").trim();
}

export function planMilestones(
  desired: readonly DesiredMilestone[],
  existing: readonly ProjectMilestone[],
): MilestonePlan {
  const used = new Set<string>();
  const matched = desired.map((wanted) => {
    const candidates = existing.filter((m) => !used.has(m.id));
    const current =
      candidates.find((m) => sameName(m.name, wanted.name)) ??
      (wanted.was === null
        ? undefined
        : candidates.find((m) => sameName(m.name, wanted.was ?? "")));
    if (current !== undefined) used.add(current.id);
    return { wanted, current };
  });
  const positions = plannedPositions(matched.map(({ current }) => current?.sortOrder ?? null));

  const actions = matched.map(({ wanted, current }, offset): MilestoneAction => {
    const sortOrder = positions[offset] ?? 0;
    if (current === undefined) {
      return { kind: "create", name: wanted.name, description: wanted.description, sortOrder };
    }

    const changes: string[] = [];
    if (current.name !== wanted.name) changes.push(`renamed from "${current.name}"`);
    if (descriptionOf(current) !== wanted.description) changes.push("reason");
    if (current.sortOrder !== sortOrder) changes.push("order");
    return changes.length === 0
      ? { kind: "keep", name: wanted.name }
      : {
          kind: "update",
          id: current.id,
          name: wanted.name,
          description: wanted.description,
          sortOrder,
          changes,
        };
  });

  return { actions, leftAlone: existing.filter((m) => !used.has(m.id)) };
}
