import { render, screen } from "@/test/test-utils";
import { describe, expect, it } from "vitest";

import type { PublicMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { PublicMetricsSection } from "./public-metrics-section";

const metrics: PublicMetricsResponse = {
  hero: { totalMeasurements: 1_254_306, totalVolumeBytes: 340_000_000_000, timezonesSpanned: 14 },
  liveness: { lastMeasurementAt: "2026-08-28 10:00:00", measurements24h: 1_428 },
  community: {
    measurements30d: 4_812,
    activeExperiments30d: 23,
    contributors30d: 31,
    institutions30d: 9,
  },
  activity: [
    {
      date: "2026-08-27",
      measurements: 20,
      cumulativeMeasurements: 1_254_286,
      volumeBytes: 400_000,
    },
    {
      date: "2026-08-28",
      measurements: 20,
      cumulativeMeasurements: 1_254_306,
      volumeBytes: 400_000,
    },
  ],
  hourly: [
    { hourLocal: 11, measurements: 240 },
    { hourLocal: 12, measurements: 246 },
  ],
  families: [
    { family: "multispeq", measurements: 812_000 },
    { family: "unattributed", measurements: 46_000 },
  ],
  derivedParameter: { name: "Phi2", count30d: 4_214, median: 0.62 },
  sensorParameter: { name: "humidity", count30d: 4_797, median: 42.85 },
  captions: [
    { kind: "streak", days: 312 },
    { kind: "milestone", ordinal: 1_000_000, date: "2026-06-12" },
  ],
  computedAt: "2026-08-28 10:05:00",
};

describe("PublicMetricsSection", () => {
  it("renders every populated slot", () => {
    render(<PublicMetricsSection metrics={metrics} locale="en-US" />);

    expect(screen.getByText("indicator.active")).toBeInTheDocument();
    expect(screen.getByText("hero.sentence")).toBeInTheDocument();
    expect(screen.getByText("community.sentence")).toBeInTheDocument();
    expect(screen.getByText("activityChart.title.daily")).toBeInTheDocument();
    expect(screen.getByText("families.title")).toBeInTheDocument();
    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("parameter.derivedSentence")).toBeInTheDocument();
    expect(screen.getByText("parameter.sensorSentence")).toBeInTheDocument();
    expect(screen.getByText("captions.streak")).toBeInTheDocument();
  });

  it("renders nothing before the pipeline's first refresh", () => {
    const { container } = render(
      <PublicMetricsSection
        metrics={{
          hero: null,
          liveness: null,
          community: null,
          activity: [],
          hourly: [],
          families: [],
          derivedParameter: null,
          sensorParameter: null,
          captions: [],
          computedAt: null,
        }}
        locale="en-US"
      />,
    );

    expect(container).toBeEmptyDOMElement();
  });

  it("hides the instrument breakdown while unresolved publishers dominate", () => {
    render(
      <PublicMetricsSection
        metrics={{
          ...metrics,
          families: [
            { family: "multispeq", measurements: 14_000 },
            { family: "unattributed", measurements: 35_000_000 },
          ],
        }}
        locale="en-US"
      />,
    );

    expect(screen.queryByText("families.title")).not.toBeInTheDocument();
  });

  it("omits absent slots while rendering the rest", () => {
    render(
      <PublicMetricsSection
        metrics={{
          ...metrics,
          hourly: [],
          derivedParameter: null,
          sensorParameter: null,
          families: [],
        }}
        locale="en-US"
      />,
    );

    expect(screen.getByText("hero.sentence")).toBeInTheDocument();
    expect(screen.queryByText("families.title")).not.toBeInTheDocument();
    expect(screen.queryByText("parameter.derivedSentence")).not.toBeInTheDocument();
    expect(screen.queryByText("parameter.sensorSentence")).not.toBeInTheDocument();
  });
});
