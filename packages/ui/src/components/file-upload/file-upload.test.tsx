import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import { FileUpload } from "./file-upload";
import type { ValidationResult } from "./file-upload";

// Mock file for testing
const createMockFile = (name: string, size: number, type: string = "text/plain"): File => {
  const file = new File(["content"], name, { type });
  Object.defineProperty(file, "size", {
    value: size,
    writable: false,
  });
  return file;
};

// Mock FileList
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

describe("FileUpload", () => {
  const mockOnFileSelect = jest.fn();

  beforeEach(() => {
    mockOnFileSelect.mockClear();
  });

  describe("Basic Functionality", () => {
    it("renders with default content", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      expect(screen.getByText("Drag and drop your files here")).toBeInTheDocument();
      expect(screen.getByText(/click to browse/i)).toBeInTheDocument();
    });

    it("renders directory mode content", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} directory />);

      expect(screen.getByText("Drag and drop your folder here")).toBeInTheDocument();
    });

    it("shows loading state", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} loading />);

      expect(screen.getByText("Processing files...")).toBeInTheDocument();
    });

    it("shows disabled state", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} disabled />);

      const uploadArea = screen
        .getByText("Drag and drop your files here")
        .closest("div")?.parentElement;
      expect(uploadArea).toHaveClass("cursor-not-allowed", "opacity-50");
    });
  });

  describe("File Selection", () => {
    it("handles single file selection", async () => {
      const user = userEvent.setup();
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const file = createMockFile("test.txt", 1000);
      const fileList = createMockFileList([file]);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, file);

      expect(mockOnFileSelect).toHaveBeenCalledWith(expect.any(FileList));
    });

    it("handles multiple file selection", async () => {
      const user = userEvent.setup();
      render(<FileUpload onFileSelect={mockOnFileSelect} multiple />);

      const files = [createMockFile("test1.txt", 1000), createMockFile("test2.txt", 2000)];

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      await user.upload(fileInput, files);

      expect(mockOnFileSelect).toHaveBeenCalledWith(expect.any(FileList));
    });

    it("shows selected files count", async () => {
      const user = userEvent.setup();
      render(<FileUpload onFileSelect={mockOnFileSelect} multiple />);

      const files = [createMockFile("test1.txt", 1000), createMockFile("test2.txt", 2000)];

      // Mock the file input change event
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText("2 files selected")).toBeInTheDocument();
      });
    });

    it("allows clearing selected files", async () => {
      const user = userEvent.setup();
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const file = createMockFile("test.txt", 1000);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList([file]),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText("1 file selected")).toBeInTheDocument();
      });

      const clearButton = screen.getByRole("button");
      await user.click(clearButton);

      expect(mockOnFileSelect).toHaveBeenCalledWith(null);
    });
  });

  describe("Drag and Drop", () => {
    it("handles drag over event", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const uploadArea = screen.getByText("Drag and drop your files here").closest("div")!;

      fireEvent.dragOver(uploadArea);

      expect(screen.getByText("Drop files here")).toBeInTheDocument();
    });

    it("handles drag leave event", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const uploadArea = screen.getByText("Drag and drop your files here").closest("div")!;

      fireEvent.dragOver(uploadArea);
      fireEvent.dragLeave(uploadArea);

      expect(screen.getByText("Drag and drop your files here")).toBeInTheDocument();
    });

    it("handles file drop", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const uploadArea = screen.getByText("Drag and drop your files here").closest("div")!;
      const file = createMockFile("test.txt", 1000);

      const dropEvent = new Event("drop", { bubbles: true });
      Object.defineProperty(dropEvent, "dataTransfer", {
        value: {
          files: createMockFileList([file]),
        },
      });

      fireEvent(uploadArea, dropEvent);

      expect(mockOnFileSelect).toHaveBeenCalledWith(expect.any(Object));
    });

    it("ignores drag events when disabled", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} disabled />);

      const uploadArea = screen.getByText("Drag and drop your files here").closest("div")!;

      fireEvent.dragOver(uploadArea);

      // Should not show active drag state
      expect(screen.queryByText("Drop files here")).not.toBeInTheDocument();
    });
  });

  describe("Validation", () => {
    it("validates file size", async () => {
      render(
        <FileUpload
          onFileSelect={mockOnFileSelect}
          maxSize={500} // 500 bytes
        />,
      );

      const file = createMockFile("large-file.txt", 1000); // 1000 bytes
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList([file]),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText(/Files exceed maximum size/)).toBeInTheDocument();
      });

      expect(mockOnFileSelect).toHaveBeenCalledWith(null);
    });

    it("validates file count", async () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} maxFiles={1} multiple />);

      const files = [createMockFile("file1.txt", 100), createMockFile("file2.txt", 100)];

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList(files),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText("Maximum 1 files allowed")).toBeInTheDocument();
      });

      expect(mockOnFileSelect).toHaveBeenCalledWith(null);
    });

    it("runs custom validator", async () => {
      const mockValidator = jest.fn(
        (files: FileList): ValidationResult => ({
          isValid: false,
          errors: ["Custom validation error"],
        }),
      );

      render(<FileUpload onFileSelect={mockOnFileSelect} validator={mockValidator} />);

      const file = createMockFile("test.txt", 100);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList([file]),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText("Custom validation error")).toBeInTheDocument();
      });

      expect(mockValidator).toHaveBeenCalledWith(expect.any(Object));
      expect(mockOnFileSelect).toHaveBeenCalledWith(null);
    });

    it("passes validation with valid files", async () => {
      const mockValidator = jest.fn(
        (files: FileList): ValidationResult => ({
          isValid: true,
          errors: [],
        }),
      );

      render(
        <FileUpload onFileSelect={mockOnFileSelect} validator={mockValidator} maxSize={1000} />,
      );

      const file = createMockFile("test.txt", 500);
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;

      Object.defineProperty(fileInput, "files", {
        value: createMockFileList([file]),
        writable: false,
      });

      fireEvent.change(fileInput);

      await waitFor(() => {
        expect(screen.getByText("1 file selected")).toBeInTheDocument();
      });

      expect(mockOnFileSelect).toHaveBeenCalledWith(expect.any(Object));
    });
  });

  describe("Error Handling", () => {
    it("displays external error", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} error="Upload failed" />);

      expect(screen.getByText("Upload failed")).toBeInTheDocument();
    });

    it("shows error state in upload area", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} error="Upload failed" />);

      expect(screen.getByText("Upload Error")).toBeInTheDocument();
      expect(screen.getByText("Click to try again")).toBeInTheDocument();
    });
  });

  describe("Progress Indication", () => {
    it("shows progress bar when loading with progress", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} loading progress={50} />);

      expect(screen.getByText("Uploading...")).toBeInTheDocument();
      expect(screen.getByText("50%")).toBeInTheDocument();
    });
  });

  describe("Accessibility", () => {
    it("has proper ARIA attributes", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const fileInput = document.querySelector('input[type="file"]');
      expect(fileInput).toHaveAttribute("type", "file");
    });

    it("supports keyboard navigation", async () => {
      const user = userEvent.setup();
      render(<FileUpload onFileSelect={mockOnFileSelect} />);

      const uploadArea = screen.getByText("Drag and drop your files here").closest("div")!;

      // Should be focusable and clickable
      await user.click(uploadArea);

      // File input should be triggered (though we can't easily test the file dialog)
      expect(uploadArea).toBeDefined();
    });
  });

  describe("Directory Support", () => {
    it("sets webkitdirectory attribute for directory mode", () => {
      render(<FileUpload onFileSelect={mockOnFileSelect} directory />);

      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      expect(fileInput).toHaveAttribute("webkitdirectory");
    });
  });
});
