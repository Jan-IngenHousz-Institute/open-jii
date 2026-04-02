import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import { validateAmbyteStructure, isExcludedFile } from "../data-upload-validation";
import { FileUploadStep } from "./file-upload-step";

globalThis.React = React;

// Mock hooks
vi.mock("@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload", () => ({
  useExperimentDataUpload: vi.fn(),
}));

// Mock translation
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown>) => {
      if (options) {
        return `${key} ${JSON.stringify(options)}`;
      }
      return key;
    },
  }),
}));

// Mock utility
vi.mock("~/util/apiError", () => ({
  parseApiError: (error: { message: string }) => ({ message: error.message }),
}));

// Mock validation
vi.mock("../data-upload-validation", () => ({
  validateAmbyteStructure: vi.fn(),
  isExcludedFile: vi.fn(),
}));

// Mock components from @repo/ui
vi.mock("@repo/ui/components", () => ({
  Button: ({
    children,
    onClick,
    disabled,
    variant,
  }: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    variant?: string;
  }) => (
    <button onClick={onClick} disabled={disabled} data-variant={variant}>
      {children}
    </button>
  ),
  Label: ({ children, ...props }: { children: React.ReactNode; className?: string }) => (
    <label {...props}>{children}</label>
  ),
  FileUpload: ({
    onFilesChange,
    validationErrors,
    isUploading,
  }: {
    onFilesChange: (files: FileList | null) => void;
    validationErrors?: string[];
    isUploading?: boolean;
  }) => (
    <div>
      <button
        data-testid="file-upload-button"
        onClick={() => {
          const mockFile = new File(["content"], "test.txt", { type: "text/plain" });
          const mockFileList = {
            length: 1,
            item: () => mockFile,
            0: mockFile,
          } as unknown as FileList;
          onFilesChange(mockFileList);
        }}
        disabled={isUploading}
      >
        Select Files
      </button>
      {validationErrors && validationErrors.length > 0 && (
        <div data-testid="validation-errors">
          {validationErrors.map((error, index) => (
            <div key={index}>{error}</div>
          ))}
        </div>
      )}
      {isUploading && <div data-testid="uploading">Uploading...</div>}
    </div>
  ),
}));

const { useExperimentDataUpload } = await import(
  "@/hooks/experiment/useExperimentDataUpload/useExperimentDataUpload"
);
const { validateAmbyteStructure, isExcludedFile } = await import("../data-upload-validation");

describe("FileUploadStep", () => {
  const mockOnBack = vi.fn();
  const mockOnUploadSuccess = vi.fn();
  const mockUploadData = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    (useExperimentDataUpload as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: mockUploadData,
      isPending: false,
    });
    (validateAmbyteStructure as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: true,
      errors: [],
    });
    (isExcludedFile as ReturnType<typeof vi.fn>).mockReturnValue(false);
  });

  it("renders buttons", () => {
    render(<FileUploadStep {...defaultProps} />);

    expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.description")).toBeInTheDocument();
  });

  it("renders back and upload buttons", () => {
    render(
      <FileUploadStep
        experimentId="test-experiment"
        onBack={mockOnBack}
        onUploadSuccess={mockOnUploadSuccess}
      />,
    );

    expect(screen.getByText("uploadModal.fileUpload.back")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.uploadFiles")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", () => {
    render(
      <FileUploadStep
        experimentId="test-experiment"
        onBack={mockOnBack}
        onUploadSuccess={mockOnUploadSuccess}
      />,
    );

    const backButton = screen.getByText("uploadModal.fileUpload.back");
    fireEvent.click(backButton);
    expect(mockOnBack).toHaveBeenCalled();
  });

  it("handles file selection", async () => {
    render(
      <FileUploadStep
        experimentId="test-experiment"
        onBack={mockOnBack}
        onUploadSuccess={mockOnUploadSuccess}
      />,
    );

    const fileUploadButton = screen.getByTestId("file-upload-button");
    fireEvent.click(fileUploadButton);

    await waitFor(() => {
      expect(validateAmbyteStructure).toHaveBeenCalled();
    });
  });

  it("shows validation errors when files are invalid", async () => {
    (validateAmbyteStructure as ReturnType<typeof vi.fn>).mockReturnValue({
      isValid: false,
      errors: [{ key: "uploadModal.validation.invalidStructure", options: {} }],
    });

    render(
      <FileUploadStep
        experimentId="test-experiment"
        onBack={mockOnBack}
        onUploadSuccess={mockOnUploadSuccess}
      />,
    );

    const fileUploadButton = screen.getByTestId("file-upload-button");
    fireEvent.click(fileUploadButton);

    await waitFor(() => {
      expect(screen.getByTestId("validation-errors")).toBeInTheDocument();
    });
  });

  it("calls upload mutation when upload button is clicked with valid files", async () => {
    render(
      <FileUploadStep
        experimentId="test-experiment"
        onBack={mockOnBack}
        onUploadSuccess={mockOnUploadSuccess}
      />,
    );

    // First select files
    const fileUploadButton = screen.getByTestId("file-upload-button");
    fireEvent.click(fileUploadButton);

    await waitFor(() => {
      const uploadButton = screen.getByText("uploadModal.fileUpload.uploadFiles");
      fireEvent.click(uploadButton);
    });

    expect(mockUploadData).toHaveBeenCalled();
  });

  it("shows validation errors when file structure is invalid", async () => {
    vi.mocked(validateAmbyteStructure).mockReturnValue({
      isValid: false,
      errors: [{ key: "uploadModal.validation.invalidStructure" }],
    });

    render(
      <FileUploadStep
        experimentId="test-experiment"
        onBack={mockOnBack}
        onUploadSuccess={mockOnUploadSuccess}
      />,
    );

    // Select files with validation errors
    const fileUploadButton = screen.getByTestId("file-upload-button");
    fireEvent.click(fileUploadButton);

    const uploadButton = screen.getByText("uploadModal.fileUpload.uploadFiles");
    fireEvent.click(uploadButton);

    expect(mockUploadData).not.toHaveBeenCalled();
  });
});
