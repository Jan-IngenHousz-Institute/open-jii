import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, beforeEach, vi } from "vitest";

import { AmbyteUploadModal } from "./ambyte-upload-modal";

// Mock the upload hook
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

// Helper functions for creating test files
const createMockFile = (name: string, size = 1000, type = "text/plain"): File => {
  const file = new File(["test content"], name, { type });
  Object.defineProperty(file, "size", {
    value: size,
    writable: false,
  });
  return file;
};

const createAmbyteFiles = (paths: string[]): File[] => {
  return paths.map((path) => {
    const fileName = path.split("/").pop() ?? path;
    const file = createMockFile(fileName);
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

const createWrapper = () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
};

describe("AmbyteUploadModal - Comprehensive Tests", () => {
  const defaultProps = {
    experimentId: "test-experiment-id",
    open: true,
    onOpenChange: vi.fn(),
    onUploadSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("Folder Structure Validation", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);
    });

    it("accepts Ambyte_1 through Ambyte_999 folder patterns", async () => {
      const testCases = ["Ambyte_1", "Ambyte_10", "Ambyte_100", "Ambyte_999"];

      for (const folderName of testCases) {
        const files = createAmbyteFiles([
          `${folderName}/1/data.txt`,
          `${folderName}/config.txt`,
          `${folderName}/run.txt`,
          `${folderName}/ambyte_log.txt`,
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

        // Reset for next test
        fireEvent.change(fileInput, { target: { files: createMockFileList([]) } });
      }
    });

    it("accepts single numbered folders 1-4", async () => {
      const testCases = ["1", "2", "3", "4"];

      for (const folderName of testCases) {
        const files = createAmbyteFiles([`${folderName}/data1.txt`, `${folderName}/data2.txt`]);

        const fileInput = document.querySelector('input[type="file"]')!;
        Object.defineProperty(fileInput, "files", {
          value: createMockFileList(files),
          writable: false,
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
          expect(screen.queryByText(/Upload Error/)).not.toBeInTheDocument();
        });

        // Reset for next test
        fireEvent.change(fileInput, { target: { files: createMockFileList([]) } });
      }
    });

    it("rejects invalid folder patterns", async () => {
      const invalidFolders = [
        "Ambyte_X_backup",
        "Ambyte_0",
        "Ambyte_1000",
        "5",
        "0",
        "ambyte_1",
        "AMBYTE_1",
        "Ambyte-1",
        "Ambyte 1",
        "data",
        "measurements",
      ];

      for (const folderName of invalidFolders) {
        const files = createAmbyteFiles([`${folderName}/data.txt`]);

        const fileInput = document.querySelector('input[type="file"]')!;
        Object.defineProperty(fileInput, "files", {
          value: createMockFileList(files),
          writable: false,
        });

        fireEvent.change(fileInput);

        await waitFor(() => {
          expect(screen.getByText(/Please select an Ambyte folder/)).toBeInTheDocument();
        });

        // Reset for next test
        fireEvent.change(fileInput, { target: { files: createMockFileList([]) } });
      }
    });

    it("rejects multiple Ambyte folders in one upload", async () => {
      const files = createAmbyteFiles([
        "Ambyte_1/1/data.txt",
        "Ambyte_2/1/data.txt",
        "Ambyte_1/config.txt",
        "Ambyte_2/config.txt",
      ]);

      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Please select an Ambyte folder/)).toBeInTheDocument();
      });
    });

    it("rejects mixed folder types (Ambyte_X + numbered)", async () => {
      const files = createAmbyteFiles([
        "Ambyte_10/1/data.txt",
        "1/data.txt", // This should conflict
        "Ambyte_10/config.txt",
      ]);

      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Please select an Ambyte folder/)).toBeInTheDocument();
      });
    });
  });

  describe("File Content Validation", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);
    });

    it("accepts valid .txt files", async () => {
      const files = createAmbyteFiles([
        "Ambyte_1/1/20250101-120000_.txt",
        "Ambyte_1/2/20250101-120100_.txt",
        "Ambyte_1/config.txt",
        "Ambyte_1/run.txt",
        "Ambyte_1/ambyte_log.txt",
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
    });

    it("reports missing required files for Ambyte folders", async () => {
      const files = createAmbyteFiles([
        "Ambyte_1/1/data.txt",
        // Missing: config.txt, run.txt, ambyte_log.txt
      ]);

      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Missing required files in Ambyte_1/)).toBeInTheDocument();
        expect(screen.getByText(/config\.txt, run\.txt, ambyte_log\.txt/)).toBeInTheDocument();
      });
    });

    it("allows extra unexpected files", async () => {
      const files = createAmbyteFiles([
        "Ambyte_1/1/data.txt",
        "Ambyte_1/config.txt",
        "Ambyte_1/run.txt",
        "Ambyte_1/ambyte_log.txt",
        "Ambyte_1/extra_file.txt", // Extra file should be allowed
        "Ambyte_1/backup.bak",
        "Ambyte_1/.DS_Store",
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
    });

    it("rejects invalid file types in measurement folders", async () => {
      const files = [
        ...createAmbyteFiles([
          "Ambyte_1/1/data.txt",
          "Ambyte_1/config.txt",
          "Ambyte_1/run.txt",
          "Ambyte_1/ambyte_log.txt",
        ]),
        createMockFile("image.jpg"), // Invalid file type
      ];

      // Set the webkitRelativePath for the invalid file
      Object.defineProperty(files[files.length - 1], "webkitRelativePath", {
        value: "Ambyte_1/1/image.jpg",
        writable: false,
      });

      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Invalid files detected/)).toBeInTheDocument();
      });
    });
  });

  describe("File Size Validation", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);
    });

    it("rejects files larger than 100MB", async () => {
      const largeFile = createMockFile("large.txt", 101 * 1024 * 1024); // 101MB
      const files = [
        largeFile,
        ...createAmbyteFiles([
          "Ambyte_1/config.txt",
          "Ambyte_1/run.txt",
          "Ambyte_1/ambyte_log.txt",
        ]),
      ];

      Object.defineProperty(largeFile, "webkitRelativePath", {
        value: "Ambyte_1/1/large.txt",
        writable: false,
      });

      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/File too large/)).toBeInTheDocument();
      });
    });

    it("accepts files under the size limit", async () => {
      const normalFile = createMockFile("normal.txt", 50 * 1024 * 1024); // 50MB
      const files = [
        normalFile,
        ...createAmbyteFiles([
          "Ambyte_1/config.txt",
          "Ambyte_1/run.txt",
          "Ambyte_1/ambyte_log.txt",
        ]),
      ];

      Object.defineProperty(normalFile, "webkitRelativePath", {
        value: "Ambyte_1/1/normal.txt",
        writable: false,
      });

      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.queryByText(/File too large/)).not.toBeInTheDocument();
      });
    });
  });

  describe("Edge Cases", () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      render(<AmbyteUploadModal {...defaultProps} />, { wrapper: createWrapper() });

      const ambyteRadio = screen.getAllByRole("radio")[1];
      await user.click(ambyteRadio);
    });

    it("handles empty file list", async () => {
      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList([]),
        writable: false,
      });

      fireEvent.change(fileInput);

      // Should remain in initial state, upload button disabled
      const uploadButton = screen.getByRole("button", { name: /upload data/i });
      expect(uploadButton).toBeDisabled();
    });

    it("handles files with special characters in names", async () => {
      const files = createAmbyteFiles([
        "Ambyte_1/1/data (copy) [2024].txt",
        "Ambyte_1/config#1.txt",
        "Ambyte_1/run & backup.txt",
        "Ambyte_1/ambyte_log.txt",
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
    });

    it("handles deeply nested folder structures", async () => {
      const files = createAmbyteFiles([
        "Ambyte_1/1/subfolder/deep/very/deep/data.txt",
        "Ambyte_1/config.txt",
        "Ambyte_1/run.txt",
        "Ambyte_1/ambyte_log.txt",
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
    });

    it("handles files without extensions", async () => {
      const files = createAmbyteFiles([
        "Ambyte_1/1/datafile", // No extension
        "Ambyte_1/config.txt",
        "Ambyte_1/run.txt",
        "Ambyte_1/ambyte_log.txt",
      ]);

      const fileInput = document.querySelector('input[type="file"]')!;
      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Invalid files detected/)).toBeInTheDocument();
      });
    });
  });
});
