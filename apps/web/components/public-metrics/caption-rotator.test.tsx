import { act, render, screen } from "@/test/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

import type { MetricsCaption } from "@repo/api/domains/metrics/metrics.schema";

import { CaptionRotator } from "./caption-rotator";

const captions: MetricsCaption[] = [
  { kind: "streak", days: 312 },
  { kind: "endurance", days: 94 },
];

describe("CaptionRotator", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders one caption at a time and rotates", () => {
    vi.useFakeTimers();
    render(<CaptionRotator captions={captions} locale="en-US" />);

    expect(screen.getByText("captions.streak")).toBeInTheDocument();
    expect(screen.queryByText("captions.endurance")).not.toBeInTheDocument();

    act(() => {
      vi.advanceTimersByTime(5000);
    });

    expect(screen.getByText("captions.endurance")).toBeInTheDocument();
  });

  it("renders nothing for an empty pool", () => {
    const { container } = render(<CaptionRotator captions={[]} locale="en-US" />);

    expect(container).toBeEmptyDOMElement();
  });

  const allKinds: [MetricsCaption, string][] = [
    [{ kind: "streak", days: 312 }, "captions.streak"],
    [{ kind: "pace", secondsPerMeasurement: 11 }, "captions.pace"],
    [{ kind: "sessionSize", medianMeasurements: 45 }, "captions.sessionSize"],
    [{ kind: "endurance", days: 94 }, "captions.endurance"],
    [{ kind: "simultaneity", devices: 14 }, "captions.simultaneity"],
    [{ kind: "zonesPeakDay", zones: 9 }, "captions.zonesPeakDay"],
    [{ kind: "analysesRun", count: 212_400 }, "captions.analysesRun"],
    [{ kind: "avgMeasurementSize", bytes: 20_000 }, "captions.avgMeasurementSize"],
    [{ kind: "openDatasets", count: 18 }, "captions.openDatasets"],
    [{ kind: "sharedExperiments", count: 11 }, "captions.sharedExperiments"],
    [{ kind: "milestone", ordinal: 1_000_000, date: "2026-06-12" }, "captions.milestone"],
  ];

  it.each(allKinds)("has a template for the %o caption", (caption, key) => {
    render(<CaptionRotator captions={[caption]} locale="en-US" />);

    expect(screen.getByText(key)).toBeInTheDocument();
  });
});
