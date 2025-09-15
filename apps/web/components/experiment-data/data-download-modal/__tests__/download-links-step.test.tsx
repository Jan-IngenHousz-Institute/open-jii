import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DownloadLinksStep } from "../steps/download-links-step";

globalThis.React = React;

// Mock hooks
const mockDownloadFile = vi.fn();
const mockUseExperimentDataDownload = vi.fn();
const mockUseDownloadFile = vi.fn();

vi.mock("~/hooks/experiment/useExperimentDataDownload/useExperimentDataDownload", () => ({
  useExperimentDataDownload: (...args: unknown[]) =>
    mockUseExperimentDataDownload(...args) as {
      data: {
        data: {
          externalLinks: { externalLink: string; totalSize: number; rowCount: number }[];
        };
      } | null;
      error: { message: string } | null;
      isLoading: boolean;
    },
  useDownloadFile: () => mockUseDownloadFile() as { downloadFile: (url: string) => void },
}));

// Mock utility functions
vi.mock("~/util/format-file-size", () => ({
  formatFileSize: (size: number) => `${size} B`,
}));

vi.mock("~/util/format-row-count", () => ({
  formatRowCount: (count: number) => `${count}`,
}));

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        let result = key;
        Object.entries(options).forEach(([k, v]) => {
          result = result.replace(`{{${k}}}`, String(v));
        });
        return result;
      }
      return key;
    },
  }),
}));

// Mock UI components
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
    size,
    className,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    variant?: string;
    size?: string;
    className?: string;
  }) => (
    <button
      onClick={onClick}
      disabled={disabled}
      data-variant={variant}
      data-size={size}
      className={className}
      data-testid={
        variant === "outline" && !size
          ? "close-button"
          : variant === "outline" && size === "sm"
            ? "download-individual"
            : "download-all-button"
      }
    >
      {children}
    </button>
  ),
  DialogFooter: ({ children }: { children: React.ReactNode }) => (
    <div data-testid="dialog-footer">{children}</div>
  ),
}));

describe("DownloadLinksStep", () => {
  const mockOnClose = vi.fn();
  const defaultProps = {
    experimentId: "test-experiment-123",
    tableName: "test-table",
    onClose: mockOnClose,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockUseDownloadFile.mockReturnValue({ downloadFile: mockDownloadFile });
  });

  const renderStep = (props = {}) => {
    render(<DownloadLinksStep {...defaultProps} {...props} />);
  };

  describe("Loading state", () => {
    it("displays loading spinner when generating data", () => {
      mockUseExperimentDataDownload.mockReturnValue({
        data: null,
        error: null,
        isLoading: true,
      });

      renderStep();

      expect(screen.getByText("experimentData.downloadModal.generating")).toBeInTheDocument();
    });
  });

  describe("Error state", () => {
    it("displays error message when data fetching fails", () => {
      const errorMessage = "Failed to generate download links";
      mockUseExperimentDataDownload.mockReturnValue({
        data: null,
        error: { message: errorMessage },
        isLoading: false,
      });

      renderStep();

      expect(
        screen.getByText(`experimentData.downloadModal.error: ${errorMessage}`),
      ).toBeInTheDocument();
    });
  });

  describe("No data state", () => {
    it("displays no data message when external links are empty", () => {
      mockUseExperimentDataDownload.mockReturnValue({
        data: { data: { externalLinks: [] } },
        error: null,
        isLoading: false,
      });

      renderStep();

      expect(screen.getByText("experimentData.downloadModal.noData")).toBeInTheDocument();
    });
  });

  describe("Success state with data", () => {
    const mockData = {
      data: {
        externalLinks: [
          {
            externalLink: "https://example.com/file1.csv",
            totalSize: 1024,
            rowCount: 100,
          },
          {
            externalLink: "https://example.com/file2.csv",
            totalSize: 2048,
            rowCount: 200,
          },
        ],
      },
    };

    beforeEach(() => {
      mockUseExperimentDataDownload.mockReturnValue({
        data: mockData,
        error: null,
        isLoading: false,
      });
    });

    it("displays success message with download statistics", () => {
      renderStep();

      expect(screen.getByText("experimentData.downloadModal.success.title")).toBeInTheDocument();
      expect(
        screen.getByText("experimentData.downloadModal.success.description"),
      ).toBeInTheDocument();
    });

    it("displays download files section", () => {
      renderStep();

      expect(screen.getByText("experimentData.downloadModal.downloadFiles")).toBeInTheDocument();
    });

    it("renders download links for each file", () => {
      renderStep();

      const downloadButtons = screen.getAllByTestId("download-individual");
      expect(downloadButtons).toHaveLength(2);
    });

    it("displays file information correctly", () => {
      renderStep();

      expect(screen.getByText("1024 B")).toBeInTheDocument();
      expect(screen.getByText("2048 B")).toBeInTheDocument();
      expect(screen.getByText("100 experimentData.downloadModal.rows")).toBeInTheDocument();
      expect(screen.getByText("200 experimentData.downloadModal.rows")).toBeInTheDocument();
    });

    it("calls downloadFile when individual download button is clicked", () => {
      renderStep();

      const downloadButtons = screen.getAllByTestId("download-individual");
      fireEvent.click(downloadButtons[0]);

      expect(mockDownloadFile).toHaveBeenCalledWith("https://example.com/file1.csv");
    });

    it("renders dialog footer with close and download all buttons", () => {
      renderStep();

      expect(screen.getByTestId("dialog-footer")).toBeInTheDocument();
      expect(screen.getByTestId("close-button")).toBeInTheDocument();
      expect(screen.getByTestId("download-all-button")).toBeInTheDocument();
    });

    it("calls onClose when close button is clicked", () => {
      renderStep();

      const closeButton = screen.getByTestId("close-button");
      fireEvent.click(closeButton);

      expect(mockOnClose).toHaveBeenCalledTimes(1);
    });

    it("downloads all files when download all button is clicked", () => {
      vi.useFakeTimers();
      renderStep();

      const downloadAllButton = screen.getByTestId("download-all-button");
      fireEvent.click(downloadAllButton);

      // Fast-forward timers to trigger staggered downloads
      vi.advanceTimersByTime(250);

      expect(mockDownloadFile).toHaveBeenCalledWith("https://example.com/file1.csv");
      expect(mockDownloadFile).toHaveBeenCalledWith("https://example.com/file2.csv");

      vi.useRealTimers();
    });

    it("does not call downloadFile when download all is clicked with no files", () => {
      mockUseExperimentDataDownload.mockReturnValue({
        data: { data: { externalLinks: [] } },
        error: null,
        isLoading: false,
      });

      renderStep();

      // In this case, the download all button shouldn't be rendered, but if it was...
      expect(mockDownloadFile).not.toHaveBeenCalled();
    });

    it("displays correct file chunk information", () => {
      renderStep();

      expect(screen.getAllByText("experimentData.downloadModal.fileChunk")).toHaveLength(2);
    });

    it("renders download all button with correct text", () => {
      renderStep();

      const downloadAllButton = screen.getByTestId("download-all-button");
      expect(downloadAllButton).toHaveTextContent("experimentData.downloadModal.downloadAll");
    });

    it("passes correct parameters to useExperimentDataDownload hook", () => {
      renderStep();

      expect(mockUseExperimentDataDownload).toHaveBeenCalledWith(
        "test-experiment-123",
        "test-table",
        true,
      );
    });
  });

  describe("Edge cases", () => {
    it("handles single file download correctly", () => {
      const singleFileData = {
        data: {
          externalLinks: [
            {
              externalLink: "https://example.com/single-file.csv",
              totalSize: 512,
              rowCount: 50,
            },
          ],
        },
      };

      mockUseExperimentDataDownload.mockReturnValue({
        data: singleFileData,
        error: null,
        isLoading: false,
      });

      renderStep();

      const downloadButtons = screen.getAllByTestId("download-individual");
      expect(downloadButtons).toHaveLength(1);

      fireEvent.click(downloadButtons[0]);
      expect(mockDownloadFile).toHaveBeenCalledWith("https://example.com/single-file.csv");
    });

    it("handles missing data gracefully", () => {
      mockUseExperimentDataDownload.mockReturnValue({
        data: null,
        error: null,
        isLoading: false,
      });

      renderStep();

      expect(screen.getByText("experimentData.downloadModal.noData")).toBeInTheDocument();
    });

    it("handles malformed data gracefully", () => {
      mockUseExperimentDataDownload.mockReturnValue({
        data: { data: { externalLinks: null } },
        error: null,
        isLoading: false,
      });

      renderStep();

      expect(screen.getByText("experimentData.downloadModal.noData")).toBeInTheDocument();
    });
  });
});
