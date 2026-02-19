import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { ExportRecord } from "@repo/api";

import { ExportListStep } from "../steps/export-list-step";

globalThis.React = React;

// Mock hooks
const mockUseListExports = vi.fn<
  (params: { experimentId: string; tableName: string }) => {
    data: unknown;
    isLoading: boolean;
    error: unknown;
  }
>();

vi.mock("~/hooks/experiment/useListExports/useListExports", () => ({
  useListExports: (params: { experimentId: string; tableName: string }) =>
    mockUseListExports(params),
}));

const mockDownloadExport = vi.fn();
const mockUseDownloadExport = vi.fn<
  () => {
    downloadExport: typeof mockDownloadExport;
    isDownloading: boolean;
    downloadingExportId: string | null;
  }
>();
vi.mock("~/hooks/experiment/useDownloadExport/useDownloadExport", () => ({
  useDownloadExport: () => mockUseDownloadExport(),
}));

// Mock utility functions
vi.mock("~/util/format-file-size", () => ({
  formatFileSize: (size: number) => `${size} bytes`,
}));

vi.mock("~/util/apiError", () => ({
  parseApiError: (error: { body?: { message?: string } }) => error.body,
}));

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    size,
    variant,
    className,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    size?: string;
    variant?: string;
    className?: string;
    disabled?: boolean;
  }) => (
    <button
      onClick={onClick}
      data-size={size}
      data-variant={variant}
      className={className}
      disabled={disabled}
      data-testid={
        variant === "ghost" && size === "icon"
          ? "download-button"
          : variant === "outline"
            ? "close-button"
            : "create-export-button"
      }
    >
      {children}
    </button>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode; className?: string }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
  DropdownMenu: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dropdown-menu">{children}</div>
  ),
  DropdownMenuTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) => (
    <div data-testid="dropdown-trigger">{children}</div>
  ),
  DropdownMenuContent: ({ children }: { children: React.ReactNode; align?: string }) => (
    <div data-testid="dropdown-content">{children}</div>
  ),
  DropdownMenuItem: ({
    children,
    onClick,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
  }) => (
    <button data-testid="dropdown-item" onClick={onClick}>
      {children}
    </button>
  ),
  Skeleton: ({ className }: { className?: string }) => (
    <div data-testid="skeleton" className={`animate-pulse ${className ?? ""}`} />
  ),
  Tooltip: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipContent: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="tooltip-content">{children}</div>
  ),
  TooltipProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  TooltipTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

describe("ExportListStep", () => {
  const mockOnCreateExport = vi.fn();
  const mockOnClose = vi.fn();
  const mockExperimentId = "exp-123";
  const mockTableName = "raw_data";

  const defaultProps = {
    experimentId: mockExperimentId,
    tableName: mockTableName,
    onCreateExport: mockOnCreateExport,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any remaining DOM elements from previous tests
    document.body.innerHTML = "";
    mockUseDownloadExport.mockReturnValue({
      downloadExport: mockDownloadExport,
      isDownloading: false,
      downloadingExportId: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderStep = (props = {}) => {
    render(<ExportListStep {...defaultProps} {...props} />);
  };

  it("renders loading state with skeleton cards and action buttons", () => {
    mockUseListExports.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<ExportListStep {...defaultProps} />);

    // Loading text and skeleton cards
    expect(screen.getByText("experimentData.exportModal.loadingExports")).toBeInTheDocument();
    expect(container.querySelector(".animate-pulse")).toBeInTheDocument();
    // Close and Create Export buttons should still be visible during loading
    expect(screen.getByText("common.close")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.createExport")).toBeInTheDocument();
  });

  it("renders error state with message", () => {
    const mockError = {
      body: { message: "Failed to load exports" },
    };

    mockUseListExports.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: mockError,
    });

    renderStep();

    expect(screen.getByText(/experimentData.exportModal.error/)).toBeInTheDocument();
    expect(screen.getByText(/Failed to load exports/)).toBeInTheDocument();
  });

  it("renders empty state when no exports exist", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    expect(screen.getByText("experimentData.exportModal.noExports")).toBeInTheDocument();
  });

  it("renders list of exports with completed export", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: "export-1",
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "csv",
        status: "completed",
        filePath: "/path/to/file.csv",
        rowCount: 100,
        fileSize: 1024,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:05:00Z",
      },
    ];

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    expect(screen.getByText("experimentData.exportModal.exportCount")).toBeInTheDocument();
    expect(screen.getAllByText("CSV").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/100/)).toBeInTheDocument();
    expect(screen.getByText("1024 bytes")).toBeInTheDocument();
  });

  it("renders active export without download button", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: null,
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "ndjson",
        status: "running",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: null,
      },
    ];

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    expect(screen.getAllByText("NDJSON").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("experimentData.exportModal.status.running")).toBeInTheDocument();
    expect(screen.queryByTestId("download-button")).not.toBeInTheDocument();
  });

  it("calls onCreateExport with format when dropdown item is clicked", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const dropdownItems = screen.getAllByTestId("dropdown-item");
    // Click "CSV" item (first)
    fireEvent.click(dropdownItems[0]);

    expect(mockOnCreateExport).toHaveBeenCalledWith("csv");
  });

  it("calls onCreateExport with ndjson when NDJSON dropdown item is clicked", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const dropdownItems = screen.getAllByTestId("dropdown-item");
    // Click "NDJSON" item (second)
    fireEvent.click(dropdownItems[1]);

    expect(mockOnCreateExport).toHaveBeenCalledWith("ndjson");
  });

  it("calls onCreateExport with json-array when JSON Array dropdown item is clicked", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const dropdownItems = screen.getAllByTestId("dropdown-item");
    // Click "JSON Array" item (third)
    fireEvent.click(dropdownItems[2]);

    expect(mockOnCreateExport).toHaveBeenCalledWith("json-array");
  });

  it("calls onClose when close button is clicked", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const closeButton = screen.getByTestId("close-button");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("renders dropdown menu and close button in footer", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
    expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
    expect(screen.getByTestId("close-button")).toBeInTheDocument();
  });

  it("renders four format options in dropdown", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const dropdownItems = screen.getAllByTestId("dropdown-item");
    expect(dropdownItems).toHaveLength(4);
    expect(dropdownItems[0]).toHaveTextContent("CSV");
    expect(dropdownItems[1]).toHaveTextContent("NDJSON");
    expect(dropdownItems[2]).toHaveTextContent("JSON Array");
    expect(dropdownItems[3]).toHaveTextContent("Parquet");
  });

  it("renders multiple exports", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: null,
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "csv",
        status: "running",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: null,
      },
      {
        exportId: "export-2",
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "ndjson",
        status: "completed",
        filePath: "/path/to/file.json",
        rowCount: 200,
        fileSize: 2048,
        createdBy: "user-2",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:10:00Z",
      },
    ];

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    expect(screen.getByText("experimentData.exportModal.exportCount")).toBeInTheDocument();
    expect(screen.getAllByText("CSV").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("NDJSON").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByTestId("scroll-area")).toBeInTheDocument();
  });

  it("displays status badges correctly", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: null,
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "csv",
        status: "pending",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: null,
      },
    ];

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    expect(screen.getByText("experimentData.exportModal.status.pending")).toBeInTheDocument();
  });

  it("handles failed export status", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: "export-1",
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "parquet",
        status: "failed",
        filePath: null,
        rowCount: null,
        fileSize: null,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:01:00Z",
      },
    ];

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    expect(screen.getByText("experimentData.exportModal.status.failed")).toBeInTheDocument();
    expect(screen.getAllByText("Parquet").length).toBeGreaterThanOrEqual(1);
  });

  it("calls downloadExport when download button is clicked", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: "export-1",
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "csv",
        status: "completed",
        filePath: "/path/to/file.csv",
        rowCount: 50,
        fileSize: 512,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:05:00Z",
      },
    ];

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const downloadButton = screen.getByTestId("download-button");
    fireEvent.click(downloadButton);

    expect(mockDownloadExport).toHaveBeenCalledWith("export-1");
  });

  it("renders export card without rowCount and fileSize metadata", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: "export-1",
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "csv",
        status: "completed",
        filePath: "/path/to/file.csv",
        rowCount: null,
        fileSize: null,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: null,
      },
    ];

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    // Should render without row count or file size metadata
    expect(screen.getByText("experimentData.exportModal.exportCount")).toBeInTheDocument();
    expect(screen.getAllByText("CSV").length).toBeGreaterThanOrEqual(1);
    // No rows or file size info should be present
    expect(screen.queryByText(/bytes/)).not.toBeInTheDocument();
  });

  it("shows loading spinner on download button when downloading", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: "export-1",
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "csv",
        status: "completed",
        filePath: "/path/to/file.csv",
        rowCount: 50,
        fileSize: 512,
        createdBy: "user-1",
        createdAt: "2024-01-01T00:00:00Z",
        completedAt: "2024-01-01T00:05:00Z",
      },
    ];

    mockUseDownloadExport.mockReturnValue({
      downloadExport: mockDownloadExport,
      isDownloading: true,
      downloadingExportId: "export-1",
    });

    mockUseListExports.mockReturnValue({
      data: { body: { exports: mockExports } },
      isLoading: false,
      error: null,
    });

    renderStep();

    // The download button should be present and disabled
    const downloadButton = screen.getByTestId("download-button");
    expect(downloadButton).toBeDisabled();
  });

  describe("create button phases", () => {
    beforeEach(() => {
      mockUseListExports.mockReturnValue({
        data: { body: { exports: [] } },
        isLoading: false,
        error: null,
      });
    });

    it("shows dropdown button in idle state (default)", () => {
      renderStep();

      expect(screen.getByTestId("dropdown-menu")).toBeInTheDocument();
      expect(screen.getByText("experimentData.exportModal.createExport")).toBeInTheDocument();
    });

    it("shows disabled spinner button in creating state", () => {
      renderStep({ creationStatus: "creating" });

      const button = screen.getByTestId("create-export-button");
      expect(button).toBeDisabled();
      expect(screen.getByText("experimentData.exportModal.creating")).toBeInTheDocument();
      expect(screen.queryByTestId("dropdown-menu")).not.toBeInTheDocument();
    });

    it("shows disabled check button in success state", () => {
      renderStep({ creationStatus: "success" });

      const button = screen.getByTestId("create-export-button");
      expect(button).toBeDisabled();
      expect(screen.getByText("experimentData.exportModal.exportCreated")).toBeInTheDocument();
      expect(screen.queryByTestId("dropdown-menu")).not.toBeInTheDocument();
    });
  });
});
