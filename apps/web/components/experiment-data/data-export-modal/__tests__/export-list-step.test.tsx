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
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    size?: string;
    variant?: string;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      data-size={size}
      data-variant={variant}
      className={className}
      data-testid={
        variant === "outline" && size === "sm"
          ? "download-button"
          : variant === "outline"
            ? "close-button"
            : "action-button"
      }
    >
      {children}
    </button>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
  ScrollArea: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="scroll-area">{children}</div>
  ),
}));

describe("ExportListStep", () => {
  const mockOnCreateNew = vi.fn();
  const mockOnClose = vi.fn();
  const mockExperimentId = "exp-123";
  const mockTableName = "raw_data";

  const defaultProps = {
    experimentId: mockExperimentId,
    tableName: mockTableName,
    onCreateNew: mockOnCreateNew,
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up any remaining DOM elements from previous tests
    document.body.innerHTML = "";
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const renderStep = (props = {}) => {
    render(<ExportListStep {...defaultProps} {...props} />);
  };

  it("renders loading state", () => {
    mockUseListExports.mockReturnValue({
      data: undefined,
      isLoading: true,
      error: null,
    });

    const { container } = render(<ExportListStep {...defaultProps} />);

    expect(container.querySelector(".animate-spin")).toBeInTheDocument();
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
    expect(screen.getByText("experimentData.exportModal.createNew")).toBeInTheDocument();
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
    expect(screen.getByText("csv")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("1024 bytes")).toBeInTheDocument();
  });

  it("renders active export without download button", () => {
    const mockExports: ExportRecord[] = [
      {
        exportId: null,
        experimentId: mockExperimentId,
        tableName: mockTableName,
        format: "json",
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

    expect(screen.getByText("json")).toBeInTheDocument();
    expect(screen.getByText("experimentData.exportModal.status.running")).toBeInTheDocument();
    // Download button (variant=outline, size=sm) should not be present for running exports
    expect(screen.queryByTestId("download-button")).not.toBeInTheDocument();
  });

  it("calls onCreateNew when create button is clicked", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const createButton = screen.getByText("experimentData.exportModal.createNew");
    fireEvent.click(createButton);

    expect(mockOnCreateNew).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when close button is clicked", () => {
    mockUseListExports.mockReturnValue({
      data: { body: { exports: [] } },
      isLoading: false,
      error: null,
    });

    renderStep();

    const closeButton = screen.getByText("common.close");
    fireEvent.click(closeButton);

    expect(mockOnClose).toHaveBeenCalledTimes(1);
  });

  it("triggers download when download button is clicked", () => {
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

    // Mock DOM methods after render so React can mount
    const mockClick = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    vi.spyOn(document, "createElement").mockImplementation((tagName: string) => {
      const element = originalCreateElement(tagName);
      if (tagName === "a") {
        element.click = mockClick;
      }
      return element;
    });
    const mockAppendChild = vi
      .spyOn(document.body, "appendChild")
      .mockImplementation(() => null as unknown as Node);
    const mockRemoveChild = vi
      .spyOn(document.body, "removeChild")
      .mockImplementation(() => null as unknown as Node);

    const downloadButton = screen.getByTestId("download-button");
    fireEvent.click(downloadButton);

    expect(mockAppendChild).toHaveBeenCalled();
    expect(mockClick).toHaveBeenCalled();
    expect(mockRemoveChild).toHaveBeenCalled();

    mockAppendChild.mockRestore();
    mockRemoveChild.mockRestore();
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
        format: "json",
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
    expect(screen.getByText("csv")).toBeInTheDocument();
    expect(screen.getByText("json")).toBeInTheDocument();
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
    expect(screen.getByText("parquet")).toBeInTheDocument();
  });
});
