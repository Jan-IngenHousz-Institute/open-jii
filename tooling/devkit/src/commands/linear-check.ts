import { readFile } from "node:fs/promises";

import { pathFromRoot, repositoryRoot } from "../lib/config.js";
import { parseDraft } from "../lib/ticket-draft.js";
import type { Draft } from "../lib/ticket-draft.js";
import { advisories, checkBody, checkTitle } from "../lib/ticket-standard.js";
import type { Finding, Report } from "../lib/ticket-standard.js";

export interface TicketReport {
  index: number;
  title: string;
  report: Report;
  findings: Finding[];
  advisories: string[];
}

export function checkDraft(draft: Draft): TicketReport[] {
  return draft.tickets.map((ticket) => {
    const report = checkBody(ticket.body);
    return {
      index: ticket.index,
      title: ticket.title,
      report,
      findings: [...checkTitle(ticket.title), ...report.findings],
      advisories: advisories(ticket.labels, ticket.body, report.shape),
    };
  });
}

export function formatReports(reports: readonly TicketReport[]): { text: string; ok: boolean } {
  const lines: string[] = [];
  let failing = 0;
  for (const { index, title, report, findings, advisories: notes } of reports) {
    const budget = report.budget === null ? "?" : String(report.budget);
    const summary = `[${report.shape ?? "unknown shape"} ${report.characters}/${budget}, bullet max ${report.longestBullet}]`;
    const isFailing = findings.length > 0;
    if (isFailing) failing += 1;
    lines.push(`${isFailing ? "FAIL" : "ok  "}  ${index}. ${title}  ${summary}`);
    for (const finding of findings) lines.push(`        ${finding.rule}: ${finding.detail}`);
    for (const note of notes) lines.push(`        note: ${note}`);
  }
  lines.push(`${reports.length} ticket(s) checked, ${failing} failing`);
  return { text: `${lines.join("\n")}\n`, ok: failing === 0 };
}

export function parseArgs(args: string[]): { file: string } {
  const file = args.find((arg) => !arg.startsWith("--"));
  if (!file) throw new Error("Usage: linear-check <draft.md>");
  return { file };
}

async function run(args: string[]): Promise<number> {
  const file = pathFromRoot(parseArgs(args).file, repositoryRoot());
  const draft = parseDraft(await readFile(file, "utf8"));
  const { text, ok } = formatReports(checkDraft(draft));
  process.stdout.write(text);
  return ok ? 0 : 1;
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  process.exitCode = await run(process.argv.slice(2));
}
