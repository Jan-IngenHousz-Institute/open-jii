import { deviationPercent } from "./baseline.js";
import { formatValue } from "./format.js";
import type { LinkButton, SlackBlock, SlackMessage } from "./slack.js";
import { actions, context, header, section, table } from "./slack.js";
import type { CatalogMetric, EvaluatedReading, MetricReading } from "./types.js";

/**
 * A parent message and one reply per anomaly.
 *
 * The parent is the whole morning at a glance. Each reply carries one anomaly's
 * identifier, its runbook and its triage command, so the channel stays one table however
 * bad the day is and nobody scrolls past the first problem to reach the second.
 *
 * With no bot token the composer posts the parent alone, so the replies are additive
 * rather than a prerequisite.
 */
export interface Digest {
  parent: SlackMessage;
  replies: SlackMessage[];
}

export interface RenderOptions {
  environment: string;
  runbookBaseUrl?: string;
  /**
   * The full report for this run. Slack carries the verdict and the table; everything
   * a reader might want after that lives one click away rather than in the message.
   */
  reportUrl?: string;
}

/**
 * Critical first: the order someone reads them in is the order they should act.
 *
 * Rank rather than indexOf, because indexOf returns -1 for a value it does not know and
 * an unrecognised severity would then sort above critical, which is the one place it
 * must never appear.
 */
const SEVERITY_RANK: Record<string, number> = { critical: 0, warning: 1 };
const UNRANKED = 2;

function rankOf(severity: string | undefined): number {
  return severity === undefined ? UNRANKED : (SEVERITY_RANK[severity] ?? UNRANKED);
}

function bySeverity(a: EvaluatedReading, b: EvaluatedReading): number {
  return rankOf(a.metric.severity) - rankOf(b.metric.severity);
}

type ReportingReading = MetricReading & { value: number };

function isReporting(entry: MetricReading): entry is ReportingReading {
  return entry.value !== null;
}

/** Largest movement first, so a reader sees what changed before what merely exists. */
function byMovement(a: ReportingReading, b: ReportingReading): number {
  const moved = (entry: ReportingReading) =>
    Math.abs(deviationPercent(entry.value, entry.baseline) ?? 0);
  return moved(b) - moved(a);
}

function readingOf(entry: MetricReading): string {
  return entry.value === null ? "no data" : formatValue(entry.value, entry.metric.signal?.unit);
}

export function deltaGlyph(value: number, baseline: number | null, window: string): string {
  const deviation = deviationPercent(value, baseline);
  if (deviation === null) {
    return "";
  }
  const arrow = deviation > 5 ? "▲" : deviation < -5 ? "▼" : "▬";
  return ` ${arrow} ${deviation > 0 ? "+" : ""}${deviation.toFixed(0)}% vs ${window}`;
}

/** The summary's one link: the evidence behind every number above it. */
function summaryLinks(options: RenderOptions): LinkButton[] {
  return options.reportUrl ? [{ label: "Open the report", url: options.reportUrl }] : [];
}

/** One anomaly's link: what to do about it. */
function runbookLink(metric: CatalogMetric, options: RenderOptions): LinkButton[] {
  return options.runbookBaseUrl && metric.runbook
    ? [{ label: "Runbook", url: `${options.runbookBaseUrl}/${metric.runbook}` }]
    : [];
}

/** Things that went wrong with the digest itself, as opposed to with the platform. */
export interface SelfChecks {
  configErrors: string[];
  failedRegions: string[];
}

function selfCheckLines({ configErrors, failedRegions }: SelfChecks): string[] {
  const lines: string[] = [];

  if (failedRegions.length > 0) {
    lines.push(
      `CloudWatch queries failed in ${failedRegions.join(", ")}; the metrics they cover are missing above, not healthy.`,
    );
  }
  if (configErrors.length > 0) {
    lines.push(`Unresolved catalog placeholders for ${configErrors.join(", ")}.`);
  }

  return lines;
}

/** One reply: what this anomaly is, and everything needed to act on it. */
function replyFor(entry: EvaluatedReading, options: RenderOptions): SlackMessage {
  const { metric } = entry;
  const body = [
    `*${metric.num} · ${metric.name}*`,
    `${readingOf(entry)} · ${entry.evaluation.reason ?? ""}`,
    metric.severity ? `\`${metric.id}\` · ${metric.severity}` : `\`${metric.id}\``,
  ].join("\n");

  const blocks: SlackBlock[] = [section(body)];
  const buttons = runbookLink(metric, options);

  if (buttons.length > 0) {
    blocks.push(actions(buttons));
  }
  blocks.push(context(`\`claude /openjii-triage ${metric.id}\``));

  return { text: `${metric.num} ${metric.name}: ${readingOf(entry)}`, blocks };
}

export function renderObservability(
  readings: EvaluatedReading[],
  checks: SelfChecks,
  options: RenderOptions,
): Digest {
  const { environment } = options;
  const anomalies = readings.filter((entry) => entry.evaluation.state === "anomaly");
  const missing = readings.filter((entry) => entry.evaluation.state === "missing");
  const notes = selfCheckLines(checks);
  const blocks: SlackBlock[] = [];
  const lines: string[] = [];

  if (missing.length > 0) {
    notes.push(
      `No datapoints for ${missing.map((entry) => entry.metric.id).join(", ")}, which reported in prior weeks.`,
    );
  }

  if (anomalies.length === 0) {
    const quiet = `Heartbeat · ${environment} · nothing to act on · ${readings.length} signals checked`;
    const text = [quiet, ...notes].join("\n");
    const quietBlocks: SlackBlock[] = [context(text)];
    const quietLinks = summaryLinks(options);

    if (quietLinks.length > 0) {
      quietBlocks.push(actions(quietLinks));
    }

    return { parent: { text, blocks: quietBlocks }, replies: [] };
  }

  const ordered = [...anomalies].sort(bySeverity);
  const noun = anomalies.length === 1 ? "anomaly" : "anomalies";
  const title = `Heartbeat · ${environment} · ${anomalies.length} ${noun}`;
  blocks.push(header(title));
  lines.push(title);

  // One table, grouped by severity. Detail and links live in the replies.
  const rows: string[][] = [];
  let group: string | undefined;

  for (const entry of ordered) {
    const severity = (entry.metric.severity ?? "other").toUpperCase();
    if (severity !== group) {
      if (group !== undefined) {
        rows.push([""]);
      }
      rows.push([severity]);
      group = severity;
    }

    rows.push([
      `  ${entry.metric.num}`,
      entry.metric.name,
      readingOf(entry),
      entry.evaluation.reason ?? "",
    ]);
    lines.push(`${entry.metric.num} ${entry.metric.name}: ${readingOf(entry)}`);
  }

  blocks.push(section(table(rows)));

  const footer = [`${readings.length} signals read`, ...notes];
  blocks.push(context(footer.join(" · ")));

  const buttons = summaryLinks(options);
  if (buttons.length > 0) {
    blocks.push(actions(buttons));
  }
  lines.push(...notes);

  return {
    parent: { text: lines.join("\n"), blocks },
    replies: ordered.map((entry) => replyFor(entry, options)),
  };
}

export function renderLevels(
  readings: MetricReading[],
  checks: SelfChecks,
  title: string,
  window: string,
  options: RenderOptions,
): Digest {
  const reporting = readings.filter(isReporting);
  const heading = `${title} · ${options.environment}`;
  const blocks: SlackBlock[] = [header(heading)];
  const lines = [heading];

  if (reporting.length === 0) {
    blocks.push(context("No signals reporting yet."));
    lines.push("No signals reporting yet.");
  } else {
    // Sorted by movement rather than dropped when flat. A level nobody has to act on is
    // still the answer to "how are we doing"; it just does not belong at the top.
    const rows = [...reporting].sort(byMovement).map((entry) => [
      entry.metric.name,
      readingOf(entry),
      // deltaGlyph leads with a space and names the window; a column wants neither.
      deltaGlyph(entry.value, entry.baseline, window).replace(` vs ${window}`, "").trim(),
    ]);

    blocks.push(section(table(rows)));
    blocks.push(context(`Change is against ${window}.`));
    lines.push(...rows.map((row) => `${row[0]}: ${row[1]} ${row[2]}`.trimEnd()));
  }

  const notes = selfCheckLines(checks);
  if (notes.length > 0) {
    blocks.push(context(`${notes.join(" ")} The list above is incomplete.`));
    lines.push(...notes);
  }

  const buttons = summaryLinks(options);
  if (buttons.length > 0) {
    blocks.push(actions(buttons));
  }

  // A level has no detail to open, so there is nothing to thread under it.
  return { parent: { text: lines.join("\n"), blocks }, replies: [] };
}
