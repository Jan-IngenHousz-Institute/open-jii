import "@testing-library/jest-dom/vitest";
import { render, screen } from "@testing-library/react";
import React from "react";
import { describe, it, expect, vi } from "vitest";

import { ExperimentMeasurements } from "./experiment-measurements";

globalThis.React = React;

// ---------- Hoisted mocks ----------
const { useExperimentDataSpy } = vi.hoisted(() => {
  return {
    useExperimentDataSpy: vi.fn(() => ({
      tableRows: null as unknown[] | null,
      isLoading: false,
      error: null as Error | null,
    })),
  };
});

// ---------- Mocks ----------
vi.mock("@repo/i18n", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock("~/hooks/experiment/useExperimentData/useExperimentData", () => ({
  useExperimentData: () => useExperimentDataSpy(),
}));

vi.mock("~/hooks/useLocale", () => ({
  useLocale: () => "en",
}));

vi.mock("~/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href} data-testid="measurements-link">
      {children}
    </a>
  ),
}));

describe("ExperimentMeasurements", () => {
  it("renders loading state", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: null,
      isLoading: true,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("measurements.latestMeasurements")).toBeInTheDocument();
    const loadingElement = document.querySelector(".animate-pulse");
    expect(loadingElement).toBeInTheDocument();
  });

  it("renders empty state when no measurements", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("measurements.noMeasurements")).toBeInTheDocument();
  });

  it("renders empty state when error occurs", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: null,
      isLoading: false,
      error: new Error("Failed to fetch"),
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("measurements.noMeasurements")).toBeInTheDocument();
  });

  it("renders table with measurement data", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [
        { device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" },
        { device_id: "device-2", processed_timestamp: "2023-01-16T14:45:00Z" },
      ],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("measurements.latestMeasurements")).toBeInTheDocument();
    expect(screen.getByText("measurements.deviceId")).toBeInTheDocument();
    expect(screen.getByText("measurements.lastProcessed")).toBeInTheDocument();
    expect(screen.getByText("device-1")).toBeInTheDocument();
    expect(screen.getByText("device-2")).toBeInTheDocument();
    expect(screen.getByText("formatted-2023-01-15T10:30:00Z")).toBeInTheDocument();
    expect(screen.getByText("formatted-2023-01-16T14:45:00Z")).toBeInTheDocument();
  });

  it("renders see all link for non-archived experiments", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [{ device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-456" isArchived={false} />);

    const link = screen.getByTestId("measurements-link");
    expect(link).toHaveAttribute("href", "/en/platform/experiments/exp-456/data");
    expect(screen.getByText("measurements.seeAll")).toBeInTheDocument();
  });

  it("renders see all link for archived experiments", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [{ device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-789" isArchived={true} />);

    const link = screen.getByTestId("measurements-link");
    expect(link).toHaveAttribute("href", "/en/platform/experiments-archive/exp-789/data");
  });

  it("handles null device_id", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [{ device_id: null, processed_timestamp: "2023-01-15T10:30:00Z" }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("handles null timestamp", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [{ device_id: "device-1", processed_timestamp: null }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("handles numeric device_id", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [{ device_id: 12345, processed_timestamp: "2023-01-15T10:30:00Z" }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("12345")).toBeInTheDocument();
  });

  it("renders component successfully", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-test-123" />);

    expect(screen.getByText("measurements.noMeasurements")).toBeInTheDocument();
  });
});
