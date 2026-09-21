import { lstat, readFile, readlink } from "node:fs/promises";
import { join } from "node:path";

import { repositoryRoot } from "../lib/config.js";
import { proseFindings } from "../lib/ticket-standard.js";
import {
  ROLE_PREFIX,
  readBaseline,
  readRoles,
  renderRoleSkill,
  skillDirectory,
} from "./generate-roles.js";
import type { RoleSource } from "./generate-roles.js";

export interface CheckFinding {
  where: string;
  detail: string;
}

/** Claude Code truncates a skill description at this length, so a longer one loses its tail. */
export const MAX_DESCRIPTION = 1536;
/** A role a session has to read in full before starting work. Past this it stops being read. */
export const MAX_SKILL_LINES = 400;

const CHATBOT_PHRASES = [
  "great question",
  "hope this helps",
  "of course!",
  "certainly!",
  "i'd be happy to",
];

function frontmatterValue(frontmatter: string, key: string): string | null {
  const match = new RegExp(`^${key}:\\s*(.+)$`, "m").exec(frontmatter);
  return match ? match[1].trim() : null;
}

// A capitalised function word is the giveaway: Title Case capitalises these and sentence case
// never does. Keying off them means a heading full of proper nouns is not mistaken for Title Case.
const FUNCTION_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "but",
  "of",
  "in",
  "on",
  "at",
  "to",
  "for",
  "with",
  "from",
  "by",
  "as",
  "is",
  "are",
  "into",
  "over",
  "per",
  "via",
  "when",
  "how",
  "what",
  "its",
  "it",
  "your",
  "you",
  "that",
  "this",
  "than",
  "then",
  "so",
  "not",
]);

/**
 * Headings that look like Title Case. Two independent signals: a capitalised function word after
 * the first word, or three or more capitalised words that are not acronyms.
 */
export function titleCaseHeadings(text: string): string[] {
  const found: string[] = [];

  for (const match of text.matchAll(/^#{1,6} (.+)$/gm)) {
    const heading = match[1];
    const words = heading.split(/\s+/).filter((word) => /^[A-Za-z]+$/.test(word));
    const rest = words.slice(1);
    const capitalisedFunctionWord = rest.some(
      (word) => /^[A-Z]/.test(word) && FUNCTION_WORDS.has(word.toLowerCase()),
    );
    const capitalised = rest.filter((word) => /^[A-Z]/.test(word) && word !== word.toUpperCase());
    if (capitalisedFunctionWord || capitalised.length >= 3) found.push(heading);
  }

  return found;
}

export function prosePoliceFindings(where: string, text: string): CheckFinding[] {
  const findings: CheckFinding[] = proseFindings(text).map((finding) => ({
    where,
    detail: `${finding.rule}: ${finding.detail}`,
  }));

  for (const heading of titleCaseHeadings(text)) {
    findings.push({ where, detail: `heading is not sentence case: "${heading}"` });
  }
  for (const phrase of CHATBOT_PHRASES) {
    if (text.toLowerCase().includes(phrase)) {
      findings.push({ where, detail: `chatbot phrase: "${phrase}"` });
    }
  }

  return findings;
}

function frontmatterFindings(role: RoleSource): CheckFinding[] {
  const findings: CheckFinding[] = [];
  const where = `.agents/roles/${role.slug}.md`;

  const name = frontmatterValue(role.frontmatter, "name");
  const expected = `${ROLE_PREFIX}${role.slug}`;
  if (name !== expected) {
    findings.push({ where, detail: `name is ${name ?? "missing"}; expected ${expected}` });
  }

  const description = frontmatterValue(role.frontmatter, "description");
  if (description === null) {
    findings.push({ where, detail: "no description" });
  } else if (description.length > MAX_DESCRIPTION) {
    findings.push({
      where,
      detail: `description is ${description.length} characters; the limit is ${MAX_DESCRIPTION}`,
    });
  }

  return findings;
}

async function generatedFindings(
  root: string,
  role: RoleSource,
  baseline: string,
): Promise<CheckFinding[]> {
  const path = join(skillDirectory(root, role.slug), "SKILL.md");
  const where = `.agents/skills/${ROLE_PREFIX}${role.slug}/SKILL.md`;
  const expected = renderRoleSkill(role, baseline);

  let actual: string;
  try {
    actual = await readFile(path, "utf8");
  } catch {
    return [{ where, detail: "missing; run pnpm roles:generate" }];
  }

  if (actual !== expected) {
    return [{ where, detail: "does not match its source; run pnpm roles:generate" }];
  }

  const lines = actual.split("\n").length;
  if (lines > MAX_SKILL_LINES) {
    return [{ where, detail: `${lines} lines; the limit is ${MAX_SKILL_LINES}` }];
  }

  return [];
}

async function symlinkFindings(root: string, role: RoleSource): Promise<CheckFinding[]> {
  const name = `${ROLE_PREFIX}${role.slug}`;
  const path = join(root, ".claude", "skills", name);
  const where = `.claude/skills/${name}`;

  try {
    const stats = await lstat(path);
    if (!stats.isSymbolicLink()) return [{ where, detail: "exists but is not a symlink" }];
  } catch {
    return [{ where, detail: `missing; run ln -s ../../.agents/skills/${name} ${where}` }];
  }

  const target = await readlink(path);
  const expected = `../../.agents/skills/${name}`;
  if (target !== expected) {
    return [{ where, detail: `points at ${target}; expected ${expected}` }];
  }

  return [];
}

export async function checkRoles(root: string): Promise<CheckFinding[]> {
  const baseline = await readBaseline(root);
  const roles = await readRoles(root);
  const findings: CheckFinding[] = [...prosePoliceFindings(".agents/roles/baseline.md", baseline)];

  for (const role of roles) {
    findings.push(
      ...prosePoliceFindings(`.agents/roles/${role.slug}.md`, role.body),
      ...frontmatterFindings(role),
      ...(await generatedFindings(root, role, baseline)),
      ...(await symlinkFindings(root, role)),
    );
  }

  return findings;
}

async function run(): Promise<number> {
  const root = repositoryRoot();
  const findings = await checkRoles(root);

  if (findings.length === 0) {
    process.stdout.write("roles: every source, generated skill and symlink agrees\n");
    return 0;
  }

  for (const finding of findings) {
    process.stdout.write(`${finding.where}: ${finding.detail}\n`);
  }
  process.stdout.write(`${findings.length} finding(s)\n`);
  return 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run();
}
