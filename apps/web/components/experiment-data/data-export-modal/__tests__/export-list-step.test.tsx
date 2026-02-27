import { createExportRecord } from "@/test/factories";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";
import type { ExportRecord } from "@repo/api";

import { ExportListStep } from "../steps/export-list-step";

/* --------------------------------- Mocks --------------------------------- */

// useDownloadExport — pragmatic mock (browser download API: blob + anchor + click)
const mockDownloadExport = vi.fn();
vi.mock("~/hooks/experiment/useDownloadExport/useDownloadExport", () => ({
  useDownloadExport: () => ({
    downloadExport: mockDownloadExport,
    isDownloading: false,
    downloadingExportId: null,
  }),
}));

/* -------------------------------- Helpers -------------------------------- */

const completedExport = createExportRecord({
  exportId: "export-1",
  experimentId: "exp-123",
  tableName: "raw_data",
  format: "csv",
  status: "completed",
  filePath: "/path/to/file.csv",
  rowCount: 100,
  fileSize: 1024,
  createdAt: "2024-01-01T00:00:00Z",
  completedAt: "2024-01-01T00:05:00Z",
});

const runningExport = createExportRecord({
  exportId: null,
  experimentId: "exp-123",
  tableName: "raw_data",
  format: "ndjson",
  status: "running",
  filePath: null,
  rowCount: null,
  fileSize: null,
  createdAt: "2024-01-01T00:00:00Z",
  completedAt: null,
});

const mountExports = (exports: ExportRecord[]) =>
  server.mount(contract.experiments.listExports, {
    body: { exports },
  });

const defaultProps = {
  experimentId: "exp-123",
  tableName: "raw_data",
  onCreateExport: vi.fn(),
  onClose: vi.fn(),
};

/* --------------------------------- Tests --------------------------------- */

describe("ExportListStep", () => {
  it("renders loading state", () => {
    server.mount(contract.experiments.listExports, {
      body: { exports: [] },
      delay: 999_999,
    });

    render(<ExportListStep {...defaultProps} />);
    expect(screen.getByText("experimentData.exportModal.loadingExports")).toBeInTheDocument();
  });

  it("renders error state", async () => {
    server.mount(contract.experiments.listExports, {
      body: { message: "Server error" } as never,
      status: 500,
    });

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/experimentData\.exportModal\.error/)).toBeInTheDocument();
    });
  });

  it("renders empty state when no exports exist", async () => {
    mountExports([]);

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.noExports")).toBeInTheDocument();
    });
  });

  it("renders completed export with metadata", async () => {
    mountExports([completedExport]);

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.exportCount")).toBeInTheDocument();
    });
    expect(screen.getByText("CSV")).toBeInTheDocument();
    expect(screen.getByText(/100/)).toBeInTheDocument();
  });

  it("renders running export without download button", async () => {
    mountExports([runningExport]);

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.status.running")).toBeInTheDocument();
    });
    expect(screen.getByText("NDJSON")).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    mountExports([]);
    const onClose = vi.fn();

    render(<ExportListStep {...defaultProps} onClose={onClose} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.noExports")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /common\.close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onCreateExport via dropdown menu", async () => {
    mountExports([]);
    const onCreateExport = vi.fn();

    render(<ExportListStep {...defaultProps} onCreateExport={onCreateExport} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.noExports")).toBeInTheDocument();
    });

    // Open the dropdown
    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /experimentData\.exportModal\.createExport/i }),
    );

    // Click CSV option
    await user.click(await screen.findByRole("menuitem", { name: "CSV" }));

    expect(onCreateExport).toHaveBeenCalledWith("csv");
  });

  it("calls downloadExport when download button is clicked", async () => {
    mountExports([completedExport]);

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("CSV")).toBeInTheDocument();
    });

    // The download button is an icon button
    const user = userEvent.setup();
    const downloadButton = screen.getByRole("button", { name: "" });
    await user.click(downloadButton);

    expect(mockDownloadExport).toHaveBeenCalledWith("export-1");
  });

  it("shows creating state", async () => {
    mountExports([]);

    render(<ExportListStep {...defaultProps} creationStatus="creating" />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.creating")).toBeInTheDocument();
    });
  });

  it("shows success state", async () => {
    mountExports([]);

    render(<ExportListStep {...defaultProps} creationStatus="success" />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.exportCreated")).toBeInTheDocument();
    });
  });
});
