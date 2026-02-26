import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract } from "@repo/api";

import { ExperimentMeasurements } from "./experiment-measurements";

// Hoisted: must precede vi.mock calls that reference these spies
const { useExperimentDataSpy, useExperimentTablesSpy } = vi.hoisted(() => {
  return {
    useExperimentDataSpy: vi.fn(() => ({
      tableRows: null as unknown[] | null,
      isLoading: false,
      error: null as Error | null,
    })),
    useExperimentTablesSpy: vi.fn(() => ({
      tables: [{ identifier: "device", tableType: "static", displayName: "Device", totalRows: 10 }],
      isLoading: false,
      error: null as Error | null,
    })),
  };
});

// useExperimentData — pragmatic mock (heavy: tsr query + tanstack-table column creation + cell formatting)
vi.mock("~/hooks/experiment/useExperimentData/useExperimentData", () => ({
  useExperimentData: (...args: unknown[]) => useExperimentDataSpy(...args),
}));

// useExperimentTables — pragmatic mock (coupled with useExperimentData; tests control table metadata)
vi.mock("~/hooks/experiment/useExperimentTables/useExperimentTables", () => ({
  useExperimentTables: (...args: unknown[]) => useExperimentTablesSpy(...args),
}));

vi.mock("~/util/date", () => ({
  formatDate: (dateString: string) => `formatted-${dateString}`,
}));

describe("ExperimentMeasurements", () => {
  it("renders loading then empty state when no measurements", async () => {
    mountMeasurements([]);

    render(<ExperimentMeasurements experimentId="exp-123" />);

    // Initially shows loading
    expect(screen.getByText("measurements.latestMeasurements")).toBeInTheDocument();

    // Eventually shows empty
    await waitFor(() => {
      expect(screen.getByText("measurements.noMeasurements")).toBeInTheDocument();
    });
  });

  it("renders empty state when API errors", async () => {
    server.mount(contract.experiments.getExperimentData, { status: 500 });

    render(<ExperimentMeasurements experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("measurements.noMeasurements")).toBeInTheDocument();
    });
  });

  it("renders table with measurement data", async () => {
    mountMeasurements([
      { device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" },
      { device_id: "device-2", processed_timestamp: "2023-01-16T14:45:00Z" },
    ]);

    render(<ExperimentMeasurements experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("device-1")).toBeInTheDocument();
    });

    expect(screen.getByText("measurements.latestMeasurements")).toBeInTheDocument();
    expect(screen.getByText("measurements.deviceId")).toBeInTheDocument();
    expect(screen.getByText("measurements.lastProcessed")).toBeInTheDocument();
    expect(screen.getByText("device-2")).toBeInTheDocument();
    expect(screen.getByText("2023-01-15")).toBeInTheDocument();
    expect(screen.getByText("2023-01-16")).toBeInTheDocument();
  });

  it("renders see all link pointing to experiment data page", async () => {
    mountMeasurements([{ device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" }]);

    render(<ExperimentMeasurements experimentId="exp-456" isArchived={false} />);

    const link = screen.getByRole("link", { name: "measurements.seeAll" });
    expect(link).toHaveAttribute("href", "/en-US/platform/experiments/exp-456/data");
    expect(screen.getByText("measurements.seeAll")).toBeInTheDocument();
  });

  it("uses experiments-archive path when archived", async () => {
    mountMeasurements([{ device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" }]);

    render(<ExperimentMeasurements experimentId="exp-789" isArchived={true} />);

    const link = screen.getByRole("link", { name: "measurements.seeAll" });
    expect(link).toHaveAttribute("href", "/en-US/platform/experiments-archive/exp-789/data");
  });

  it("shows dash for null device_id", async () => {
    mountMeasurements([{ device_id: null, processed_timestamp: "2023-01-15T10:30:00Z" }]);

    render(<ExperimentMeasurements experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("shows dash for null timestamp", async () => {
    mountMeasurements([{ device_id: "device-1", processed_timestamp: null }]);

    render(<ExperimentMeasurements experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("device-1")).toBeInTheDocument();
    });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders numeric device_id as string", async () => {
    mountMeasurements([{ device_id: 12345, processed_timestamp: "2023-01-15T10:30:00Z" }]);

    render(<ExperimentMeasurements experimentId="exp-123" />);

    await waitFor(() => {
      expect(screen.getByText("12345")).toBeInTheDocument();
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
      tables: [
        { identifier: "raw_data", tableType: "static", displayName: "Raw Data", totalRows: 5 },
      ],
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
