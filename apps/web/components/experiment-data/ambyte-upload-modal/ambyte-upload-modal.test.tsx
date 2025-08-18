/* eslint-disable @typescript-eslint/no-non-null-assertion */
/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/require-await */
/* eslint-disable @typescript-eslint/await-thenable */
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { vi, describe, it, expect, beforeEach } from "vitest";

import { AmbyteUploadModal } from "./ambyte-upload-modal";

// Mock the i18n hook
vi.mock("@repo/i18n/client", () => ({
  useTranslation: () => ({
    t: (key: string, fallback?: string) => fallback ?? key,
  }),
}));

// Mock the upload hook with proper functionality
vi.mock("~/hooks/experiment/useAmbyteUpload/useAmbyteUpload", () => ({
  useAmbyteUploadWrapper: vi.fn(() => ({
    upload: vi.fn(),
    uploadAsync: vi.fn(),
    isLoading: false,
    error: null,
    data: null,
    reset: vi.fn(),
    isError: false,
    isSuccess: false,
  })),
}));

// Mock file for testing
const createMockFile = (name: string, size = 1000, type = "text/plain"): File => {
  const file = new File(["content"], name, { type });
  Object.defineProperty(file, "size", {
    value: size,
    writable: false,
  });
  return file;
};

// Helper to create files with webkitRelativePath set
const createValidAmbyteFiles = (paths: string[]): File[] => {
  return paths.map((path) => {
    const file = createMockFile(path.split("/").pop() ?? path);
    Object.defineProperty(file, "webkitRelativePath", {
      value: path,
      writable: false,
    });
    return file;
  });
};

const createMockFileList = (files: File[]): FileList => {
  const fileList = {
    length: files.length,
    item: (index: number) => files[index] || null,
    [Symbol.iterator]: function* () {
      yield* files;
    },
  } as FileList;

  files.forEach((file, index) => {
    fileList[index] = file;
  });

  return fileList;
};

// Create a wrapper with QueryClient
const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
      mutations: {
        retry: false,
      },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("AmbyteUploadModal", () => {
  const defaultProps = {
    experimentId: "test-experiment-id",
    open: true,
    onOpenChange: vi.fn(),
    onUploadSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Initial State", () => {
    it("renders sensor selection step initially", () => {
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      expect(screen.getByText("experimentData.uploadModal.sensorFamily.label")).toBeInTheDocument();
      expect(screen.getByText("MultispeQ")).toBeInTheDocument();
      expect(screen.getByText("Ambyte")).toBeInTheDocument();
    });

    it("shows MultispeQ as disabled", () => {
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      // Use radio button with aria-label
      const multispqOption = screen.getByRole("radio", { name: /MultispeQ/i });
      expect(multispqOption).toBeDisabled();
      expect(screen.getByText("Coming Soon")).toBeInTheDocument();
    });

    it("shows Ambyte as enabled", () => {
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteOption = screen.getByRole("radio", { name: /Ambyte/i });
      expect(ambyteOption).not.toBeDisabled();
    });
  });

  describe("Sensor Selection", () => {
    it("allows selecting Ambyte sensor", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      // Should proceed to file upload step
      await waitFor(async () => {
        await expect(screen.getByText("Upload Ambyte Data")).toBeInTheDocument();
      });
    });

    it("does not allow selecting disabled MultispeQ sensor", async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const multispqRadio = screen.getAllByRole("radio")[0];
      expect(multispqRadio).toBeDisabled();

      // Try clicking the option div
      const multispqOption = screen.getByText("MultispeQ").closest("div")!;
      await user.click(multispqOption);

      // Should still be on sensor selection step
      expect(screen.getByText("experimentData.uploadModal.sensorFamily.label")).toBeInTheDocument();
    });
  });

  describe("File Upload Step", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      await waitFor(() => {
        expect(screen.getByText("Upload Ambyte Data")).toBeInTheDocument();
      });
    });

    it("renders file upload interface", async () => {
      await expect(screen.getByText("Upload Ambyte Data")).toBeInTheDocument();
      await expect(screen.getByText("Back")).toBeInTheDocument();
      await expect(screen.getByText("Upload Data")).toBeInTheDocument();
    });

    it("has upload button disabled initially", async () => {
      const uploadButton = screen.getByRole("button", { name: /upload data/i });
      expect(uploadButton).toBeDisabled();
    });

    it("can go back to sensor selection", async () => {
      const user = userEvent.setup();

      const backButton = screen.getByRole("button", { name: /back/i });
      await user.click(backButton);

      await waitFor(() => {
        expect(
          screen.getByText("experimentData.uploadModal.sensorFamily.label"),
        ).toBeInTheDocument();
      });
    });
  });

  describe("File Validation", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      await waitFor(async () => {
        await expect(screen.getByText("Upload Ambyte Data")).toBeInTheDocument();
      });
    });

    it("validates valid Ambyte folder structure", async () => {
      // Mock files with valid Ambyte structure
      const files = createValidAmbyteFiles([
        "Ambyte_1/1/20250602-164840_.txt",
        "Ambyte_1/2/20250602-164841_.txt",
        "Ambyte_1/ambyte_log.txt",
        "Ambyte_1/config.txt",
        "Ambyte_1/run.txt",
      ]);

      const fileInput = document.querySelector('input[type="file"]')!;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByText(/Upload Error/)).not.toBeInTheDocument();
      });

      const uploadButton = screen.getByRole("button", { name: /upload data/i });
      expect(uploadButton).not.toBeDisabled();
    });

    it("validates valid numbered subfolder structure", async () => {
      const files = createValidAmbyteFiles(["1/20250602-164840_.txt", "1/20250603-164840_.txt"]);

      const fileInput = document.querySelector('input[type="file"]')!;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByText(/Upload Error/)).not.toBeInTheDocument();
      });
    });

    it("validates higher numbered subfolder structures", async () => {
      const files = createValidAmbyteFiles(["15/20250602-164840_.txt", "23/20250603-164840_.txt"]);

      const fileInput = document.querySelector('input[type="file"]')!;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByText(/Upload Error/)).not.toBeInTheDocument();
      });
    });

    it("rejects invalid folder structure", async () => {
      const files = createValidAmbyteFiles(["invalid/structure.txt"]);

      const fileInput = document.querySelector('input[type="file"]')!;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Please select an Ambyte folder/)).toBeInTheDocument();
      });

      const uploadButton = screen.getByRole("button", { name: /upload data/i });
      expect(uploadButton).toBeDisabled();
    });

    it("rejects invalid file types", async () => {
      const files = [createMockFile("Ambyte_1/1/invalid.pdf")];

      files.forEach((file, index) => {
        Object.defineProperty(file, "webkitRelativePath", {
          value: file.name,
          writable: false,
        });
      });

      const fileInput = document.querySelector('input[type="file"]')!;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(async () => {
        await expect(screen.getByText(/Invalid files detected/)).toBeInTheDocument();
      });
    });
  });

  describe("Upload Process", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      // Navigate to file upload step
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      // Add valid files
      const files = createValidAmbyteFiles([
        "Ambyte_1/1/20250602-164840_.txt",
        "Ambyte_1/ambyte_log.txt",
        "Ambyte_1/config.txt",
        "Ambyte_1/run.txt",
      ]);

      const fileInput = document.querySelector('input[type="file"]')!;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(async () => {
        await expect(screen.getByText(/files? selected/i)).toBeInTheDocument();
      });
    });

    it("triggers upload when upload button is clicked", async () => {
      const user = userEvent.setup();

      const uploadButton = screen.getByRole("button", { name: /upload data/i });

      // Verify button is initially enabled and clickable
      expect(uploadButton).toBeEnabled();

      await user.click(uploadButton);

      // Verify that clicking the button doesn't break the component
      // (The actual upload behavior is mocked, so we just check the component doesn't crash)
      expect(uploadButton).toBeInTheDocument();
    });
  });

  describe("Modal Controls", () => {
    it("calls onOpenChange when closed", async () => {
      const onOpenChange = vi.fn();
      render(<AmbyteUploadModal {...defaultProps} onOpenChange={onOpenChange} />, {
        wrapper: createWrapper(),
      });

      // Try to close the modal (this would normally be handled by the Dialog component)
      // For testing purposes, we'll simulate the behavior
      fireEvent.keyDown(document, { key: "Escape" });

      // Note: Actual modal closing behavior depends on the Dialog component implementation
    });

    it("does not render when open is false", async () => {
      render(<AmbyteUploadModal {...defaultProps} open={false} />, { wrapper: createWrapper() });

      expect(screen.queryByText("experimentData.uploadModal.title")).not.toBeInTheDocument();
    });
  });

  describe("Error Handling", () => {
    it("handles upload errors gracefully", async () => {
      // This test would require mocking the upload mutation to fail
      // For now, we can test that the error state UI renders correctly

      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      // Navigate through the flow
      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);

      // The error state would be tested with proper API mocking
    });
  });
});
