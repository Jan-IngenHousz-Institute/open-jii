import { deviationPercent } from "./baseline.js";
import { formatValue } from "./format.js";
import type { CatalogMetric, Evaluation, MetricReading } from "./types.js";

export interface EvaluatedReading extends MetricReading {
  evaluation: Evaluation;
}

export interface RenderOptions {
  environment: string;
  runbookBaseUrl?: string;
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

function reading(entry: EvaluatedReading | MetricReading): string {
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

function runbookLink(metric: CatalogMetric, runbookBaseUrl?: string): string {
  if (!runbookBaseUrl || !metric.runbook) {
    return "";
  }
  return ` · <${runbookBaseUrl}/${metric.runbook}|runbook>`;
}

/** Things that went wrong with the digest itself, as opposed to with the platform. */
export interface SelfChecks {
  configErrors: string[];
  failedRegions: string[];
}

export function renderObservability(
  readings: EvaluatedReading[],
  { configErrors, failedRegions }: SelfChecks,
  { environment, runbookBaseUrl }: RenderOptions,
): string {
  const anomalies = readings.filter((entry) => entry.evaluation.state === "anomaly");
  const missing = readings.filter((entry) => entry.evaluation.state === "missing");
  const lines: string[] = [];

  if (anomalies.length === 0) {
    lines.push(`*No anomalies* · ${readings.length} signals checked (${environment})`);
  } else {
    lines.push(
      `*${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}* (${environment})`,
    );
    for (const entry of [...anomalies].sort(bySeverity)) {
      // Severity decides who is woken, so it belongs on the line rather than only in
      // the routing. A reading of "no data" is a nodata anomaly; printing 0 there
      // would read as a healthy counter.
      const mark = entry.metric.severity === "critical" ? "*critical* " : "";

      lines.push(
        `• ${mark}*${entry.metric.name}*: ${reading(entry)}, ${entry.evaluation.reason}` +
          `${runbookLink(entry.metric, runbookBaseUrl)} · \`claude /openjii-triage ${entry.metric.id}\``,
      );
    }
  }

  if (missing.length > 0) {
    lines.push(
      `*Self-check:* no datapoints for ${missing.map((entry) => entry.metric.id).join(", ")}` +
        ` (had data in prior weeks); excluded above.`,
    );
  }

  if (configErrors.length > 0) {
    lines.push(`*Self-check:* unresolved catalog placeholders for ${configErrors.join(", ")}.`);
  }

  // Without this the digest would report no anomalies from a partial query,
  // which reads as "nothing is wrong" when the truth is "we could not look".
  if (failedRegions.length > 0) {
    lines.push(
      `*Self-check:* CloudWatch queries failed in ${failedRegions.join(", ")};` +
        ` the metrics they cover are missing above, not healthy.`,
    );
  }

  return lines.join("\n");
}

export function renderLevels(
  readings: MetricReading[],
  { configErrors, failedRegions }: SelfChecks,
  title: string,
  window: string,
  { environment }: RenderOptions,
): string {
  const lines = [`*${title}* (${environment})`];

  for (const entry of readings) {
    if (entry.value === null) {
      continue;
    }
    lines.push(
      `• ${entry.metric.name}: ${formatValue(entry.value, entry.metric.signal?.unit)}` +
        `${deltaGlyph(entry.value, entry.baseline, window)}`,
    );
  }

  if (lines.length === 1) {
    lines.push("• No signals reporting yet.");
  }

  // A dropped metric leaves no line at all, so without this a quiet number and an
  // unreadable one look the same, and the audience reads a partial list as the total.
  const unread = [...failedRegions, ...configErrors];
  if (unread.length > 0) {
    lines.push(`*Self-check:* the list above is incomplete; could not read ${unread.join(", ")}.`);
  }

  return lines.join("\n");
}
