import { deviationPercent } from "./baseline.js";
import type { CatalogMetric, Evaluation, MetricReading } from "./types.js";

export interface EvaluatedReading extends MetricReading {
  evaluation: Evaluation;
}

export interface RenderOptions {
  environment: string;
  runbookBaseUrl?: string;
}

export function formatValue(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${(value / 1_000).toFixed(1)}k`;
  }
  return Number.isInteger(value) ? String(value) : value.toFixed(2);
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

export function renderObservability(
  readings: EvaluatedReading[],
  configErrors: string[],
  { environment, runbookBaseUrl }: RenderOptions,
): string {
  const anomalies = readings.filter((entry) => entry.evaluation.state === "anomaly");
  const missing = readings.filter((entry) => entry.evaluation.state === "missing");
  const lines: string[] = [];

  if (anomalies.length === 0) {
    lines.push(`🟢 *No anomalies* · ${readings.length} signals checked (${environment})`);
  } else {
    lines.push(
      `🔴 *${anomalies.length} anomal${anomalies.length === 1 ? "y" : "ies"}* (${environment})`,
    );
    for (const entry of anomalies) {
      const context = JSON.stringify({
        id: entry.metric.id,
        value: entry.value,
        baseline: entry.baseline,
        reason: entry.evaluation.reason,
      });
      lines.push(
        `• *${entry.metric.name}*: ${formatValue(entry.value ?? 0)} (${entry.evaluation.reason})` +
          `${runbookLink(entry.metric, runbookBaseUrl)} · \`claude /triage ${entry.metric.id}\`` +
          `\n  \`${context}\``,
      );
    }
  }

  if (missing.length > 0) {
    lines.push(
      `⚠️ Self-check: no datapoints for ${missing.map((entry) => entry.metric.id).join(", ")}` +
        ` (had data in prior weeks); excluded above.`,
    );
  }

  if (configErrors.length > 0) {
    lines.push(`⚠️ Self-check: unresolved catalog placeholders for ${configErrors.join(", ")}.`);
  }

  return lines.join("\n");
}

export function renderLevels(
  readings: MetricReading[],
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
      `• ${entry.metric.name}: ${formatValue(entry.value)}${deltaGlyph(entry.value, entry.baseline, window)}`,
    );
  }

  if (lines.length === 1) {
    lines.push("• No signals reporting yet.");
  }

  return lines.join("\n");
}
