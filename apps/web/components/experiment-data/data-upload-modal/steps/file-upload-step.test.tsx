import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import { FileUploadStep } from "./file-upload-step";

/* --------------------------------- Mocks --------------------------------- */

// Sibling validation utilities (Rule 5 — tested in their own file)
vi.mock("../data-upload-validation", () => ({
  validateAmbyteStructure: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
  isExcludedFile: vi.fn().mockReturnValue(false),
}));

// FileUpload — pragmatic mock (browser file/directory API)
vi.mock("@repo/ui/components", async (importOriginal) => {
  const actual: Record<string, unknown> = await importOriginal();
  return {
    ...actual,
    FileUpload: ({
      onFilesChange,
      validationErrors,
      isUploading,
      uploadError,
    }: {
      onFilesChange: (files: FileList | null) => void;
      validationErrors?: string[];
      isUploading?: boolean;
      uploadError?: { title: string; message: string };
    }) => (
      <div>
        <button
          aria-label="select files"
          onClick={() => {
            const file = new File(["content"], "data.txt", { type: "text/plain" });
            Object.defineProperty(file, "webkitRelativePath", { value: "Ambyte_1/data.txt" });
            const fileList = Object.assign([file], {
              item: (i: number) => [file][i] ?? null,
            }) as unknown as FileList;
            onFilesChange(fileList);
          }}
          disabled={isUploading}
        >
          Select Files
        </button>
        {validationErrors && validationErrors.length > 0 && (
          <ul aria-label="validation errors">
            {validationErrors.map((e, i) => (
              <li key={i}>{e}</li>
            ))}
          </ul>
        )}
        {uploadError && <p>{uploadError.message}</p>}
      </div>
    ),
  };
});

/* -------------------------------- Helpers -------------------------------- */

const defaultProps = {
  experimentId: "exp-123",
  onBack: vi.fn(),
  onUploadSuccess: vi.fn(),
};

/* --------------------------------- Tests --------------------------------- */

describe("FileUploadStep", () => {
  it("renders title, description, and buttons", () => {
    server.mount(contract.experiments.uploadExperimentData, {
      body: { files: [] },
      delay: 999_999,
    });

    render(<FileUploadStep {...defaultProps} />);

    expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.description")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.back")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.uploadFiles")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();
    server.mount(contract.experiments.uploadExperimentData, {
      body: { files: [] },
      delay: 999_999,
    });

    render(<FileUploadStep {...defaultProps} onBack={onBack} />);

    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("does not upload when no files are selected", async () => {
    const spy = server.mount(contract.experiments.uploadExperimentData, {
      body: { files: [] },
    });

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));
    expect(spy.callCount).toBe(0);
  });

  it("shows validation errors when file structure is invalid", async () => {
    const { validateAmbyteStructure } = await import("../data-upload-validation");
    vi.mocked(validateAmbyteStructure).mockReturnValue({
      isValid: false,
      errors: [{ key: "uploadModal.validation.invalidStructure" }],
    });

    server.mount(contract.experiments.uploadExperimentData, {
      body: { files: [] },
      delay: 999_999,
    });

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "select files" }));

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "validation errors" })).toBeInTheDocument();
    });
  });

  it("uploads files and calls onUploadSuccess", async () => {
    const onUploadSuccess = vi.fn();
    const spy = server.mount(contract.experiments.uploadExperimentData, {
      body: { files: [{ fileName: "data.txt", filePath: "/uploads/data.txt" }] },
    });

    render(<FileUploadStep {...defaultProps} onUploadSuccess={onUploadSuccess} />);

    // Select files
    await userEvent.click(screen.getByRole("button", { name: "select files" }));
    // Upload
    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));

    await waitFor(() => {
      expect(spy.callCount).toBe(1);
    });

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalled();
    });
  });

  it("does not upload when validation errors exist", async () => {
    const { validateAmbyteStructure } = await import("../data-upload-validation");
    vi.mocked(validateAmbyteStructure).mockReturnValue({
      isValid: false,
      errors: [{ key: "uploadModal.validation.invalidStructure" }],
    });

    const spy = server.mount(contract.experiments.uploadExperimentData, {
      body: { files: [] },
    });

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "select files" }));
    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));

    expect(spy.callCount).toBe(0);
  });

  it("shows upload error on failure", async () => {
    server.mount(contract.experiments.uploadExperimentData, {
      body: { message: "Upload failed" },
      status: 400,
    });

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "select files" }));
    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));

    await waitFor(() => {
      expect(
        screen.getByText(/Upload failed|uploadModal\.validation\.uploadFailed/),
      ).toBeInTheDocument();
    });
  });
});
