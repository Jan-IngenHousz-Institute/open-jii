import { deviationPercent } from "./baseline.js";
import { formatValue } from "./format.js";
import type { LinkButton, SlackBlock, SlackMessage } from "./slack.js";
import { actions, context, header, section, table } from "./slack.js";
import type { EvaluatedReading, MetricReading } from "./types.js";

export interface RenderOptions {
  environment: string;
  runbookBaseUrl?: string;
  /** Where the catalog entry lives, so a reader can change what a signal means. */
  catalogUrl?: string;
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

/** Largest movement first, so a reader sees what changed before what merely exists. */
function byMovement(a: MetricReading, b: MetricReading): number {
  const moved = (entry: MetricReading) =>
    entry.value === null ? -1 : Math.abs(deviationPercent(entry.value, entry.baseline) ?? 0);
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

/** One link out: the report, which is where everything else lives. */
function linkOut(options: RenderOptions): LinkButton[] {
  return options.reportUrl ? [{ label: "Open the report", url: options.reportUrl }] : [];
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

export function renderObservability(
  readings: EvaluatedReading[],
  checks: SelfChecks,
  options: RenderOptions,
): SlackMessage {
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
    const quietLinks = linkOut(options);
    if (quietLinks.length > 0) {
      quietBlocks.push(actions(quietLinks));
    }
    return { text, blocks: quietBlocks };
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

  const buttons = linkOut(options);
  if (buttons.length > 0) {
    blocks.push(actions(buttons));
  }
  lines.push(...notes);

  return { text: lines.join("\n"), blocks };
}

export function renderLevels(
  readings: MetricReading[],
  checks: SelfChecks,
  title: string,
  window: string,
  options: RenderOptions,
): SlackMessage {
  const reporting = readings.filter((entry) => entry.value !== null);
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
      deltaGlyph(entry.value ?? 0, entry.baseline, window)
        .replace(` vs ${window}`, "")
        .trim(),
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

  return { text: lines.join("\n"), blocks };
}
