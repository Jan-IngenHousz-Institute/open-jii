import { describe, expect, it } from "vitest";

import { deltaGlyph, renderLevels, renderObservability } from "./render.js";
import type { MetricReading } from "./types.js";

function reading(
  id: string,
  name: string,
  value: number | null,
  baseline: number | null = null,
  runbook?: string,
): MetricReading {
  return {
    metric: {
      num: 1,
      id,
      name,
      family: "observability",
      source: "aws",
      phase: "P1",
      active: true,
      slots: ["exception"],
      runbook,
    },
    value,
    baseline,
    historyCount: 4,
  };
}

const options = { environment: "dev", runbookBaseUrl: "https://example.test" };
const clean = { configErrors: [], failedRegions: [] };

describe("deltaGlyph", () => {
  it("marks direction only outside a five percent dead band", () => {
    expect(deltaGlyph(150, 100, "4w")).toBe(" ▲ +50% vs 4w");
    expect(deltaGlyph(50, 100, "4w")).toBe(" ▼ -50% vs 4w");
    expect(deltaGlyph(102, 100, "4w")).toBe(" ▬ +2% vs 4w");
  });

  it("renders nothing without a baseline to compare against", () => {
    expect(deltaGlyph(10, null, "4w")).toBe("");
  });
});

describe("renderObservability", () => {
  it("is a single line saying so when nothing is wrong", () => {
    const output = renderObservability(
      [{ ...reading("a", "A", 1), evaluation: { state: "ok" } }],
      { configErrors: [], failedRegions: [] },
      options,
    );

    expect(output).toBe("*No anomalies* · 1 signals checked (dev)");
  });

  it("renders an anomaly with its reason, runbook and triage command", () => {
    const output = renderObservability(
      [
        {
          ...reading(
            "ingest-lag",
            "Kinesis iterator age",
            900000,
            1000,
            "docs/runbooks/ingest-lag.md",
          ),
          evaluation: { state: "anomaly", reason: "above threshold 600000" },
        },
      ],
      { configErrors: [], failedRegions: [] },
      options,
    );

    expect(output).toContain("*1 anomaly* (dev)");
    expect(output).toContain("Kinesis iterator age");
    expect(output).toContain("above threshold 600000");
    expect(output).toContain("<https://example.test/docs/runbooks/ingest-lag.md|runbook>");
    expect(output).toContain("claude /openjii-triage ingest-lag");
    // The raw context blob used to sit under every line. It repeated the value and the
    // reason already stated above it, in a channel humans read.
    expect(output).not.toContain('"id":"ingest-lag"');
  });

  it("pluralizes only when there are several anomalies", () => {
    const anomaly = {
      ...reading("a", "A", 5),
      evaluation: { state: "anomaly" as const, reason: "r" },
    };

    expect(
      renderObservability(
        [anomaly, { ...anomaly, metric: { ...anomaly.metric, id: "b" } }],
        { configErrors: [], failedRegions: [] },
        options,
      ),
    ).toContain("2 anomalies");
  });

  it("renders a nodata anomaly as absent rather than as zero", () => {
    const output = renderObservability(
      [
        {
          ...reading("dlt-heartbeat", "Heartbeat collector dead-man", null),
          evaluation: { state: "anomaly", reason: "no datapoints, expected continuously" },
        },
      ],
      { configErrors: [], failedRegions: [] },
      options,
    );

    expect(output).toContain("Heartbeat collector dead-man*: no data");
    expect(output).not.toContain(": 0 (");
  });

  it("surfaces silent signals and config errors as self-check lines", () => {
    const output = renderObservability(
      [{ ...reading("gone", "Gone", null), evaluation: { state: "missing" } }],
      { configErrors: ["broken"], failedRegions: [] },
      options,
    );

    expect(output).toContain("no datapoints for gone");
    expect(output).toContain("unresolved catalog placeholders for broken");
  });

  it("says a failed region is missing rather than healthy", () => {
    // Reporting no anomalies from a partial query is the worst possible output:
    // it reads as "nothing is wrong" when the truth is "we could not look".
    const output = renderObservability(
      [{ ...reading("a", "A", 1), evaluation: { state: "ok" } }],
      { configErrors: [], failedRegions: ["us-east-1"] },
      options,
    );

    expect(output).toContain("*No anomalies*");
    expect(output).toContain("CloudWatch queries failed in us-east-1");
    expect(output).toContain("missing above, not healthy");
  });

  it("omits the runbook link when no base url is configured", () => {
    const output = renderObservability(
      [
        {
          ...reading("a", "A", 1, null, "docs/runbooks/a.md"),
          evaluation: { state: "anomaly", reason: "r" },
        },
      ],
      { configErrors: [], failedRegions: [] },
      { environment: "dev" },
    );

    expect(output).not.toContain("runbook");
  });

  it("puts critical anomalies above warnings and marks them", () => {
    // Severity already decides who gets woken; it should decide reading order too.
    const warning = {
      ...reading("kinesis-write-throttling", "Throttling", 3),
      evaluation: { state: "anomaly" as const, reason: "nonzero" },
    };
    warning.metric.severity = "warning";
    const critical = {
      ...reading("ingest-forwarding-failures", "Forwarding failures", 20),
      evaluation: { state: "anomaly" as const, reason: "nonzero" },
    };
    critical.metric.severity = "critical";

    const output = renderObservability([warning, critical], clean, options);
    const lines = output.split("\n");

    expect(lines[1]).toContain("Forwarding failures");
    expect(lines[1]).toContain("*critical*");
    expect(lines[2]).toContain("Throttling");
    expect(lines[2]).not.toContain("*critical*");
  });

  it("reads a duration as a duration rather than an abbreviated float", () => {
    const entry = {
      ...reading("ingest-lag", "Iterator age", 8_797_000, null, "docs/runbooks/ingest-lag.md"),
      evaluation: { state: "anomaly" as const, reason: "above 2h" },
    };
    if (entry.metric.signal) {
      entry.metric.signal.unit = "milliseconds";
    } else {
      entry.metric.signal = { unit: "milliseconds" };
    }

    const output = renderObservability([entry], clean, options);

    expect(output).toContain("2h 27m");
    expect(output).not.toContain("8.8M");
  });
});

describe("renderLevels", () => {
  it("lists each reporting metric with its delta", () => {
    const output = renderLevels(
      [reading("m", "Measurements", 48_200, 40_000)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );

    expect(output).toContain("*Daily pulse* (dev)");
    expect(output).toContain("• Measurements: 48.2k ▲ +21% vs 4w");
    expect(output).not.toContain("Self-check");
  });

  it("skips metrics with no data rather than printing blanks", () => {
    const output = renderLevels(
      [reading("m", "Measurements", null)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );

    expect(output).toContain("No signals reporting yet.");
  });

  it("says the list is incomplete when a region or a placeholder dropped a metric", () => {
    const output = renderLevels(
      [reading("m", "Measurements", 12)],
      { configErrors: ["kinesis-incoming"], failedRegions: ["eu-central-1"] },
      "Daily pulse",
      "4w",
      options,
    );

    expect(output).toContain("• Measurements: 12");
    expect(output).toContain(
      "*Self-check:* the list above is incomplete; could not read eu-central-1, kinesis-incoming.",
    );
  });
});
