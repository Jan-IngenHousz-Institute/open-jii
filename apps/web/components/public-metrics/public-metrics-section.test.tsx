import { render, screen, waitFor } from "@/test/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { PublicMetricsResponse } from "@repo/api/domains/metrics/metrics.schema";

import { PublicMetricsSection } from "./public-metrics-section";

const metrics: PublicMetricsResponse = {
  registry: {
    registeredUsers: 42,
    organizations: 5,
    experiments: 17,
    protocols: 9,
    macros: 4,
  },
  totals: {
    totalMeasurements: 1234,
    totalUploadedRows: 50,
    totalMacroExecutions: 200,
    devicesAllTime: 11,
    experimentsWithData: 8,
    firstMeasurementAt: "2024-01-01 00:00:00",
    lastMeasurementAt: "2026-08-14 10:00:00",
    computedAt: "2026-08-14 10:05:00",
  },
  dailyActivity: [
    {
      date: "2026-08-13",
      measurements: 20,
      liveMeasurements: 20,
      importedMeasurements: 0,
      activeDevices: 4,
      activeExperiments: 3,
      macroExecutions: 6,
      uploadedRows: 5,
      cumulativeMeasurements: 1214,
    },
    {
      date: "2026-08-14",
      measurements: 20,
      liveMeasurements: 18,
      importedMeasurements: 2,
      activeDevices: 3,
      activeExperiments: 2,
      macroExecutions: 4,
      uploadedRows: 0,
      cumulativeMeasurements: 1234,
    },
  ],
  familyTotals: [
    {
      family: "multispeq",
      totalMeasurements: 900,
      devicesAllTime: 7,
      devicesActive7d: 3,
      lastMeasurementAt: "2026-08-14 10:00:00",
    },
    {
      family: "unattributed",
      totalMeasurements: 334,
      devicesAllTime: 4,
      devicesActive7d: 0,
      lastMeasurementAt: "2026-08-13 10:00:00",
    },
  ],
};

describe("PublicMetricsSection", () => {
  beforeEach(() => {
    // Reduced motion makes the tile count-up snap to its target, so these
    // assertions read final values instead of racing the animation.
    Object.defineProperty(window, "matchMedia", {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: query.includes("prefers-reduced-motion"),
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    });
  });

  it("renders header, tiles, chart titles, and family rows", async () => {
    render(<PublicMetricsSection metrics={metrics} locale="en-US" />);

    expect(screen.getByText("title")).toBeInTheDocument();
    expect(screen.getByText("subtitle")).toBeInTheDocument();

    expect(screen.getByText("tiles.measurements")).toBeInTheDocument();
    expect(screen.getByText("tiles.researchers")).toBeInTheDocument();
    expect(screen.getByText("tiles.experiments")).toBeInTheDocument();
    expect(screen.getByText("tiles.devices")).toBeInTheDocument();

    expect(screen.getByText("charts.growthTitle")).toBeInTheDocument();
    expect(screen.getByText("charts.activityTitle")).toBeInTheDocument();
    expect(screen.getByText("charts.familyTitle")).toBeInTheDocument();

    expect(screen.getByText("multispeq")).toBeInTheDocument();
    expect(screen.getByText("families.unattributed")).toBeInTheDocument();

    expect(screen.getByText("1,234")).toBeInTheDocument();

    // The liveness chip renders after mount once the timestamp parses.
    await waitFor(() => {
      expect(screen.getByText("lastMeasurement")).toBeInTheDocument();
    });
  });

  it("omits warehouse-derived pieces when totals are absent", () => {
    render(
      <PublicMetricsSection
        metrics={{ ...metrics, totals: null, dailyActivity: [], familyTotals: [] }}
        locale="en-US"
      />,
    );

    expect(screen.getByText("tiles.researchers")).toBeInTheDocument();
    expect(screen.queryByText("tiles.measurements")).not.toBeInTheDocument();
    expect(screen.queryByText("tiles.devices")).not.toBeInTheDocument();
    expect(screen.queryByText("charts.growthTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("charts.activityTitle")).not.toBeInTheDocument();
    expect(screen.queryByText("charts.familyTitle")).not.toBeInTheDocument();
  });
});
