import { createExportRecord } from "@/test/factories";
import { server } from "@/test/msw/server";
import {
  act,
  createTestQueryClient,
  render,
  screen,
  userEvent,
  waitFor,
  within,
} from "@/test/test-utils";
import type React from "react";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api/contract";
import type { ExperimentExportRecord } from "@repo/api/domains/experiment/experiment.schema";
import type * as DialogModule from "@repo/ui/components/dialog";
import { toast } from "@repo/ui/hooks/use-toast";

import { ExportListStep } from "../steps/export-list-step";

vi.mock("@repo/ui/components/dialog", async (importOriginal) => {
  const actual = await importOriginal<typeof DialogModule>();
  return {
    ...actual,
    DialogBody: (props: React.ComponentProps<typeof actual.DialogBody>) => (
      <actual.DialogBody data-testid="dialog-body" {...props} />
    ),
  };
});

const completedExport = createExportRecord({
  exportId: "export-1",
  experimentId: "exp-123",
  tableName: "raw_data",
  format: "csv",
  status: "completed",
  rowCount: 100,
  totalBytes: 1024,
  partCount: 1,
  createdAt: "2024-01-01T00:00:00Z",
  completedAt: "2024-01-01T00:05:00Z",
});

const multiPartExport = createExportRecord({
  exportId: "export-2",
  experimentId: "exp-123",
  format: "parquet",
  status: "completed",
  rowCount: 32_117_212,
  totalBytes: 27_457_507_736,
  partCount: 2,
});

const runningExport = createExportRecord({
  exportId: "export-3",
  experimentId: "exp-123",
  tableName: "raw_data",
  format: "ndjson",
  status: "running",
  rowCount: null,
  totalBytes: null,
  partCount: null,
  createdAt: "2024-01-01T00:00:00Z",
  completedAt: null,
  expiresAt: null,
});

const twoPartLinks = {
  parts: [
    {
      index: 0,
      fileName: "trial_raw-data_20240101_000500_part-1-of-2.parquet",
      sizeBytes: 20_000_000_000,
      url: "https://exports.s3.test/part-00000.parquet?X-Amz-Signature=a",
    },
    {
      index: 1,
      fileName: "trial_raw-data_20240101_000500_part-2-of-2.parquet",
      sizeBytes: 7_457_507_736,
      url: "https://exports.s3.test/part-00001.parquet?X-Amz-Signature=b",
    },
  ],
  expiresAt: "2024-01-01T00:20:00Z",
};

const mountExports = (exports: ExperimentExportRecord[]) =>
  server.mount(contract.experiments.listExports, {
    body: { exports },
  });

const defaultProps = {
  experimentId: "exp-123",
  tableName: "raw_data",
  onCreateExport: vi.fn(),
  onClose: vi.fn(),
};

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
      body: { message: "Server error" },
      status: 500,
    });

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText(/experimentData\.exportModal\.error/)).toBeInTheDocument();
    });
  });

  it("keeps the list it has when a later refetch fails", async () => {
    mountExports([completedExport]);
    const queryClient = createTestQueryClient();

    render(<ExportListStep {...defaultProps} />, { queryClient });
    expect(await screen.findByText("experimentData.exportModal.exportCount")).toBeInTheDocument();

    server.mount(contract.experiments.listExports, {
      body: { message: "Server error" },
      status: 500,
    });
    await act(() => queryClient.refetchQueries());

    expect(screen.getByText("experimentData.exportModal.exportCount")).toBeInTheDocument();
    expect(screen.queryByText(/experimentData\.exportModal\.error/)).not.toBeInTheDocument();
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
    expect(screen.getByText("experimentData.exportModal.formats.csv")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.rowCount")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.expiresOn")).toBeInTheDocument();
  });

  it("keeps Create Export outside the scrolling list so it stays in view", async () => {
    mountExports([completedExport]);

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.exportCount")).toBeInTheDocument();
    });
    const body = screen.getByTestId("dialog-body");
    expect(within(body).getByText("experimentData.exportModal.formats.csv")).toBeInTheDocument();
    expect(body).not.toContainElement(
      screen.getByRole("button", { name: "experimentData.exportModal.createExport" }),
    );
  });

  it("renders running export without download button", async () => {
    mountExports([runningExport]);

    render(<ExportListStep {...defaultProps} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.status.running")).toBeInTheDocument();
    });
    expect(screen.getByText("experimentData.exportModal.formats.ndjson")).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "experimentData.exportModal.downloadExport" }),
    ).not.toBeInTheDocument();
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
    await user.click(
      await screen.findByRole("menuitem", { name: "experimentData.exportModal.formats.csv" }),
    );

    expect(onCreateExport).toHaveBeenCalledWith("csv");
  });

  it("calls onCreateExport with xlsx via the Excel dropdown option", async () => {
    mountExports([]);
    const onCreateExport = vi.fn();

    render(<ExportListStep {...defaultProps} onCreateExport={onCreateExport} />);

    await waitFor(() => {
      expect(screen.getByText("experimentData.exportModal.noExports")).toBeInTheDocument();
    });

    const user = userEvent.setup();
    await user.click(
      screen.getByRole("button", { name: /experimentData\.exportModal\.createExport/i }),
    );

    await user.click(
      await screen.findByRole("menuitem", { name: "experimentData.exportModal.formats.xlsx" }),
    );

    expect(onCreateExport).toHaveBeenCalledWith("xlsx");
  });

  it("fetches a fresh signed link when a single-file export is downloaded", async () => {
    mountExports([completedExport]);
    const links = server.mount(contract.experiments.getExportDownloadLinks, {
      body: { parts: [twoPartLinks.parts[0]], expiresAt: twoPartLinks.expiresAt },
    });

    render(<ExportListStep {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "experimentData.exportModal.downloadExport" }),
    );

    await waitFor(() => {
      expect(links.called).toBe(true);
    });
    expect(links.params).toEqual({ id: "exp-123", exportId: "export-1" });
    expect(links.callCount).toBe(1);
  });

  it("lists each file of a multi-part export with its own signed link", async () => {
    mountExports([multiPartExport]);
    server.mount(contract.experiments.getExportDownloadLinks, { body: twoPartLinks });

    render(<ExportListStep {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: /experimentData\.exportModal\.showFiles/ }),
    );

    const fileLinks = await screen.findAllByRole("link", {
      name: "experimentData.exportModal.downloadPart",
    });
    expect(fileLinks.map((link) => link.getAttribute("href"))).toEqual(
      twoPartLinks.parts.map((part) => part.url),
    );
    expect(screen.getByText(twoPartLinks.parts[1].fileName)).toBeInTheDocument();
  });

  it("copies every file link of a multi-part export, one per line", async () => {
    mountExports([multiPartExport]);
    server.mount(contract.experiments.getExportDownloadLinks, { body: twoPartLinks });

    render(<ExportListStep {...defaultProps} />);

    const user = userEvent.setup();
    // `userEvent.setup()` installs its own clipboard stub, so this has to land after it.
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText },
      writable: true,
      configurable: true,
    });
    await user.click(
      await screen.findByRole("button", { name: /experimentData\.exportModal\.showFiles/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: /experimentData\.exportModal\.copyLinks/ }),
    );

    expect(writeText).toHaveBeenCalledWith(twoPartLinks.parts.map((part) => part.url).join("\n"));
  });

  it("says the export has expired when its links are refused as expired", async () => {
    mountExports([completedExport]);
    server.mount(contract.experiments.getExportDownloadLinks, {
      status: 404,
      body: {
        defined: false,
        code: "NOT_FOUND",
        status: 404,
        message: "This export has expired",
        data: { code: "EXPORT_EXPIRED" },
      },
    });

    render(<ExportListStep {...defaultProps} />);

    const user = userEvent.setup();
    await user.click(
      await screen.findByRole("button", { name: "experimentData.exportModal.downloadExport" }),
    );

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "experimentData.exportModal.linkExpired",
        variant: "destructive",
      });
    });
  });

  it("says so when the links cannot be copied", async () => {
    mountExports([multiPartExport]);
    server.mount(contract.experiments.getExportDownloadLinks, { body: twoPartLinks });

    render(<ExportListStep {...defaultProps} />);

    const user = userEvent.setup();
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: vi.fn().mockRejectedValue(new Error("Write permission denied")) },
      writable: true,
      configurable: true,
    });
    await user.click(
      await screen.findByRole("button", { name: /experimentData\.exportModal\.showFiles/ }),
    );
    await user.click(
      await screen.findByRole("button", { name: /experimentData\.exportModal\.copyLinks/ }),
    );

    await waitFor(() => {
      expect(toast).toHaveBeenCalledWith({
        description: "experimentData.exportModal.copyFailed",
        variant: "destructive",
      });
    });
  });

  it("hides the files of a multi-part export again", async () => {
    mountExports([multiPartExport]);
    server.mount(contract.experiments.getExportDownloadLinks, { body: twoPartLinks });

    render(<ExportListStep {...defaultProps} />);

    const user = userEvent.setup();
    const toggle = await screen.findByRole("button", {
      name: /experimentData\.exportModal\.showFiles/,
    });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    await user.click(toggle);
    await screen.findAllByRole("link", { name: "experimentData.exportModal.downloadPart" });

    await user.click(
      screen.getByRole("button", { name: /experimentData\.exportModal\.hideFiles/ }),
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });

  it("says why an export failed", async () => {
    mountExports([
      createExportRecord({
        status: "failed",
        errorCode: "too_many_rows_for_format",
        format: "xlsx",
      }),
    ]);

    render(<ExportListStep {...defaultProps} />);

    expect(
      await screen.findByText("experimentData.exportModal.errors.too_many_rows_for_format"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "experimentData.exportModal.downloadExport" }),
    ).not.toBeInTheDocument();
  });

  it("shows an expired export without a download", async () => {
    mountExports([createExportRecord({ status: "expired" })]);

    render(<ExportListStep {...defaultProps} />);

    expect(
      await screen.findByText("experimentData.exportModal.status.expired"),
    ).toBeInTheDocument();
    expect(
      screen.queryByRole("button", { name: "experimentData.exportModal.downloadExport" }),
    ).not.toBeInTheDocument();
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
