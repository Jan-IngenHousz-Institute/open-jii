import { deviationPercent } from "./baseline.js";
import { formatValue } from "./format.js";
import type { LinkButton, SlackBlock, SlackMessage } from "./slack.js";
import { actions, context, divider, header, image, section, table } from "./slack.js";
import type { CatalogMetric, Evaluation, MetricReading } from "./types.js";

export interface EvaluatedReading extends MetricReading {
  evaluation: Evaluation;
  /** A CloudWatch-rendered chart of this metric, when the composer produced one. */
  chartUrl?: string;
}

export interface RenderOptions {
  environment: string;
  runbookBaseUrl?: string;
  /** Where the catalog entry lives, so a reader can change what a signal means. */
  catalogUrl?: string;
  /** CloudWatch console, for opening the query behind a reading. */
  consoleUrl?: string;
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

/**
 * Links, each answering a different question.
 *
 * Grafana's own alert template carries four: the query that produced the reading, the
 * dashboard, the panel, and a silence. This is the same idea with the links this system
 * has. The catalog entry stands in for the silence, because it is where a threshold
 * actually gets changed and the composer keeps no state between runs.
 */
function linksFor(metric: CatalogMetric, options: RenderOptions): LinkButton[] {
  const buttons: LinkButton[] = [];

  if (options.runbookBaseUrl && metric.runbook) {
    buttons.push({ label: "Runbook", url: `${options.runbookBaseUrl}/${metric.runbook}` });
  }
  if (options.consoleUrl && metric.signal?.namespace) {
    buttons.push({ label: "CloudWatch", url: options.consoleUrl });
  }
  if (options.catalogUrl) {
    buttons.push({ label: "Catalog entry", url: options.catalogUrl });
  }

  return buttons;
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

  if (anomalies.length === 0) {
    const quiet = `Heartbeat · ${environment} · nothing to act on · ${readings.length} signals checked`;
    blocks.push(context(quiet));
    lines.push(quiet);
  } else {
    const critical = anomalies.filter((entry) => entry.metric.severity === "critical").length;
    const noun = anomalies.length === 1 ? "anomaly" : "anomalies";
    const title = `Heartbeat · ${environment} · ${anomalies.length} ${noun}`;

    blocks.push(header(title));
    blocks.push(
      context(
        `${readings.length} signals checked · ${critical} critical · ${anomalies.length - critical} other`,
      ),
    );
    lines.push(title);

    for (const entry of [...anomalies].sort(bySeverity)) {
      const { metric } = entry;
      // Value first, the way Grafana's own template leads with it, then the identity
      // that makes it citable in a thread or a ticket, then what it means.
      const identity = `\`${metric.id}\` · ${metric.name}${metric.severity ? ` · ${metric.severity}` : ""}`;
      const body = [`*${readingOf(entry)}* · ${entry.evaluation.reason}`, identity, metric.notes]
        .filter((line): line is string => typeof line === "string" && line !== "")
        .join("\n");

      blocks.push(divider());
      blocks.push(section(body));

      if (entry.chartUrl) {
        blocks.push(image(entry.chartUrl, `${metric.name} over the anomaly window`));
      }

      const buttons = linksFor(metric, options);
      if (buttons.length > 0) {
        blocks.push(actions(buttons));
      }
      blocks.push(context(`\`claude /openjii-triage ${metric.id}\``));

      lines.push(`${readingOf(entry)} · ${entry.evaluation.reason} · ${metric.id}`);
    }
  }

  if (missing.length > 0) {
    notes.push(
      `No datapoints for ${missing.map((entry) => entry.metric.id).join(", ")}, which reported in prior weeks.`,
    );
  }

  if (notes.length > 0) {
    blocks.push(divider());
    for (const note of notes) {
      blocks.push(context(note));
    }
    lines.push(...notes);
  }

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
