import { describe, expect, it } from "vitest";

import { deltaGlyph, renderLevels, renderObservability } from "./render.js";
import type { CatalogMetric, MetricReading } from "./types.js";

function reading(
  id: string,
  name: string,
  value: number | null,
  baseline: number | null = null,
  runbook?: string,
  extra: Partial<CatalogMetric> = {},
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
      ...extra,
    },
    value,
    baseline,
    historyCount: 4,
  };
}

const options = {
  environment: "dev",
  runbookBaseUrl: "https://example.test",
  catalogUrl: "https://example.test/catalog",
};
const clean = { configErrors: [], failedRegions: [] };

function json(message: { blocks: { type: string }[] }, type?: string): string {
  const blocks = type ? message.blocks.filter((block) => block.type === type) : message.blocks;
  return JSON.stringify(blocks);
}

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
  it("is one context block and one line when nothing is wrong", () => {
    const message = renderObservability(
      [{ ...reading("a", "A", 1), evaluation: { state: "ok" } }],
      clean,
      options,
    );

    expect(message.blocks).toHaveLength(1);
    expect(message.blocks[0].type).toBe("context");
    expect(message.text).toBe("Heartbeat · dev · nothing to act on · 1 signals checked");
  });

  it("leads with the reading, then the id, then the name", () => {
    // Grafana's own template puts the value first. The id is what makes a line citable
    // in a thread or a ticket.
    const message = renderObservability(
      [
        {
          ...reading("ingest-lag", "Pipeline lag", 8_797_000, null, "docs/runbooks/ingest-lag.md", {
            signal: { unit: "milliseconds" },
            severity: "critical",
          }),
          evaluation: { state: "anomaly", reason: "above 2h" },
        },
      ],
      clean,
      options,
    );
    const body = json(message, "section");

    expect(body.indexOf("2h 27m")).toBeLessThan(body.indexOf("ingest-lag"));
    expect(body.indexOf("ingest-lag")).toBeLessThan(body.indexOf("Pipeline lag"));
    expect(body).toContain("above 2h");
  });

  it("offers the runbook and the catalog entry as separate actions", () => {
    const message = renderObservability(
      [
        {
          ...reading("ingest-lag", "Pipeline lag", 9, null, "docs/runbooks/ingest-lag.md"),
          evaluation: { state: "anomaly", reason: "above 2h" },
        },
      ],
      clean,
      options,
    );

    expect(json(message, "actions")).toContain("Runbook");
    expect(json(message, "actions")).toContain("https://example.test/docs/runbooks/ingest-lag.md");
    expect(json(message, "actions")).toContain("Catalog entry");
    expect(json(message, "context")).toContain("claude /openjii-triage ingest-lag");
  });

  it("places a chart only when the composer produced one", () => {
    const base = {
      ...reading("ingest-lag", "Pipeline lag", 9),
      evaluation: { state: "anomaly" as const, reason: "above 2h" },
    };

    const without = renderObservability([base], clean, options);
    const withChart = renderObservability(
      [{ ...base, chartUrl: "https://example.test/chart.png" }],
      clean,
      options,
    );

    expect(without.blocks.some((block) => block.type === "image")).toBe(false);
    expect(withChart.blocks.some((block) => block.type === "image")).toBe(true);
  });

  it("puts critical anomalies above everything else", () => {
    const warning = {
      ...reading("throttling", "Throttling", 3, null, undefined, { severity: "warning" }),
      evaluation: { state: "anomaly" as const, reason: "nonzero" },
    };
    const critical = {
      ...reading("forwarding", "Forwarding failures", 20, null, undefined, {
        severity: "critical",
      }),
      evaluation: { state: "anomaly" as const, reason: "nonzero" },
    };

    const body = json(renderObservability([warning, critical], clean, options), "section");

    expect(body.indexOf("Forwarding failures")).toBeLessThan(body.indexOf("Throttling"));
  });

  it("renders a nodata anomaly as absent rather than as zero", () => {
    const message = renderObservability(
      [
        {
          ...reading("dlt-heartbeat", "Collector", null),
          evaluation: { state: "anomaly", reason: "no datapoints, expected continuously" },
        },
      ],
      clean,
      options,
    );

    expect(message.text).toContain("no data");
  });

  it("says a failed region is missing rather than healthy", () => {
    const message = renderObservability(
      [],
      { configErrors: [], failedRegions: ["us-east-1"] },
      options,
    );

    expect(message.text).toContain("us-east-1");
    expect(message.text).toContain("missing above, not healthy");
  });

  it("names a signal that used to report and has gone quiet", () => {
    const message = renderObservability(
      [{ ...reading("gone", "Gone", null), evaluation: { state: "missing" } }],
      { configErrors: ["broken"], failedRegions: [] },
      options,
    );

    expect(message.text).toContain("No datapoints for gone");
    expect(message.text).toContain("Unresolved catalog placeholders for broken");
  });
});

describe("renderLevels", () => {
  it("renders a preformatted table so the columns line up", () => {
    const message = renderLevels(
      [reading("m", "Measurements", 48_200, 40_000)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );

    expect(message.blocks[0].type).toBe("header");
    expect(json(message, "section")).toContain("```");
    expect(message.text).toContain("Measurements: 48.2k ▲ +21%");
  });

  it("puts the biggest mover first and keeps the flat ones", () => {
    // A level nobody has to act on still answers "how are we doing"; it just should not
    // lead the message.
    const message = renderLevels(
      [reading("flat", "Flat", 100, 100), reading("moved", "Moved", 200, 100)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );
    const body = json(message, "section");

    expect(body.indexOf("Moved")).toBeLessThan(body.indexOf("Flat"));
    expect(body).toContain("Flat");
  });

  it("skips metrics with no data rather than printing blanks", () => {
    const message = renderLevels(
      [reading("m", "Measurements", null)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );

    expect(message.text).toContain("No signals reporting yet.");
  });

  it("says the list is incomplete when a region or a placeholder dropped a metric", () => {
    const message = renderLevels(
      [reading("m", "Measurements", 12)],
      { configErrors: ["kinesis-incoming"], failedRegions: ["eu-central-1"] },
      "Daily pulse",
      "4w",
      options,
    );

    expect(json(message, "context")).toContain("The list above is incomplete");
    expect(message.text).toContain("eu-central-1");
  });
});
