import { render, screen } from "@/test/test-utils";
import { describe, it, expect, vi } from "vitest";

import { ExperimentMeasurements } from "./experiment-measurements";

// ---------- Hoisted mocks ----------
const { useExperimentDataSpy, useExperimentTablesSpy } = vi.hoisted(() => {
  return {
    useExperimentDataSpy: vi.fn(() => ({
      tableRows: null as unknown[] | null,
      isLoading: false,
      error: null as Error | null,
    })),
    useExperimentTablesSpy: vi.fn(() => ({
      tables: [{ name: "device", displayName: "Device", totalRows: 10 }],
      isLoading: false,
      error: null as Error | null,
    })),
  };
});

// ---------- Mocks ----------
vi.mock("~/hooks/experiment/useExperimentData/useExperimentData", () => ({
  useExperimentData: (...args: unknown[]) => useExperimentDataSpy(...args),
}));

vi.mock("~/hooks/experiment/useExperimentTables/useExperimentTables", () => ({
  useExperimentTables: (...args: unknown[]) => useExperimentTablesSpy(...args),
}));

vi.mock("~/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
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
    // No table rows should be rendered while loading
    expect(screen.queryByText("measurements.deviceId")).not.toBeInTheDocument();
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
    expect(screen.getByText("2023-01-15")).toBeInTheDocument();
    expect(screen.getByText("2023-01-16")).toBeInTheDocument();
  });

  it("renders see all link for non-archived experiments", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [{ device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-456" isArchived={false} />);

    const link = screen.getByRole("link", { name: /measurements\.seeAll/ });
    expect(link).toHaveAttribute("href", "/en-US/platform/experiments/exp-456/data");
  });

  it("renders see all link for archived experiments", () => {
    useExperimentDataSpy.mockReturnValue({
      tableRows: [{ device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" }],
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-789" isArchived={true} />);

    const link = screen.getByRole("link", { name: /measurements\.seeAll/ });
    expect(link).toHaveAttribute("href", "/en-US/platform/experiments-archive/exp-789/data");
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

  it("renders empty state when device table is not available", () => {
    useExperimentTablesSpy.mockReturnValue({
      tables: [{ name: "raw_data", displayName: "Raw Data", totalRows: 5 }],
      isLoading: false,
      error: null,
    });
    useExperimentDataSpy.mockReturnValue({
      tableRows: null,
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("measurements.noMeasurements")).toBeInTheDocument();
    expect(useExperimentDataSpy).toHaveBeenCalledWith(expect.objectContaining({ enabled: false }));
  });

  it("renders loading state when tables are loading", () => {
    useExperimentTablesSpy.mockReturnValue({
      tables: undefined,
      isLoading: true,
      error: null,
    });
    useExperimentDataSpy.mockReturnValue({
      tableRows: null,
      isLoading: false,
      error: null,
    });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    expect(screen.getByText("measurements.latestMeasurements")).toBeInTheDocument();
    const loadingElement = document.querySelector(".animate-pulse");
    expect(loadingElement).toBeInTheDocument();
  });
});
