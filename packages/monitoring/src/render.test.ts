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
    const digest = renderObservability(
      [{ ...reading("a", "A", 1), evaluation: { state: "ok" } }],
      clean,
      options,
    );

    expect(digest.blocks).toHaveLength(1);
    expect(digest.blocks[0].type).toBe("context");
    expect(digest.text).toBe("Heartbeat · dev · nothing to act on · 1 signals checked");
  });

  it("leads a row with the citable number, then the name, then the reading", () => {
    const digest = renderObservability(
      [
        {
          ...reading("ingest-lag", "Pipeline lag", 8_797_000, null, "docs/runbooks/ingest-lag.md", {
            num: 8,
            signal: { unit: "milliseconds" },
            severity: "critical",
          }),
          evaluation: { state: "anomaly", reason: "above 2h" },
        },
      ],
      clean,
      options,
    );
    const body = json(digest, "section");

    expect(body.indexOf("8")).toBeLessThan(body.indexOf("Pipeline lag"));
    expect(body.indexOf("Pipeline lag")).toBeLessThan(body.indexOf("2h 27m"));
    expect(body).toContain("above 2h");
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

  it("heads the ungraded group with what to do, since OTHER says nothing", () => {
    const unrated = {
      ...reading("silent-devices", "Silent devices", 12, 3),
      evaluation: { state: "anomaly" as const, reason: "300% above the last 4 Tuesdays" },
    };

    const body = json(renderObservability([unrated], clean, options), "section");

    expect(body).toContain("FOR REVIEW");
    expect(body).not.toContain("OTHER");
  });

  it("renders a nodata anomaly as absent rather than as zero", () => {
    const digest = renderObservability(
      [
        {
          ...reading("dlt-heartbeat", "Collector", null),
          evaluation: { state: "anomaly", reason: "no datapoints, expected continuously" },
        },
      ],
      clean,
      options,
    );

    expect(digest.text).toContain("no data");
  });

  it("says a failed region is missing rather than healthy", () => {
    const digest = renderObservability(
      [],
      { configErrors: [], failedRegions: ["us-east-1"] },
      options,
    );

    expect(digest.text).toContain("us-east-1");
    expect(digest.text).toContain("missing above, not healthy");
  });

  it("names a signal that used to report and has gone quiet", () => {
    const digest = renderObservability(
      [{ ...reading("gone", "Gone", null), evaluation: { state: "missing" } }],
      { configErrors: ["broken"], failedRegions: [] },
      options,
    );

    expect(digest.text).toContain("No datapoints for gone");
    expect(digest.text).toContain("Unresolved catalog placeholders for broken");
  });
});

describe("renderLevels", () => {
  it("renders a preformatted table so the columns line up", () => {
    const digest = renderLevels(
      [reading("m", "Measurements", 48_200, 40_000)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );

    expect(digest.blocks[0].type).toBe("header");
    expect(json(digest, "section")).toContain("```");
    expect(digest.text).toContain("Measurements: 48.2k ▲ +21%");
  });

  it("puts the biggest mover first and keeps the flat ones", () => {
    // A level nobody has to act on still answers "how are we doing"; it just should not
    // lead the message.
    const digest = renderLevels(
      [reading("flat", "Flat", 100, 100), reading("moved", "Moved", 200, 100)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );
    const body = json(digest, "section");

    expect(body.indexOf("Moved")).toBeLessThan(body.indexOf("Flat"));
    expect(body).toContain("Flat");
  });

  it("skips metrics with no data rather than printing blanks", () => {
    const digest = renderLevels(
      [reading("m", "Measurements", null)],
      clean,
      "Daily pulse",
      "4w",
      options,
    );

    expect(digest.text).toContain("No signals reporting yet.");
  });

  it("says the list is incomplete when a region or a placeholder dropped a metric", () => {
    const digest = renderLevels(
      [reading("m", "Measurements", 12)],
      { configErrors: ["kinesis-incoming"], failedRegions: ["eu-central-1"] },
      "Daily pulse",
      "4w",
      options,
    );

    expect(json(digest, "context")).toContain("The list above is incomplete");
    expect(digest.text).toContain("eu-central-1");
  });
});

describe("the report link", () => {
  it("offers one way out of the message, and only when a report exists", () => {
    const entry = {
      ...reading("ingest-lag", "Lag", 9, null, "docs/runbooks/ingest-lag.md"),
      evaluation: { state: "anomaly" as const, reason: "above 2h" },
    };

    const without = renderObservability([entry], clean, options);
    const withReport = renderObservability([entry], clean, {
      ...options,
      reportUrl: "https://example.test/report.html",
    });

    expect(json(without, "actions")).not.toContain("Open the report");
    expect(json(withReport, "actions")).toContain("https://example.test/report.html");
  });

  it("links the report even on a quiet morning, since the numbers are still there", () => {
    const digest = renderObservability([], clean, {
      ...options,
      reportUrl: "https://example.test/report.html",
    });

    expect(json(digest, "actions")).toContain("Open the report");
  });
});

describe("each anomaly's detail", () => {
  const anomaly = (id: string, name: string, num: number, severity?: "critical" | "warning") => ({
    ...reading(id, name, 20, 0, `docs/runbooks/${id}.md`, {
      num,
      severity,
      signal: { namespace: "AWS/IoT" },
    }),
    evaluation: { state: "anomaly" as const, reason: "expected 0" },
  });

  it("follows the summary in the same order, critical first", () => {
    const message = renderObservability(
      [anomaly("b", "B", 8, "warning"), anomaly("a", "A", 2, "critical")],
      clean,
      options,
    );
    const details = json(message, "section");

    expect(details.indexOf("*2 · A*")).toBeLessThan(details.indexOf("*8 · B*"));
  });

  it("carries the identifier, the runbook and the triage command", () => {
    // The runbook and the triage command are what turn a reading into an action, so
    // they travel with the summary rather than behind a link.
    const message = renderObservability(
      [anomaly("ingest-lag", "Lag", 8, "critical")],
      clean,
      options,
    );

    expect(json(message, "section")).toContain("`ingest-lag`");
    expect(json(message, "actions")).toContain("https://example.test/docs/runbooks/ingest-lag.md");
    expect(json(message, "context")).toContain("claude /openjii-triage ingest-lag");
  });

  it("stays inside Slack's block limit however bad the day, and says what it left out", () => {
    const readings = Array.from({ length: 40 }, (_, index) =>
      anomaly(`signal-${index + 1}`, `Signal ${index + 1}`, index + 1, "critical"),
    );
    const message = renderObservability(readings, clean, options);

    expect(message.blocks.length).toBeLessThanOrEqual(50);
    expect(json(message, "context")).toMatch(/\d+ more: signal-\d+/);
    expect(json(message, "context")).not.toContain("on the report");
  });

  it("points the overflow at the report only when there is one", () => {
    const readings = Array.from({ length: 40 }, (_, index) =>
      anomaly(`signal-${index + 1}`, `Signal ${index + 1}`, index + 1, "critical"),
    );
    const message = renderObservability(readings, clean, {
      ...options,
      reportUrl: "https://example.test/report",
    });

    expect(json(message, "context")).toMatch(/\d+ more on the report: signal-\d+/);
  });

  it("adds nothing under a quiet morning", () => {
    const message = renderObservability([], clean, options);

    expect(message.blocks.some((block) => block.type === "divider")).toBe(false);
  });
});

describe("a level with no reading", () => {
  it("is named rather than dropped, so a shrunken note cannot pass as complete", () => {
    // Registrations vanished from a weekly note this way, and nothing said so.
    const message = renderLevels(
      [
        reading("measurements", "Measurements", 48_200, 40_000),
        reading("registrations", "Registrations", null),
      ],
      clean,
      "Week in numbers",
      "last week",
      options,
    );

    expect(json(message, "context")).toContain("No reading for registrations.");
    expect(json(message, "context")).toContain("The list above is incomplete");
    expect(message.text).toContain("No reading for registrations.");
  });
});
