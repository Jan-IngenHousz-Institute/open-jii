import { createExperimentDataTable } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, waitFor } from "@/test/test-utils";
import { describe, it, expect } from "vitest";

import { contract, ExperimentTableName } from "@repo/api";

import { ExperimentMeasurements } from "./experiment-measurements";

/* --------------------------------- Helpers -------------------------------- */

function mountTables() {
  server.mount(contract.experiments.getExperimentTables, {
    body: [
      {
        name: ExperimentTableName.DEVICE,
        displayName: "Device",
        totalRows: 10,
      },
    ],
  });
}

function mountMeasurements(rows: Record<string, unknown>[] = [], opts?: { status?: number }) {
  mountTables();
  return server.mount(contract.experiments.getExperimentData, {
    body: [
      createExperimentDataTable({
        name: "device",
        data: {
          columns: [
            { name: "device_id", type_name: "STRING", type_text: "STRING" },
            { name: "processed_timestamp", type_name: "STRING", type_text: "STRING" },
          ],
          rows,
          totalRows: rows.length,
          truncated: false,
        },
        totalRows: rows.length,
        page: 1,
        pageSize: 4,
        totalPages: 1,
      }),
    ],
    ...(opts?.status ? { status: opts.status } : {}),
  });
}

/* ---------------------------------- Tests --------------------------------- */

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
    mountTables();
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

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /measurements\.seeAll/ })).toHaveAttribute(
        "href",
        "/en-US/platform/experiments/exp-456/data",
      );
    });
  });

  it("uses experiments-archive path when archived", async () => {
    mountMeasurements([{ device_id: "device-1", processed_timestamp: "2023-01-15T10:30:00Z" }]);

    render(<ExperimentMeasurements experimentId="exp-789" isArchived={true} />);

    await waitFor(() => {
      expect(screen.getByRole("link", { name: /measurements\.seeAll/ })).toHaveAttribute(
        "href",
        "/en-US/platform/experiments-archive/exp-789/data",
      );
    });
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
  });
});
