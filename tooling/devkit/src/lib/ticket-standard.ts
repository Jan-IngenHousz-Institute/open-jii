// The mechanical half of docs/agents/ticket-standard.md: the checks a script can run before a
// body is shown to a person. The judged half (INVEST, whether a criterion is invented) stays
// with the reader.

export type Shape = "work-item" | "bug" | "spike" | "project";

export interface ShapeSpec {
  headings: readonly string[];
  // Characters allowed, excluding the developer-filled sections.
  budget: number;
  devSections: readonly string[];
}

export interface Finding {
  rule: string;
  detail: string;
}

export interface Report {
  shape: Shape | null;
  characters: number;
  budget: number | null;
  longestBullet: number;
  findings: Finding[];
}

export const MAX_BULLET_WORDS = 25;
export const MAX_TITLE_LENGTH = 70;
// The developer-filled sections sit outside the body budget and carry their own.
export const DEV_SECTION_BUDGET = 1200;
const DEV_SECTIONS = ["How it was built", "Testing criteria"] as const;

export const SHAPES: Record<Shape, ShapeSpec> = {
  "work-item": {
    headings: [
      "User story",
      "Acceptance criteria",
      "Dependencies and risks",
      "Additional context",
      ...DEV_SECTIONS,
    ],
    budget: 1200,
    devSections: DEV_SECTIONS,
  },
  bug: {
    headings: ["Observed", "Expected", "Reproduction", "Environment", "Evidence", ...DEV_SECTIONS],
    budget: 800,
    devSections: DEV_SECTIONS,
  },
  spike: {
    headings: ["Question", "Why now", "Timebox", "Done when"],
    budget: 600,
    devSections: [],
  },
  project: {
    headings: [
      "Problem",
      "Outcome",
      "Non-goals",
      "Design",
      "Deliverables",
      "Done when",
      "Risks and dependencies",
    ],
    budget: 2500,
    devSections: [],
  },
};

interface Section {
  heading: string;
  content: string;
}

export function splitSections(body: string): Section[] {
  const sections: Section[] = [];
  let current: Section | null = null;
  for (const line of body.split("\n")) {
    const heading = /^## (.+?)\s*$/.exec(line)?.[1];
    if (heading !== undefined) {
      current = { heading, content: "" };
      sections.push(current);
    } else if (current !== null) {
      current.content += `${line}\n`;
    }
  }
  return sections.map((section) => ({ ...section, content: section.content.trim() }));
}

function shapeOf(firstHeading: string | undefined): Shape | null {
  for (const [shape, spec] of Object.entries(SHAPES)) {
    if (spec.headings[0] === firstHeading) return shape as Shape;
  }
  return null;
}

function bullets(text: string): string[] {
  return text
    .split("\n")
    .map((line) => /^\s*(?:[-*]|\d+\.)\s+(.+)$/.exec(line)?.[1])
    .filter((item): item is string => item !== undefined);
}

function wordCount(text: string): number {
  return text.split(/\s+/).filter((word) => word.length > 0).length;
}

// A full stop, question or exclamation mark, allowing a closing quote, backtick or bracket after
// it. This catches the telegraphic fragment; it cannot catch a fragment that ends in a full stop.
function endsAsSentence(text: string): boolean {
  return /[.?!]["'`)\]]*$/.test(text.trim());
}

function headingFindings(actual: readonly string[], expected: readonly string[]): Finding[] {
  if (actual.length === expected.length && actual.every((h, i) => h === expected[i])) return [];
  const missing = expected.filter((h) => !actual.includes(h));
  const extra = actual.filter((h) => !expected.includes(h));
  const parts: string[] = [];
  if (missing.length > 0) parts.push(`missing ${missing.map((h) => `"${h}"`).join(", ")}`);
  if (extra.length > 0) parts.push(`unexpected ${extra.map((h) => `"${h}"`).join(", ")}`);
  if (parts.length === 0) parts.push("headings are out of order");
  return [{ rule: "headings", detail: parts.join("; ") }];
}

export function checkTitle(title: string): Finding[] {
  const findings: Finding[] = [];
  if (title.length >= MAX_TITLE_LENGTH) {
    findings.push({
      rule: "title",
      detail: `${title.length} characters; the limit is ${MAX_TITLE_LENGTH}`,
    });
  }
  if (/^[A-Z][A-Z -]*:/.test(title)) {
    findings.push({ rule: "title", detail: "starts with a type prefix; that is a label" });
  }
  return findings;
}

export function checkBody(body: string): Report {
  const findings: Finding[] = [];
  const sections = splitSections(body);
  const shape = shapeOf(sections[0]?.heading);
  const spec = shape === null ? null : SHAPES[shape];

  if (spec === null) {
    findings.push({
      rule: "shape",
      detail: `first heading "${sections[0]?.heading ?? "(none)"}" matches no ticket or project shape`,
    });
  } else {
    findings.push(
      ...headingFindings(
        sections.map((s) => s.heading),
        spec.headings,
      ),
    );
  }

  const devSections = spec?.devSections ?? [];
  const counted = sections.filter((s) => !devSections.includes(s.heading));
  const countedText = counted.map((s) => `## ${s.heading}\n\n${s.content}`).join("\n\n");
  const characters = countedText.length;
  if (spec !== null && characters >= spec.budget) {
    findings.push({
      rule: "budget",
      detail: `${characters} characters; the ${shape ?? ""} budget is ${spec.budget}`,
    });
  }
  for (const section of sections) {
    if (devSections.includes(section.heading) && section.content.length >= DEV_SECTION_BUDGET) {
      findings.push({
        rule: "dev-section",
        detail: `${section.heading} is ${section.content.length} characters; the limit is ${DEV_SECTION_BUDGET}`,
      });
    }
  }

  let longestBullet = 0;
  for (const bullet of bullets(body)) {
    const words = wordCount(bullet);
    const opening = `"${bullet.split(/\s+/).slice(0, 8).join(" ")}..."`;
    longestBullet = Math.max(longestBullet, words);
    if (words >= MAX_BULLET_WORDS) {
      findings.push({ rule: "bullet", detail: `${words} words: ${opening}` });
    }
    if (!endsAsSentence(bullet)) {
      findings.push({ rule: "sentence", detail: `does not end as a sentence: ${opening}` });
    }
    if ((bullet.match(/;/g) ?? []).length >= 2) {
      findings.push({ rule: "sentence", detail: `semicolon chain, not a sentence: ${opening}` });
    }
  }
  for (const line of (sections.find((s) => s.heading === "User story")?.content ?? "").split(
    "\n",
  )) {
    const lead = /^\*\*(WHO|WHAT|WHY):\*\*\s*(.+)$/.exec(line);
    if (lead && !endsAsSentence(lead[2])) {
      findings.push({ rule: "sentence", detail: `${lead[1]} does not end as a sentence` });
    }
  }

  const dashes = (body.match(/[–—]/g) ?? []).length;
  if (dashes > 0) findings.push({ rule: "dash", detail: `${dashes} em or en dash(es)` });

  if (/\b(generated|written) by (an? )?(AI|agent|LLM)\b|\bAI[- ]generated\b/i.test(body)) {
    findings.push({ rule: "banner", detail: "carries an authorship banner" });
  }

  const contrasts = (countedText.match(/,\s*not\s/g) ?? []).length;
  if (contrasts > 1) {
    findings.push({
      rule: "contrast",
      detail: `${contrasts} "X, not Y" sentences; one is the limit`,
    });
  }

  if (shape === "work-item") {
    const story = sections.find((s) => s.heading === "User story")?.content ?? "";
    for (const part of ["WHO", "WHAT", "WHY"]) {
      if (!story.includes(`**${part}:**`)) {
        findings.push({ rule: "persona", detail: `User story has no **${part}:** line` });
      }
    }
    const criteria = sections.find((s) => s.heading === "Acceptance criteria")?.content ?? "";
    if (criteria.length === 0) {
      findings.push({ rule: "gate", detail: "Acceptance criteria is empty" });
    }
  }
  if (shape === "spike") {
    const done = sections.find((s) => s.heading === "Done when")?.content ?? "";
    if (done.length === 0) findings.push({ rule: "gate", detail: "Done when is empty" });
  }

  return { shape, characters, budget: spec?.budget ?? null, longestBullet, findings };
}
