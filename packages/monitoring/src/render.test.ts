import { describe, expect, it } from "vitest";

import { deltaGlyph, formatValue, renderLevels, renderObservability } from "./render.js";
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

describe("formatValue", () => {
  it("abbreviates large numbers and keeps small ones readable", () => {
    expect(formatValue(2_400_000)).toBe("2.4M");
    expect(formatValue(48_200)).toBe("48.2k");
    expect(formatValue(7)).toBe("7");
    expect(formatValue(1.5)).toBe("1.50");
  });
});

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
  it("is a single green line when nothing is wrong", () => {
    const output = renderObservability(
      [{ ...reading("a", "A", 1), evaluation: { state: "ok" } }],
      [],
      options,
    );

    expect(output).toBe("🟢 *No anomalies* · 1 signals checked (dev)");
  });

  it("renders an anomaly with its reason, runbook, triage command and context blob", () => {
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
      [],
      options,
    );

    expect(output).toContain("🔴 *1 anomaly* (dev)");
    expect(output).toContain("Kinesis iterator age");
    expect(output).toContain("above threshold 600000");
    expect(output).toContain("<https://example.test/docs/runbooks/ingest-lag.md|runbook>");
    expect(output).toContain("claude /openjii-triage ingest-lag");
    expect(output).toContain('"id":"ingest-lag"');
  });

  it("pluralizes only when there are several anomalies", () => {
    const anomaly = {
      ...reading("a", "A", 5),
      evaluation: { state: "anomaly" as const, reason: "r" },
    };

    expect(
      renderObservability(
        [anomaly, { ...anomaly, metric: { ...anomaly.metric, id: "b" } }],
        [],
        options,
      ),
    ).toContain("2 anomalies");
  });

  it("surfaces silent signals and config errors as self-check lines", () => {
    const output = renderObservability(
      [{ ...reading("gone", "Gone", null), evaluation: { state: "missing" } }],
      ["broken"],
      options,
    );

    expect(output).toContain("no datapoints for gone");
    expect(output).toContain("unresolved catalog placeholders for broken");
  });

  it("omits the runbook link when no base url is configured", () => {
    const output = renderObservability(
      [
        {
          ...reading("a", "A", 1, null, "docs/runbooks/a.md"),
          evaluation: { state: "anomaly", reason: "r" },
        },
      ],
      [],
      { environment: "dev" },
    );

    expect(output).not.toContain("runbook");
  });
});

describe("renderLevels", () => {
  it("lists each reporting metric with its delta", () => {
    const output = renderLevels(
      [reading("m", "Measurements", 48_200, 40_000)],
      "Daily pulse",
      "4w",
      options,
    );

    expect(output).toContain("*Daily pulse* (dev)");
    expect(output).toContain("• Measurements: 48.2k ▲ +21% vs 4w");
  });

  it("skips metrics with no data rather than printing blanks", () => {
    const output = renderLevels([reading("m", "Measurements", null)], "Daily pulse", "4w", options);

    expect(output).toContain("No signals reporting yet.");
  });
});
