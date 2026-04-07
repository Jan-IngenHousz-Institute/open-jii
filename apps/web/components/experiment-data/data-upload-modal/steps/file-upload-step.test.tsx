import { API_URL } from "@/test/msw/mount";
import { server } from "@/test/msw/server";
import { render, screen, userEvent, waitFor } from "@/test/test-utils";
import { http, HttpResponse } from "msw";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contract } from "@repo/api";

import { validateAmbyteStructure, isExcludedFile } from "../data-upload-validation";
import { FileUploadStep } from "./file-upload-step";

vi.mock("../data-upload-validation", () => ({
  validateAmbyteStructure: vi.fn().mockReturnValue({ isValid: true, errors: [] }),
  isExcludedFile: vi.fn().mockReturnValue(false),
}));

// FileUpload — pragmatic mock (browser file/directory API not available in jsdom)
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

const defaultProps = {
  experimentId: "exp-123",
  onBack: vi.fn(),
  onUploadSuccess: vi.fn(),
};

/**
 * Mount the uploadExperimentData handler.
 *
 * Uses server.use() directly instead of server.mount() because the upload
 * contract uses multipart/form-data. The mount helper's request.json() call
 * hangs on FormData bodies in jsdom.
 */
function mountUploadHandler(overrides?: { status?: number; body?: unknown }) {
  const spy = { called: false };
  const url = `${API_URL}${contract.experiments.uploadExperimentData.path}`;
  server.use(
    http.post(url, () => {
      spy.called = true;
      const status = overrides?.status ?? 201;
      const responseBody = overrides?.body ?? {
        files: [{ fileName: "data.txt", filePath: "Ambyte_1/data.txt" }],
      };
      return HttpResponse.json(responseBody, { status });
    }),
  );
  return spy;
}

describe("FileUploadStep", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // clearAllMocks only clears call history, not implementations.
    // Re-establish defaults so mocks set by earlier tests don't leak.
    vi.mocked(validateAmbyteStructure).mockReturnValue({ isValid: true, errors: [] });
    vi.mocked(isExcludedFile).mockReturnValue(false);
  });

  it("renders title, description, and buttons", () => {
    render(<FileUploadStep {...defaultProps} />);

    expect(screen.getByText("uploadModal.fileUpload.title")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.description")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.back")).toBeInTheDocument();
    expect(screen.getByText("uploadModal.fileUpload.uploadFiles")).toBeInTheDocument();
  });

  it("calls onBack when back button is clicked", async () => {
    const onBack = vi.fn();

    render(<FileUploadStep {...defaultProps} onBack={onBack} />);

    await userEvent.click(screen.getByRole("button", { name: /back/i }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it("does not upload when no files are selected", async () => {
    const spy = mountUploadHandler();

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));
    expect(spy.called).toBe(false);
  });

  it("shows validation errors when file structure is invalid", async () => {
    vi.mocked(validateAmbyteStructure).mockReturnValue({
      isValid: false,
      errors: [{ key: "uploadModal.validation.invalidStructure" }],
    });

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "select files" }));

    await waitFor(() => {
      expect(screen.getByRole("list", { name: "validation errors" })).toBeInTheDocument();
    });
  });

  it("uploads files and calls onUploadSuccess", async () => {
    const onUploadSuccess = vi.fn();
    const spy = mountUploadHandler();

    render(<FileUploadStep {...defaultProps} onUploadSuccess={onUploadSuccess} />);

    await userEvent.click(screen.getByRole("button", { name: "select files" }));
    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));

    await waitFor(() => {
      expect(spy.called).toBe(true);
    });

    await waitFor(() => {
      expect(onUploadSuccess).toHaveBeenCalled();
    });
  });

  it("does not upload when validation errors exist", async () => {
    const spy = mountUploadHandler();
    vi.mocked(validateAmbyteStructure).mockReturnValue({
      isValid: false,
      errors: [{ key: "uploadModal.validation.invalidStructure" }],
    });

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "select files" }));
    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));

    expect(spy.called).toBe(false);
  });

  it("shows upload error on failure", async () => {
    mountUploadHandler({ status: 400, body: { message: "Upload failed" } });

    render(<FileUploadStep {...defaultProps} />);

    await userEvent.click(screen.getByRole("button", { name: "select files" }));
    await userEvent.click(screen.getByText("uploadModal.fileUpload.uploadFiles"));

    await waitFor(() => {
      expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });
  });
});
